import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

export interface NewsSummary {
  topic: string;
  summaries: Array<{
    title: string;
    summary: string;
    url: string;
    source: string;
  }>;
}

export async function summarizeNews(
  topic: string,
  articles: NewsArticle[],
  isPaid: boolean = false
): Promise<NewsSummary> {
  if (articles.length === 0) {
    return {
      topic,
      summaries: [],
    };
  }

  const format = isPaid ? 'paragraph' : 'bullet point';

  // First, filter articles by relevance using OpenAI
  const relevantArticles = await filterArticlesByRelevance(articles, topic);

  // Use top 5 most relevant articles
  const articlesToSummarize = relevantArticles.slice(0, 5);

  const prompt = `You are a news summarizer for SnipIt, a personalized news delivery platform. 
  
Topic: ${topic}
Format: ${format} summaries (${
    isPaid ? '2-3 sentences per article' : '3-4 bullet points per article'
  })
Articles to summarize: ${articlesToSummarize.length}

Please provide exactly 3-5 summaries for the most relevant and recent articles. Each summary should:
- Be concise and informative
- Include the article title
- Provide a ${format} summary of the key information (no fluff, just facts)
- Include the source name
- Include the article URL

Format your response as JSON:
{
  "summaries": [
    {
      "title": "Article Title",
      "summary": "Summary text here",
      "url": "https://example.com/article",
      "source": "Source Name"
    }
  ]
}

Articles to process:
${articlesToSummarize
  .map(
    (article, index) => `
Article ${index + 1}:
Title: ${article.title}
Description: ${article.description.substring(0, 500)}
URL: ${article.url}
Source: ${article.source.name}
Published: ${article.publishedAt}
`
  )
  .join('\n')}`;

  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional news summarizer. Always respond with valid JSON format only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;

      const parsed = JSON.parse(jsonString);

      // Ensure we have summaries
      if (
        parsed.summaries &&
        Array.isArray(parsed.summaries) &&
        parsed.summaries.length > 0
      ) {
        return {
          topic,
          summaries: parsed.summaries.slice(0, 5), // Limit to 5 summaries
        };
      } else {
        throw new Error('Invalid response format from OpenAI');
      }
    } catch (error: unknown) {
      retries++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('429') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit')
      ) {
        if (retries === MAX_RETRIES) {
          console.error('Max retries reached for summarization');
          // Fallback to basic summaries
          break;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 2000 * retries));
        continue;
      } else {
        console.error('Error summarizing news:', error);
        // Fallback to basic summaries
        break;
      }
    }
  }

  // Fallback: return basic summaries
  return {
    topic,
    summaries: articlesToSummarize.slice(0, 3).map((article) => ({
      title: article.title,
      summary: article.description.substring(0, 200) + '...',
      url: article.url,
      source: article.source.name,
    })),
  };
}

// Helper function to filter articles by relevance using OpenAI
async function filterArticlesByRelevance(
  articles: NewsArticle[],
  topic: string
): Promise<NewsArticle[]> {
  if (articles.length === 0) return [];
  if (articles.length <= 5) return articles; // If 5 or fewer, return all

  try {
    const articlesText = articles
      .map((article, index) => {
        const content = `${article.title} ${
          article.description ? article.description.substring(0, 200) : ''
        }`;
        return `Article ${index + 1}: ${content}`;
      })
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news article analyzer. Your task is to determine which articles are specifically about the given topic.
          Return a JSON object with this structure:
          {
            "articles": [
              {
                "index": 1,
                "isRelevant": true,
                "relevanceScore": 0.9
              }
            ]
          }
          
          Be strict in your analysis. Only mark articles as relevant if they are specifically about the topic, not just tangentially related.`,
        },
        {
          role: 'user',
          content: `Topic: ${topic}\n\nArticles:\n${articlesText}`,
        },
      ],
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return articles.slice(0, 5); // Fallback: return first 5
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : response;
    const analysis = JSON.parse(jsonString);

    interface ArticleAnalysis {
      index: number;
      isRelevant: boolean;
      relevanceScore: number;
    }

    interface AnalysisResponse {
      articles?: ArticleAnalysis[];
    }

    const typedAnalysis = analysis as AnalysisResponse;

    // Map the analysis back to the original articles
    interface ArticleWithRelevance extends NewsArticle {
      relevanceScore: number;
      isRelevant: boolean;
    }

    const analyzedArticles: ArticleWithRelevance[] = articles.map(
      (article, index) => {
        const articleAnalysis = typedAnalysis.articles?.find(
          (a) => a.index === index + 1
        ) || {
          isRelevant: true,
          relevanceScore: 0.5,
          index: index + 1,
        };

        return {
          ...article,
          relevanceScore: articleAnalysis.relevanceScore || 0.5,
          isRelevant: articleAnalysis.isRelevant !== false,
        };
      }
    );

    // Filter and sort articles
    return analyzedArticles
      .filter((article) => article.isRelevant)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  } catch (error) {
    console.error('Error filtering articles by relevance:', error);
    // Fallback: return first 5 articles
    return articles.slice(0, 5);
  }
}

import OpenAI from 'openai';
import { getSupabaseAdmin } from './supabase';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to deduplicate summaries by title and content
function deduplicateSummaries(
  summaries: NewsSummary['summaries'],
  isPaid: boolean
): NewsSummary['summaries'] {
  const seenTitles = new Set<string>();
  const seenContent = new Set<string>();
  const deduplicated: NewsSummary['summaries'] = [];

  for (const summary of summaries) {
    // Normalize title for comparison
    const normalizedTitle = summary.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
    
    // Check for duplicate or very similar title
    let isDuplicateTitle = false;
    for (const seenTitle of seenTitles) {
      // Check for exact match or high similarity (first 30 chars match)
      if (normalizedTitle === seenTitle || 
          (normalizedTitle.length > 30 && seenTitle.length > 30 &&
           normalizedTitle.substring(0, 30) === seenTitle.substring(0, 30))) {
        isDuplicateTitle = true;
        break;
      }
    }

    // Check for duplicate content
    let contentToCheck = '';
    if (!isPaid && summary.bullets && summary.bullets.length > 0) {
      contentToCheck = summary.bullets.join(' ').toLowerCase().trim();
    } else if (isPaid && summary.summary) {
      contentToCheck = summary.summary.toLowerCase().trim();
    }

    // Normalize content for comparison (remove extra spaces, punctuation)
    const normalizedContent = contentToCheck
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 100); // Compare first 100 chars

    const isDuplicateContent = normalizedContent.length > 20 && seenContent.has(normalizedContent);

    // Only add if not a duplicate
    if (!isDuplicateTitle && !isDuplicateContent) {
      seenTitles.add(normalizedTitle);
      if (normalizedContent.length > 20) {
        seenContent.add(normalizedContent);
      }
      deduplicated.push(summary);
    } else {
      console.log(`[OpenAI] Removed duplicate summary: "${summary.title}"`);
    }
  }

  return deduplicated;
}

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
    summary: string; // For paid tier: paragraph format. For free tier: can be used as fallback
    bullets?: string[]; // For free tier: array of 3 bullet points (1-2 sentences each)
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

  // Check cache first - use today's date as cache key
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const adminClient = getSupabaseAdmin();
  
  try {
    const { data: cachedSummary, error: cacheError } = await (adminClient
      .from('summary_cache') as any)
      .select('summaries')
      .eq('topic', topic)
      .eq('date', today)
      .eq('is_paid', isPaid)
      .single();

    if (!cacheError && cachedSummary && (cachedSummary as any).summaries) {
      console.log(`[OpenAI] Using cached summary for topic: ${topic} (${isPaid ? 'paid' : 'free'})`);
      return {
        topic,
        summaries: (cachedSummary as any).summaries as NewsSummary['summaries'],
      };
    }
  } catch (error) {
    // Cache miss or error - continue to generate new summary
    console.log(`[OpenAI] Cache miss for topic: ${topic}, generating new summary`);
  }

  // Article selection: Since newsapi.ts always returns max 10 articles, we never have >10
  // Take top articles, prioritizing those with better descriptions (more context)
  // For free tier: take top 7 articles to ensure we can get 3 good summaries
  // For paid tier: take top 7 articles to ensure we can get 4-5 good summaries
  const articlesToTake = isPaid ? 7 : 7;
  
  // Sort articles by description quality (longer = more context) before selecting
  const sortedArticles = [...articles].sort((a, b) => {
    const aLength = a.description?.length || 0;
    const bLength = b.description?.length || 0;
    return bLength - aLength; // Longer descriptions first
  });
  
  const articlesToSummarize = sortedArticles.slice(0, articlesToTake);

  if (articlesToSummarize.length === 0) {
    return {
      topic,
      summaries: [],
    };
  }

  const format = isPaid ? 'paragraph' : 'bullet point';
  const summaryCount = isPaid ? 5 : 3; // Exact numbers, not ranges

  // Clear, structured prompt for free tier
  const freeTierInstructions = `For FREE TIER, you MUST return exactly 3 summaries representing the 3 most relevant and impactful points about "${topic}".

CRITICAL REQUIREMENTS:
- NO REPETITION: Each of the 3 points must be DISTINCT and UNIQUE. Do not repeat similar information.
- NO FLUFF: Bullets must be concise, factual, and information-dense. Remove marketing language, filler words, and unnecessary details.
- ACCURACY: Only include information that is directly stated in the articles. Do not infer or speculate.
- RELEVANCE: Each point must be directly related to "${topic}". If an article is only tangentially related, skip it.

Each summary must have:
- A "title" field with the article title that best represents that point (NO duplicate titles)
- A "bullets" array with exactly 1 bullet point (1-2 sentences) that explains that specific point concisely
- The bullet should be detailed and informative, providing key information about that point without fluff
- "url" and "source" fields from the article that best supports that point

The 3 points can come from:
- The same article (if one article covers multiple DISTINCT important points)
- Different articles (if different articles cover different important points)
- Any combination that best represents the 3 most relevant and DISTINCT points about "${topic}"

Example structure:
{
  "summaries": [
    {
      "title": "Article Title for Point 1",
      "bullets": [
        "Detailed explanation of the first most relevant point about ${topic} (1-2 sentences with key information)."
      ],
      "url": "https://example.com/article1",
      "source": "Source Name"
    },
    {
      "title": "Article Title for Point 2",
      "bullets": [
        "Detailed explanation of the second most relevant point about ${topic} (1-2 sentences with key information)."
      ],
      "url": "https://example.com/article2",
      "source": "Source Name"
    },
    {
      "title": "Article Title for Point 3",
      "bullets": [
        "Detailed explanation of the third most relevant point about ${topic} (1-2 sentences with key information)."
      ],
      "url": "https://example.com/article3",
      "source": "Source Name"
    }
  ]
}`;

  const paidTierInstructions = `For PAID TIER, return 4-5 articles. Each article must have:
- A "title" field with the article title
- A "summary" field with a 2-3 sentence paragraph summary
- "url" and "source" fields`;

  const prompt = `Topic: ${topic}
Format: ${format}

You are summarizing news articles about "${topic}". From the articles below, ${isPaid 
  ? `select the ${summaryCount} most relevant articles and provide concise, no-fluff paragraph summaries for each.` 
  : `identify the 3 most relevant and impactful points about "${topic}" based on the articles provided. These 3 points must be DISTINCT, UNIQUE, and directly related to "${topic}". Each point should be substantial, informative, and contain no fluff or repetition.`} 

STRICT REQUIREMENTS:
- Only include content that is DIRECTLY about "${topic}"
- NO repetition of information across summaries
- NO duplicate or very similar titles
- NO marketing language, filler words, or fluff - be concise and factual
- Prioritize the most important, impactful, and recent developments

${isPaid ? paidTierInstructions : freeTierInstructions}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no additional text. The JSON must be parseable.

Articles to choose from:
${articlesToSummarize
  .map(
    (article, index) => {
      // Use optimized description length: 350 chars for better context while staying token-efficient
      // This gives enough context without being too verbose
      const description = article.description 
        ? article.description.substring(0, 350).trim() + (article.description.length > 350 ? '...' : '')
        : 'No description available';
      
      return `${index + 1}. Title: ${article.title}
Description: ${description}
Source: ${article.source.name}
URL: ${article.url}`;
    }
  )
  .join('\n\n')}`;

  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
        {
          role: 'system',
          content: isPaid
            ? 'You are a news summarizer for paid tier. Return ONLY valid JSON with 4-5 articles, each having "title", "summary" (2-3 sentences, no fluff), "url", and "source". Ensure no duplicate titles or repeated information. No markdown, no code blocks.'
            : 'You are a news summarizer for free tier. Return ONLY valid JSON with exactly 3 summaries. Each summary must have "title" (unique, no duplicates), "bullets" (array with exactly 1 string, 1-2 sentences, no fluff), "url", and "source". Ensure all 3 points are DISTINCT and UNIQUE - no repetition. No markdown, no code blocks.',
        },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500, // OPTIMIZATION: Reduced from 2000
        response_format: { type: 'json_object' }, // OPTIMIZATION: Force JSON mode for better reliability
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Log raw response for debugging (first 500 chars)
      console.log(`[OpenAI] Raw response (first 500 chars):`, response.substring(0, 500));

      // Try to extract JSON from response (in case there's extra text)
      let jsonString = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to find JSON object
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        console.error(`[OpenAI] JSON parse error:`, parseError);
        console.error(`[OpenAI] Attempted to parse:`, jsonString.substring(0, 200));
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Ensure we have summaries
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Response is not a valid JSON object');
      }

      if (
        parsed.summaries &&
        Array.isArray(parsed.summaries) &&
        parsed.summaries.length > 0
      ) {
        // For free tier: enforce exactly 3 summaries with bullets
        // For paid tier: enforce 4-5 summaries with paragraphs
        const requiredCount = isPaid ? 4 : 3;
        const maxCount = isPaid ? 5 : 3;
        
        let summaries = parsed.summaries;
        
        // Validate structure first
        if (summaries.length < requiredCount) {
          console.warn(`[OpenAI] Only got ${summaries.length} summaries, expected at least ${requiredCount}. Retrying...`);
          throw new Error(`Insufficient summaries: got ${summaries.length}, need at least ${requiredCount}`);
        }
        
        // Limit to max count
        summaries = summaries.slice(0, maxCount);
        
        // Validate each summary has required fields
        const validSummaries = summaries.filter((s: any) => {
          if (!s || typeof s !== 'object' || !s.title || !s.url || !s.source) {
            console.warn(`[OpenAI] Invalid summary structure: missing required fields`, s);
            return false;
          }
          
          if (!isPaid) {
            // Free tier: MUST have bullets array with at least 1 item
            if (!s.bullets || !Array.isArray(s.bullets)) {
              console.warn(`[OpenAI] Free tier summary missing bullets array:`, s.title);
              return false;
            }
            if (s.bullets.length < 1) {
              console.warn(`[OpenAI] Free tier summary has no bullets:`, s.title);
              return false;
            }
            // Ensure all bullets are non-empty strings
            const validBullets = s.bullets.filter((b: string) => typeof b === 'string' && b.trim().length > 0);
            if (validBullets.length < 1) {
              console.warn(`[OpenAI] Free tier summary has invalid bullets:`, s.title);
              return false;
            }
            // Keep all valid bullets (can be 1 or more)
            s.bullets = validBullets;
            return true;
          } else {
            // Paid tier: MUST have summary field
            if (!s.summary || typeof s.summary !== 'string' || s.summary.trim().length === 0) {
              console.warn(`[OpenAI] Paid tier summary missing summary field:`, s.title);
              return false;
            }
            return true;
          }
        });
        
        // For free tier, we MUST have exactly 3 valid summaries
        if (!isPaid && validSummaries.length < 3) {
          console.warn(`[OpenAI] Only ${validSummaries.length} valid free tier summaries, need exactly 3. Retrying...`);
          throw new Error(`Insufficient valid summaries: got ${validSummaries.length}, need exactly 3`);
        }
        
        // For paid tier, we need at least 4
        if (isPaid && validSummaries.length < 4) {
          console.warn(`[OpenAI] Only ${validSummaries.length} valid paid tier summaries, need at least 4. Retrying...`);
          throw new Error(`Insufficient valid summaries: got ${validSummaries.length}, need at least 4`);
        }
        
        if (validSummaries.length === 0) {
          throw new Error('All summaries are missing required fields');
        }
        
        console.log(`[OpenAI] Successfully parsed ${validSummaries.length} summaries for topic: ${topic}`);
        
        // Post-processing: Deduplicate titles and bullets to ensure uniqueness
        const deduplicatedSummaries = deduplicateSummaries(validSummaries, isPaid);
        
        // Ensure we still have enough summaries after deduplication
        const finalSummaries = deduplicatedSummaries.length >= (isPaid ? 4 : 3) 
          ? deduplicatedSummaries 
          : validSummaries;
        
        if (deduplicatedSummaries.length < validSummaries.length) {
          console.log(`[OpenAI] Deduplication removed ${validSummaries.length - deduplicatedSummaries.length} duplicate summaries`);
        }
        
        const result: NewsSummary = {
          topic,
          summaries: finalSummaries,
        };

        // Cache the result for future use
        try {
          const { error: cacheInsertError } = await (adminClient
            .from('summary_cache') as any)
            .upsert({
              topic,
              date: today,
              is_paid: isPaid,
              summaries: validSummaries,
            }, {
              onConflict: 'topic,date,is_paid',
            });

          if (cacheInsertError) {
            console.error(`[OpenAI] Failed to cache summary for ${topic}:`, cacheInsertError);
          } else {
            console.log(`[OpenAI] Cached summary for topic: ${topic} (${isPaid ? 'paid' : 'free'})`);
          }
        } catch (cacheError) {
          // Don't fail if caching fails - just log it
          console.error(`[OpenAI] Error caching summary for ${topic}:`, cacheError);
        }

        return result;
      } else {
        console.error(`[OpenAI] Invalid response structure:`, {
          hasSummaries: !!parsed.summaries,
          isArray: Array.isArray(parsed.summaries),
          length: parsed.summaries?.length,
          keys: Object.keys(parsed),
          sample: JSON.stringify(parsed).substring(0, 200),
        });
        throw new Error('Response missing summaries array or summaries array is empty');
      }
    } catch (error: unknown) {
      retries++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Log the error for debugging
      console.error(`[OpenAI] Error (attempt ${retries}/${MAX_RETRIES}):`, errorMessage);
      
      if (
        errorMessage.includes('429') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit')
      ) {
        if (retries === MAX_RETRIES) {
          console.error('[OpenAI] Max retries reached for summarization - using fallback');
          break;
        }
        // Exponential backoff with jitter
        const delay = 2000 * retries + Math.random() * 1000;
        console.log(`[OpenAI] Rate limited, waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      } else if (errorMessage.includes('invalid') || errorMessage.includes('parse')) {
        // JSON parsing error - try one more time with different approach
        if (retries < MAX_RETRIES) {
          console.log('[OpenAI] JSON parse error, retrying...');
          continue;
        }
        break;
      } else {
        console.error('[OpenAI] Unexpected error:', error);
        break;
      }
    }
  }

  // Fallback: return basic summaries with proper structure
  console.log(`[OpenAI] Using fallback summaries for topic: ${topic}`);
  const fallbackCount = isPaid ? 4 : 3;
  // For free tier fallback, use the most relevant article (first one) for all 3 summaries
  // This ensures we have content even if OpenAI fails
  const fallbackArticle = articlesToSummarize[0];
  const fallbackArticles = isPaid ? articlesToSummarize.slice(0, fallbackCount) : [fallbackArticle];
  
  let fallbackResult: NewsSummary;
  
  if (isPaid) {
    // Paid tier fallback: paragraph summaries
    fallbackResult = {
      topic,
      summaries: fallbackArticles.map((article) => ({
        title: article.title,
        summary: article.description 
          ? article.description.substring(0, 300).trim() + (article.description.length > 300 ? '...' : '')
          : 'No description available',
        url: article.url,
        source: article.source.name,
      })),
    };
  } else {
    // Free tier fallback: create 3 summaries all from the most relevant article
    // Split the article description into 9 bullet points, then group into 3 summaries of 3 bullets each
    const description = fallbackArticle.description || 'No description available';
    const sentences = description
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 15)
      .slice(0, 12); // Get up to 12 sentences to create 9 bullets (3 summaries × 3 bullets)
    
    let allBullets: string[] = [];
    if (sentences.length >= 3) {
      // Group sentences into bullets (1-2 sentences each)
      const perBullet = Math.ceil(sentences.length / 9);
      for (let i = 0; i < Math.min(9, sentences.length); i++) {
        const start = i * perBullet;
        const end = Math.min(start + perBullet, sentences.length);
        const bulletText = sentences.slice(start, end).join('. ').trim();
        if (bulletText) {
          allBullets.push(bulletText + (bulletText.endsWith('.') ? '' : '.'));
        }
      }
    } else {
      // If not enough sentences, create bullets from description chunks
      const chunkSize = Math.ceil(description.length / 9);
      for (let i = 0; i < 9; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, description.length);
        const chunk = description.substring(start, end).trim();
        if (chunk) {
          allBullets.push(chunk + (chunk.endsWith('.') ? '' : '.'));
        }
      }
    }
    
    // Ensure we have at least 9 bullets (pad if needed)
    while (allBullets.length < 9) {
      allBullets.push('Additional information available in the full article.');
    }
    allBullets = allBullets.slice(0, 9);
    
    // Group into 3 summaries of 3 bullets each
    fallbackResult = {
      topic,
      summaries: [
        {
          title: fallbackArticle.title,
          bullets: allBullets.slice(0, 3),
          summary: description.substring(0, 200) + '...',
          url: fallbackArticle.url,
          source: fallbackArticle.source.name,
        },
        {
          title: fallbackArticle.title,
          bullets: allBullets.slice(3, 6),
          summary: description.substring(0, 200) + '...',
          url: fallbackArticle.url,
          source: fallbackArticle.source.name,
        },
        {
          title: fallbackArticle.title,
          bullets: allBullets.slice(6, 9),
          summary: description.substring(0, 200) + '...',
          url: fallbackArticle.url,
          source: fallbackArticle.source.name,
        },
      ],
    };
  }

  // Cache the fallback result as well
  try {
    const { error: cacheInsertError } = await (adminClient
      .from('summary_cache') as any)
      .upsert({
        topic,
        date: today,
        is_paid: isPaid,
        summaries: fallbackResult.summaries,
      }, {
        onConflict: 'topic,date,is_paid',
      });

    if (cacheInsertError) {
      console.error(`[OpenAI] Failed to cache fallback summary for ${topic}:`, cacheInsertError);
    } else {
      console.log(`[OpenAI] Cached fallback summary for topic: ${topic} (${isPaid ? 'paid' : 'free'})`);
    }
  } catch (cacheError) {
    // Don't fail if caching fails - just log it
    console.error(`[OpenAI] Error caching fallback summary for ${topic}:`, cacheError);
  }

  return fallbackResult;
}

// Helper function to filter articles by relevance using OpenAI
// OPTIMIZATION: Only called when we have > 10 articles to save API calls
async function filterArticlesByRelevance(
  articles: NewsArticle[],
  topic: string
): Promise<NewsArticle[]> {
  if (articles.length === 0) return [];
  if (articles.length <= 5) return articles; // If 5 or fewer, return all

  try {
    // OPTIMIZATION: Only process top 15 articles for filtering (saves tokens)
    const articlesToFilter = articles.slice(0, 15);
    
    // OPTIMIZATION: Reduced token usage - truncate descriptions to 150 chars
    const articlesText = articlesToFilter
      .map((article, index) => {
        const content = `${article.title} ${
          article.description ? article.description.substring(0, 150) : ''
        }`;
        return `${index + 1}. ${content}`;
      })
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Analyze article relevance. Return only JSON: {"articles": [{"index": 1, "isRelevant": true, "relevanceScore": 0.9}]}. Be strict - only mark as relevant if directly about the topic.',
        },
        {
          role: 'user',
          content: `Topic: ${topic}\n\nArticles:\n${articlesText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000, // OPTIMIZATION: Reduced token limit
      response_format: { type: 'json_object' }, // OPTIMIZATION: Force JSON mode
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

    const analyzedArticles: ArticleWithRelevance[] = articlesToFilter.map(
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
    const filtered = analyzedArticles
      .filter((article) => article.isRelevant)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    // Return top 5 most relevant
    return filtered.length > 0 ? filtered : articles.slice(0, 5);
  } catch (error) {
    console.error('[OpenAI] Error filtering articles by relevance:', error);
    // Fallback: return first 5 articles
    return articles.slice(0, 5);
  }
}

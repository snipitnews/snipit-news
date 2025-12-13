import { NewsArticle } from './openai';
import { getSourcesForTopic } from './newsSources';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

export async function fetchNewsForTopic(topic: string): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) {
    throw new Error('NEWS_API_KEY is not configured');
  }

  try {
    // Calculate date for last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const fromDate = yesterday.toISOString().split('T')[0];

    // Get topic-specific sources
    const sources = getSourcesForTopic(topic);
    console.log(`Using sources for topic "${topic}":`, sources);

    const response = await fetch(
      `${NEWS_API_BASE_URL}/everything?` +
        `q=${encodeURIComponent(topic)}&` +
        `from=${fromDate}&` +
        `sortBy=publishedAt&` +
        `language=en&` +
        `pageSize=20&` +
        `apiKey=${NEWS_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(
        `NewsAPI error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error(`NewsAPI error: ${data.message}`);
    }

    if (!data.articles || data.articles.length === 0) {
      console.log(`No articles found for topic: ${topic}`);
      return [];
    }

    console.log(`Found ${data.articles.length} total articles for "${topic}"`);

    // Filter articles by source
    interface NewsAPIArticle {
      url?: string;
      title?: string;
      description?: string;
      content?: string;
      publishedAt?: string;
      source?: {
        name?: string;
      };
    }

    const filteredArticles = (data.articles as NewsAPIArticle[]).filter(
      (article) => {
        if (!article.url) return false;
        try {
          const sourceUrl = new URL(article.url).hostname;
          const isFromSource = sources.some((source) =>
            sourceUrl.includes(source)
          );
          return isFromSource;
        } catch {
          return false;
        }
      }
    );

    console.log(
      `Found ${filteredArticles.length} articles from specified sources for "${topic}"`
    );

    // If no articles from specified sources, use all articles
    const articlesToUse =
      filteredArticles.length > 0 ? filteredArticles : data.articles;

    // Map and filter articles
    const mappedArticles = articlesToUse
      .map((article: NewsAPIArticle) => ({
        title: article.title || 'No title',
        description: article.description || article.content || 'No description',
        url: article.url || '',
        publishedAt: article.publishedAt || '',
        source: {
          name: article.source?.name || 'Unknown source',
        },
      }))
      .filter(
        (article: NewsArticle) =>
          article.title !== 'No title' &&
          article.url &&
          article.description !== 'No description'
      );

    // Return top 10 most relevant articles
    return mappedArticles.slice(0, 10);
  } catch (error) {
    console.error(`Error fetching news for topic "${topic}":`, error);
    return [];
  }
}

export async function fetchNewsForMultipleTopics(
  topics: string[]
): Promise<Record<string, NewsArticle[]>> {
  const results: Record<string, NewsArticle[]> = {};

  // Process topics in parallel but with a small delay to respect rate limits
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    try {
      results[topic] = await fetchNewsForTopic(topic);

      // Add small delay between requests to respect rate limits
      if (i < topics.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Failed to fetch news for topic "${topic}":`, error);
      results[topic] = [];
    }
  }

  return results;
}

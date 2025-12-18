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
      // Handle rate limiting (429) and other errors
      if (response.status === 429) {
        console.error(`[NewsAPI] Rate limit exceeded for topic "${topic}"`);
        throw new Error('NewsAPI rate limit exceeded. Please try again later.');
      }
      const errorText = await response.text();
      console.error(`[NewsAPI] Error ${response.status} for topic "${topic}":`, errorText);
      throw new Error(
        `NewsAPI error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== 'ok') {
      console.error(`[NewsAPI] API returned error for topic "${topic}":`, data.message);
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

    // Map and filter articles - prioritize content over description for better context
    const mappedArticles = articlesToUse
      .map((article: NewsAPIArticle) => {
        // Use content if available (usually more detailed), otherwise description
        const textContent = article.content || article.description || '';
        // Clean up content - remove [Source] tags and extra whitespace
        const cleanContent = textContent
          .replace(/\[.*?\]/g, '') // Remove [Source] tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        return {
          title: article.title || 'No title',
          description: cleanContent || 'No description',
          url: article.url || '',
          publishedAt: article.publishedAt || '',
          source: {
            name: article.source?.name || 'Unknown source',
          },
        };
      })
      .filter(
        (article: NewsArticle) =>
          article.title !== 'No title' &&
          article.url &&
          article.description !== 'No description' &&
          article.description.length > 50 // Filter out very short descriptions
      );

    // Deduplicate articles by title similarity (remove near-duplicates)
    const deduplicatedArticles: NewsArticle[] = [];
    const seenTitles = new Set<string>();
    
    for (const article of mappedArticles) {
      // Normalize title for comparison (lowercase, remove special chars)
      const normalizedTitle = article.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
      
      // Check if we've seen a similar title (exact match or very similar)
      let isDuplicate = false;
      for (const seenTitle of seenTitles) {
        // Check for exact match or high similarity
        if (normalizedTitle === seenTitle || 
            (normalizedTitle.length > 20 && seenTitle.includes(normalizedTitle.substring(0, 20))) ||
            (seenTitle.length > 20 && normalizedTitle.includes(seenTitle.substring(0, 20)))) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seenTitles.add(normalizedTitle);
        deduplicatedArticles.push(article);
      }
    }

    // Sort by description length (longer = more context) and recency
    const sortedArticles = deduplicatedArticles.sort((a, b) => {
      // Prioritize articles with longer descriptions (more context)
      const lengthDiff = b.description.length - a.description.length;
      if (Math.abs(lengthDiff) > 100) {
        return lengthDiff;
      }
      // If similar length, prioritize by date (newer first)
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // Return top 10 most relevant articles
    return sortedArticles.slice(0, 10);
  } catch (error) {
    console.error(`Error fetching news for topic "${topic}":`, error);
    return [];
  }
}

export async function fetchNewsForMultipleTopics(
  topics: string[]
): Promise<Record<string, NewsArticle[]>> {
  const results: Record<string, NewsArticle[]> = {};

  // Process topics sequentially with delay to respect rate limits
  // NewsAPI free tier: 100 requests/day, so we need to be careful
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    try {
      console.log(`[NewsAPI] Fetching news for topic ${i + 1}/${topics.length}: ${topic}`);
      results[topic] = await fetchNewsForTopic(topic);

      // Add delay between requests to respect rate limits (200ms between requests)
      // This helps avoid hitting the 100 requests/day limit on free tier
      if (i < topics.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[NewsAPI] Failed to fetch news for topic "${topic}":`, errorMessage);
      
      // If rate limited, wait longer before continuing
      if (errorMessage.includes('rate limit')) {
        console.log(`[NewsAPI] Rate limited, waiting 2 seconds before next request...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      
      results[topic] = [];
    }
  }

  return results;
}

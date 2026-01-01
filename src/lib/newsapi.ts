import { NewsArticle } from './openai';
import { getSourcesForTopic } from './newsSources';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

async function fetchNewsForTopicWithTimeWindow(
  topic: string,
  daysBack: number
): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) {
    throw new Error('NEWS_API_KEY is not configured');
  }

  // Calculate date for specified days back
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  // Get topic-specific sources
  const sources = getSourcesForTopic(topic);

  const response = await fetch(
    `${NEWS_API_BASE_URL}/everything?` +
      `q=${encodeURIComponent(topic)}&` +
      `from=${fromDateStr}&` +
      `sortBy=publishedAt&` +
      `language=en&` +
      `pageSize=20&` +
      `apiKey=${NEWS_API_KEY}`
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('NewsAPI rate limit exceeded');
    }
    const errorText = await response.text();
    throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== 'ok') {
    throw new Error(`NewsAPI error: ${data.message}`);
  }

  if (!data.articles || data.articles.length === 0) {
    return [];
  }

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

  // Sort by recency first (newer articles are more relevant), then by description length
  const sortedArticles = deduplicatedArticles.sort((a, b) => {
    // Prioritize by date (newer first)
    const dateDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (Math.abs(dateDiff) > 3600000) { // If more than 1 hour difference, prioritize date
      return dateDiff;
    }
    // If similar date, prioritize articles with longer descriptions (more context)
    return b.description.length - a.description.length;
  });

  return sortedArticles;
}

export async function fetchNewsForTopic(topic: string): Promise<NewsArticle[]> {
  const MIN_ARTICLES_NEEDED = 3; // Need at least 3 articles for good summaries
  const MAX_DAYS_BACK = 14; // Maximum 2 weeks

  try {
    // First, try last 24 hours
    console.log(`[NewsAPI] Fetching news for "${topic}" from last 24 hours...`);
    let articles = await fetchNewsForTopicWithTimeWindow(topic, 1);
    
    console.log(`[NewsAPI] Found ${articles.length} articles from last 24 hours for "${topic}"`);

    // If we don't have enough articles, expand time window progressively
    if (articles.length < MIN_ARTICLES_NEEDED) {
      const timeWindows = [3, 7, 14]; // 3 days, 1 week, 2 weeks
      
      for (const days of timeWindows) {
        if (articles.length >= MIN_ARTICLES_NEEDED) break;
        if (days > MAX_DAYS_BACK) break;
        
        console.log(`[NewsAPI] Only ${articles.length} articles found, expanding to last ${days} days for "${topic}"...`);
        const expandedArticles = await fetchNewsForTopicWithTimeWindow(topic, days);
        
        // Merge with existing articles, prioritizing newer ones
        const existingUrls = new Set(articles.map(a => a.url));
        const newArticles = expandedArticles.filter(a => !existingUrls.has(a.url));
        articles = [...articles, ...newArticles];
        
        // Re-sort by recency
        articles.sort((a, b) => 
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        
        console.log(`[NewsAPI] Found ${articles.length} total articles (including ${newArticles.length} new) from last ${days} days`);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Return top 10 most relevant articles (prioritizing latest 3)
    // Take top 3 latest, then fill with best quality up to 10
    const latest3 = articles.slice(0, 3);
    const remaining = articles.slice(3);
    
    // Sort remaining by quality (description length)
    const sortedByQuality = remaining.sort((a, b) => 
      b.description.length - a.description.length
    );
    
    const finalArticles = [...latest3, ...sortedByQuality.slice(0, 7)];
    
    console.log(`[NewsAPI] Returning ${finalArticles.length} articles for "${topic}" (${latest3.length} latest + ${finalArticles.length - latest3.length} best quality)`);
    
    return finalArticles.slice(0, 10);
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

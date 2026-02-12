import { NewsArticle } from './openai';
import { cleanArticleContent, isGarbageDescription } from './utils/articleCleaning';

const CURRENTS_API_KEY = process.env.CURRENTS_API_KEY;
const CURRENTS_API_BASE_URL = 'https://api.currentsapi.services/v1';

// Rate limiting tracking (600 requests per day for free tier)
let requestCount = 0;
let requestResetTime = Date.now() + 24 * 60 * 60 * 1000;

function checkRateLimit(): boolean {
  // Reset counter if 24 hours passed
  if (Date.now() > requestResetTime) {
    requestCount = 0;
    requestResetTime = Date.now() + 24 * 60 * 60 * 1000;
  }

  // Free tier: 600 requests/day
  // Pro tier: 50,000 requests/day
  const limit = process.env.CURRENTS_API_TIER === 'pro' ? 50000 : 600;

  if (requestCount >= limit) {
    console.warn(`[CurrentsAPI] Rate limit reached (${requestCount}/${limit})`);
    return false;
  }

  requestCount++;
  return true;
}

export function getRemainingRequests(): number {
  if (Date.now() > requestResetTime) {
    requestCount = 0;
    requestResetTime = Date.now() + 24 * 60 * 60 * 1000;
  }
  const limit = process.env.CURRENTS_API_TIER === 'pro' ? 50000 : 600;
  return Math.max(0, limit - requestCount);
}

async function fetchNewsFromCurrents(
  topic: string,
  daysBack: number = 1
): Promise<NewsArticle[]> {
  if (!CURRENTS_API_KEY) {
    throw new Error('CURRENTS_API_KEY is not configured');
  }

  if (!checkRateLimit()) {
    throw new Error('CurrentsAPI rate limit exceeded');
  }

  // Calculate date for specified days back (RFC 3339 format required)
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString();

  // Normalize topic - remove periods to avoid API encoding issues (e.g., "U.S." -> "US")
  const normalizedTopic = topic.replace(/\./g, '');

  // Currents API uses 'keywords' for search
  const response = await fetch(
    `${CURRENTS_API_BASE_URL}/search?` +
      `keywords=${encodeURIComponent(normalizedTopic)}&` +
      `start_date=${fromDateStr}&` +
      `language=en&` +
      `page_size=30&` +
      `apiKey=${CURRENTS_API_KEY}`
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('CurrentsAPI rate limit exceeded');
    }
    const errorText = await response.text();
    throw new Error(`CurrentsAPI error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  if (data.status !== 'ok') {
    throw new Error(`CurrentsAPI error: ${data.message || 'Unknown error'}`);
  }

  if (!data.news || data.news.length === 0) {
    return [];
  }

  interface CurrentsArticle {
    url?: string;
    title?: string;
    description?: string;
    published?: string;
    author?: string[];
    domain_url?: string;
  }

  // All articles kept in natural order — preferred source boosting handled in articleScoring.ts
  const articlesToUse = (data.news as CurrentsArticle[]).filter((a) => a.url);

  console.log(`[CurrentsAPI] Using ${articlesToUse.length} articles`);

  // Map Currents API format to our NewsArticle format
  const mappedArticles = articlesToUse
    .map((article: CurrentsArticle) => {
      // Clean up description using shared utility
      const cleanDescription = cleanArticleContent(article.description || '');

      // Reject garbage descriptions so the filter below drops the article
      const description = isGarbageDescription(cleanDescription) ? 'No description' : cleanDescription;

      return {
        title: article.title || 'No title',
        description: description || 'No description',
        url: article.url || '',
        publishedAt: article.published || new Date().toISOString(),
        source: {
          name: article.domain_url || 'Unknown source',
        },
      };
    })
    .filter(
      (article: NewsArticle) =>
        article.title !== 'No title' &&
        article.url &&
        article.description !== 'No description' &&
        article.description.length > 40 // Relaxed filter to allow credible short briefs
    );

  // Deduplicate articles by title similarity
  const deduplicatedArticles: NewsArticle[] = [];
  const seenTitles = new Set<string>();

  for (const article of mappedArticles) {
    // Normalize title for comparison
    const normalizedTitle = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();

    // Check if we've seen a similar title
    let isDuplicate = false;
    for (const seenTitle of seenTitles) {
      if (
        normalizedTitle === seenTitle ||
        (normalizedTitle.length > 20 &&
          seenTitle.includes(normalizedTitle.substring(0, 20))) ||
        (seenTitle.length > 20 &&
          normalizedTitle.includes(seenTitle.substring(0, 20)))
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seenTitles.add(normalizedTitle);
      deduplicatedArticles.push(article);
    }
  }

  // Sort by recency first (newer articles are more relevant)
  const sortedArticles = deduplicatedArticles.sort((a, b) => {
    const dateDiff =
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (Math.abs(dateDiff) > 3600000) {
      // If more than 1 hour difference, prioritize date
      return dateDiff;
    }
    // If similar date, prioritize articles with longer descriptions
    return b.description.length - a.description.length;
  });

  return sortedArticles;
}

export async function fetchNewsForTopicFromCurrents(
  topic: string
): Promise<NewsArticle[]> {
  try {
    console.log(`[CurrentsAPI] Fetching news for "${topic}" from last 24 hours...`);

    // Fetch from last 24 hours (or 48 hours max)
    let articles = await fetchNewsFromCurrents(topic, 1);

    console.log(`[CurrentsAPI] Found ${articles.length} articles for "${topic}"`);

    // If we don't have enough articles, try expanding to 48 hours
    if (articles.length < 3) {
      console.log(`[CurrentsAPI] Only ${articles.length} articles found, expanding to last 48 hours...`);
      articles = await fetchNewsFromCurrents(topic, 2);
      console.log(`[CurrentsAPI] Found ${articles.length} articles from last 48 hours`);
    }

    // Return all articles for merging in newsapi.ts
    return articles;
  } catch (error) {
    console.error(`[CurrentsAPI] Error fetching news for topic "${topic}":`, error);
    throw error; // Re-throw to allow fallback to other sources
  }
}

export async function fetchNewsForMultipleTopicsFromCurrents(
  topics: string[]
): Promise<Record<string, NewsArticle[]>> {
  const results: Record<string, NewsArticle[]> = {};

  // Process topics sequentially with delay to respect rate limits
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    try {
      console.log(`[CurrentsAPI] Fetching news for topic ${i + 1}/${topics.length}: ${topic}`);
      results[topic] = await fetchNewsForTopicFromCurrents(topic);

      // Add small delay between requests (200ms)
      if (i < topics.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CurrentsAPI] Failed to fetch news for topic "${topic}":`, errorMessage);

      // If rate limited, wait longer before continuing
      if (errorMessage.includes('rate limit')) {
        console.log(`[CurrentsAPI] Rate limited, waiting 2 seconds before next request...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      results[topic] = [];
    }
  }

  return results;
}

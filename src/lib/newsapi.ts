import { NewsArticle } from './openai';
import { fetchNewsForTopicFromCurrents, getRemainingRequests } from './currentsapi';
import { getSupabaseAdmin } from './supabase';
import { scoreArticles, selectTopArticles, ScoredArticle } from './articleScoring';
import { rankArticlesEditorially } from './editorialRanking';
import { cleanArticleContent, isGarbageDescription } from './utils/articleCleaning';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

const MIN_REQUIRED = 25;

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

  // Normalize topic - remove periods to avoid API encoding issues (e.g., "U.S." -> "US")
  const normalizedTopic = topic.replace(/\./g, '');

  const response = await fetch(
    `${NEWS_API_BASE_URL}/everything?` +
      `q=${encodeURIComponent(normalizedTopic)}&` +
      `from=${fromDateStr}&` +
      `sortBy=publishedAt&` +
      `language=en&` +
      `pageSize=30&` +
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

  // All articles kept in natural order — preferred source boosting handled in articleScoring.ts
  const articlesToUse = (data.articles as NewsAPIArticle[]).filter((a) => a.url);

  console.log(`[NewsAPI] Using ${articlesToUse.length} articles`);

  // Map and filter articles - prioritize content over description for better context
  const mappedArticles = articlesToUse
    .map((article: NewsAPIArticle) => {
      // Prefer description (usually a complete sentence) over content
      // NewsAPI free tier truncates content at ~200 chars with "[+N chars]" marker,
      // which gets stripped by cleanArticleContent, leaving cut-off text.
      // Description is shorter but complete, giving GPT better context for summaries.
      const textContent = article.description || article.content || '';
      // Clean up content using shared utility
      const cleanContent = cleanArticleContent(textContent);

      // Reject garbage descriptions so the filter below drops the article
      const description = isGarbageDescription(cleanContent) ? 'No description' : cleanContent;

      return {
        title: article.title || 'No title',
        description: description || 'No description',
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
        article.description.length > 40 // Relaxed filter to allow credible short briefs
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

// Cross-source deduplication: title prefix + URL hostname+path match
function deduplicateAcrossSources(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    // Dual-key dedup: normalized title prefix + URL hostname+path
    const titleKey = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim()
      .substring(0, 20);

    let urlKey = '';
    try {
      const parsed = new URL(article.url);
      urlKey = parsed.hostname + parsed.pathname;
    } catch {
      urlKey = article.url;
    }

    const dedupKey = `${titleKey}||${urlKey}`;

    if (!seen.has(dedupKey)) {
      // Also check for title-only matches (different URLs but same story)
      let titleDuplicate = false;
      for (const seenKey of seen) {
        const seenTitle = seenKey.split('||')[0];
        if (titleKey.length > 10 && seenTitle === titleKey) {
          titleDuplicate = true;
          break;
        }
      }

      if (!titleDuplicate) {
        seen.add(dedupKey);
        result.push(article);
      }
    }
  }

  console.log(`[Dedup] Cross-source dedup: ${articles.length} -> ${result.length} articles`);
  return result;
}

// Check if we have fresh cache for a topic (from today's date)
async function checkArticleCache(topic: string): Promise<NewsArticle[] | null> {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    const { data, error } = await supabase
      .from('article_cache')
      .select('articles, created_at, source')
      .eq('topic', topic)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const cacheData = data as { articles: NewsArticle[]; created_at: string; source: string };
    const articles = cacheData.articles;
    console.log(`[Cache] Found today's cache for "${topic}" (${articles.length} articles, source: ${cacheData.source})`);
    return articles;
  } catch (error) {
    console.error(`[Cache] Error checking cache for "${topic}":`, error);
    return null;
  }
}

// Store articles in cache
async function storeArticleCache(
  topic: string,
  articles: NewsArticle[],
  source: string,
  fetchDurationMs?: number
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    await supabase
      .from('article_cache')
      .upsert({
        topic,
        date: today,
        source,
        articles: articles as unknown,
        fetch_duration_ms: fetchDurationMs,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      } as never, {
        onConflict: 'topic,date,source'
      });

    console.log(`[Cache] Stored ${articles.length} articles for "${topic}" (source: ${source})`);
  } catch (error) {
    console.error(`[Cache] Error storing cache for "${topic}":`, error);
    // Don't throw - caching is optional
  }
}

// Fetch stale cache as last resort
async function fetchStaleCache(topic: string): Promise<NewsArticle[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('article_cache')
      .select('articles, created_at, source')
      .eq('topic', topic)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return [];
    }

    const cacheData = data as { articles: NewsArticle[]; created_at: string; source: string };
    const articles = cacheData.articles;
    const age = Math.round((Date.now() - new Date(cacheData.created_at).getTime()) / (1000 * 60 * 60));
    console.log(`[Cache] Using stale cache for "${topic}" (${articles.length} articles, ${age}h old, source: ${cacheData.source})`);
    return articles;
  } catch (error) {
    console.error(`[Cache] Error fetching stale cache for "${topic}":`, error);
    return [];
  }
}

// Multi-source news fetcher with editorial ranking
export async function fetchNewsForTopic(
  topic: string,
  options?: { useCache?: boolean; writeCache?: boolean }
): Promise<NewsArticle[]> {
  const MIN_ARTICLES_NEEDED = 3;
  const { useCache = true, writeCache = true } = options ?? {};

  try {
    // Strategy 0: Check cache first (must be from today's date)
    if (useCache) {
      const cachedArticles = await checkArticleCache(topic);
      if (cachedArticles && cachedArticles.length >= MIN_ARTICLES_NEEDED) {
        return cachedArticles.slice(0, 10);
      }
    }

    const startTime = Date.now();
    let allRawArticles: NewsArticle[] = [];

    // Strategy 1: NewsAPI first (primary source)
    try {
      console.log(`[Multi-Source] Trying NewsAPI for "${topic}"...`);
      const newsApiArticles = await fetchNewsForTopicWithTimeWindow(topic, 1);
      console.log(`[Multi-Source] NewsAPI returned ${newsApiArticles.length} articles for "${topic}"`);
      allRawArticles.push(...newsApiArticles);

      // If not enough from 24h, try 48h
      if (newsApiArticles.length < MIN_ARTICLES_NEEDED) {
        console.log(`[Multi-Source] Only ${newsApiArticles.length} from 24h, trying 48h...`);
        const articles48h = await fetchNewsForTopicWithTimeWindow(topic, 2);
        // Add only new articles from 48h window
        const existingUrls = new Set(allRawArticles.map((a) => a.url));
        const newArticles = articles48h.filter((a) => !existingUrls.has(a.url));
        allRawArticles.push(...newArticles);
      }
    } catch (error) {
      console.error(`[Multi-Source] NewsAPI failed for "${topic}":`, error);
    }

    // Strategy 2: Currents API fallback (or supplement if NewsAPI < MIN_REQUIRED)
    if (allRawArticles.length < MIN_REQUIRED) {
      try {
        console.log(`[Multi-Source] Trying Currents API for "${topic}" (have ${allRawArticles.length} articles)...`);
        const currentsArticles = await fetchNewsForTopicFromCurrents(topic);
        console.log(`[Multi-Source] Currents API returned ${currentsArticles.length} articles for "${topic}"`);
        allRawArticles.push(...currentsArticles);
      } catch (error) {
        console.error(`[Multi-Source] Currents API failed for "${topic}":`, error);
      }
    }

    const fetchDuration = Date.now() - startTime;

    if (allRawArticles.length < MIN_ARTICLES_NEEDED) {
      console.log(`[Multi-Source] Only ${allRawArticles.length} articles total, trying stale cache...`);

      // Strategy 3: Last resort - use stale cache
      if (useCache) {
        const staleArticles = await fetchStaleCache(topic);
        if (staleArticles.length > 0) {
          console.log(`[Multi-Source] Using stale cache: ${staleArticles.length} articles for "${topic}"`);
          return staleArticles.slice(0, 10);
        }
      }

      console.error(`[Multi-Source] All sources failed for "${topic}", returning empty array`);
      return [];
    }

    // Cross-source dedup, then score merged set, select top 25
    const dedupedArticles = deduplicateAcrossSources(allRawArticles);
    const scoredArticles = scoreArticles(dedupedArticles, topic);
    const top25 = selectTopArticles(scoredArticles, 25);

    console.log(`[Multi-Source] Scored ${scoredArticles.length} articles, selected top ${top25.length} for editorial ranking`);

    // Editorial ranking
    const editorialResult = await rankArticlesEditorially(top25, topic);

    // Map editorial results back to full ScoredArticle objects, select top 7
    const editorialUrlOrder = editorialResult.rankedArticles.map((r) => r.url);
    const articlesByUrl = new Map(top25.map((a) => [a.url, a]));
    const editoriallyRanked: ScoredArticle[] = [];

    for (const url of editorialUrlOrder) {
      const article = articlesByUrl.get(url);
      if (article) {
        editoriallyRanked.push(article);
      }
    }

    // Include any articles not in editorial results (fallback completeness)
    for (const article of top25) {
      if (!editorialUrlOrder.includes(article.url)) {
        editoriallyRanked.push(article);
      }
    }

    const finalArticles = editoriallyRanked.slice(0, 7);

    console.log(`[Multi-Source] Final selection: ${finalArticles.length} articles for "${topic}" (editorial fallback: ${editorialResult.fallback})`);

    // Cache final articles
    if (writeCache) {
      await storeArticleCache(topic, finalArticles, editorialResult.fallback ? 'multi-source-deterministic' : 'multi-source-editorial', fetchDuration);
    }

    return finalArticles;
  } catch (error) {
    console.error(`[Multi-Source] Critical error fetching news for topic "${topic}":`, error);
    return [];
  }
}

export async function fetchNewsForMultipleTopics(
  topics: string[]
): Promise<Record<string, NewsArticle[]>> {
  const results: Record<string, NewsArticle[]> = {};

  // Check remaining API quota to determine batch size
  const remainingRequests = getRemainingRequests();
  console.log(`[Multi-Source] Starting parallel fetch for ${topics.length} topics`);
  console.log(`[Multi-Source] Remaining API requests: ${remainingRequests}`);

  // Determine batch size based on remaining quota
  // Each topic may use 1-2 requests (24h fetch, possibly 48h retry)
  const estimatedRequestsPerTopic = 2;
  const safeTopicLimit = Math.floor(remainingRequests / estimatedRequestsPerTopic);
  const baseBatchSize = 5;
  const batchSize = remainingRequests < topics.length * estimatedRequestsPerTopic
    ? Math.max(2, Math.min(baseBatchSize, safeTopicLimit))
    : baseBatchSize;

  console.log(`[Multi-Source] Using batch size: ${batchSize}`);

  // Helper function to process a batch of topics concurrently
  async function processBatch(batchTopics: string[], batchIndex: number, totalBatches: number): Promise<void> {
    console.log(`[Multi-Source] Processing batch ${batchIndex + 1}/${totalBatches}: ${batchTopics.join(', ')}`);

    const batchPromises = batchTopics.map(async (topic, indexInBatch) => {
      // Stagger requests within batch by 100ms to avoid thundering herd
      await new Promise((resolve) => setTimeout(resolve, indexInBatch * 100));

      try {
        const articles = await fetchNewsForTopic(topic);
        return { topic, articles, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Multi-Source] Failed to fetch news for topic "${topic}":`, errorMessage);
        return { topic, articles: [] as NewsArticle[], success: false };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results[result.value.topic] = result.value.articles;
      } else {
        // This shouldn't happen since we catch errors inside, but handle just in case
        console.error(`[Multi-Source] Unexpected batch failure:`, result.reason);
      }
    }
  }

  // Split topics into batches
  const batches: string[][] = [];
  for (let i = 0; i < topics.length; i += batchSize) {
    batches.push(topics.slice(i, i + batchSize));
  }

  // Process batches sequentially with delay between batches
  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i, batches.length);

    // Add 300ms delay between batches to avoid rate limiting
    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // Log summary
  const topicsWithArticles = Object.values(results).filter(articles => articles.length > 0).length;
  const topicsWithoutArticles = topics.length - topicsWithArticles;
  console.log(`[Multi-Source] Completed: ${topicsWithArticles} topics with articles, ${topicsWithoutArticles} topics without`);

  return results;
}

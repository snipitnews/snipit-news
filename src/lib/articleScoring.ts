import { NewsArticle } from './openai';

// Source quality tiers (based on reputation and reliability)
const SOURCE_QUALITY_TIERS = {
  tier1: {
    // Top-tier sources (highly reputable)
    sources: [
      'reuters.com',
      'apnews.com',
      'bbc.com',
      'npr.org',
      'theguardian.com',
      'wsj.com',
      'nytimes.com',
      'washingtonpost.com',
      'economist.com',
      'bloomberg.com',
      'ft.com', // Financial Times
    ],
    score: 1.0,
  },
  tier2: {
    // Reputable sources (good quality)
    sources: [
      'cnn.com',
      'axios.com',
      'politico.com',
      'theatlantic.com',
      'forbes.com',
      'cnbc.com',
      'techcrunch.com',
      'theverge.com',
      'arstechnica.com',
      'wired.com',
      'espn.com',
      'cbssports.com',
      'si.com', // Sports Illustrated
      'nature.com',
      'sciencedaily.com',
    ],
    score: 0.8,
  },
  tier3: {
    // Decent sources (acceptable quality)
    sources: [
      'usatoday.com',
      'latimes.com',
      'chicagotribune.com',
      'huffpost.com',
      'businessinsider.com',
      'marketwatch.com',
      'engadget.com',
      'mashable.com',
      'bleacherreport.com',
    ],
    score: 0.6,
  },
  default: {
    // Unknown sources
    score: 0.4,
  },
};

// Calculate TF-IDF relevance score for keyword matching
function calculateKeywordRelevance(article: NewsArticle, topic: string): number {
  const topicLower = topic.toLowerCase();
  const titleLower = article.title.toLowerCase();
  const descLower = article.description.toLowerCase();

  // Split topic into keywords
  const keywords = topicLower.split(/\s+/).filter((word) => word.length > 2);

  if (keywords.length === 0) {
    return 0.5; // Neutral score if no keywords
  }

  let matchScore = 0;
  const titleWords = titleLower.split(/\s+/);
  const descWords = descLower.split(/\s+/);

  for (const keyword of keywords) {
    // Exact match in title (highest weight)
    if (titleLower.includes(keyword)) {
      matchScore += 3.0;
    }

    // Partial match in title
    const titleMatches = titleWords.filter((word) => word.includes(keyword)).length;
    matchScore += titleMatches * 2.0;

    // Exact match in description
    if (descLower.includes(keyword)) {
      matchScore += 1.0;
    }

    // Partial match in description
    const descMatches = descWords.filter((word) => word.includes(keyword)).length;
    matchScore += descMatches * 0.5;
  }

  // Normalize by number of keywords and total words
  const totalWords = titleWords.length + descWords.length;
  const normalizedScore = Math.min(1.0, matchScore / (keywords.length * 3));

  return normalizedScore;
}

// Calculate recency score (exponential decay from publish time)
function calculateRecencyScore(article: NewsArticle): number {
  try {
    const publishedTime = new Date(article.publishedAt).getTime();
    const now = Date.now();
    const ageInHours = (now - publishedTime) / (1000 * 60 * 60);

    // Exponential decay: articles lose 50% value every 12 hours
    // Score = e^(-age / halfLife)
    const halfLife = 12; // hours
    const score = Math.exp(-ageInHours / halfLife);

    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5; // Neutral score if date parsing fails
  }
}

// Calculate source quality score
function calculateSourceQuality(article: NewsArticle): number {
  const url = article.url.toLowerCase();
  const sourceName = article.source.name.toLowerCase();

  // Check each tier
  for (const tier of [SOURCE_QUALITY_TIERS.tier1, SOURCE_QUALITY_TIERS.tier2, SOURCE_QUALITY_TIERS.tier3]) {
    for (const source of tier.sources) {
      if (url.includes(source) || sourceName.includes(source)) {
        return tier.score;
      }
    }
  }

  return SOURCE_QUALITY_TIERS.default.score;
}

// Calculate uniqueness score (penalize similar articles)
function calculateUniquenessScore(
  article: NewsArticle,
  otherArticles: NewsArticle[]
): number {
  const titleLower = article.title.toLowerCase();
  const titleWords = new Set(titleLower.split(/\s+/).filter((word) => word.length > 3));

  if (titleWords.size === 0) {
    return 0.5;
  }

  let maxSimilarity = 0;

  for (const other of otherArticles) {
    if (other.url === article.url) continue; // Skip self

    const otherTitleLower = other.title.toLowerCase();
    const otherTitleWords = new Set(
      otherTitleLower.split(/\s+/).filter((word) => word.length > 3)
    );

    // Calculate Jaccard similarity
    const intersection = new Set(
      [...titleWords].filter((word) => otherTitleWords.has(word))
    );
    const union = new Set([...titleWords, ...otherTitleWords]);

    const similarity = intersection.size / union.size;
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  // Uniqueness = 1 - similarity (more unique = higher score)
  return 1 - maxSimilarity;
}

// Combined scoring algorithm
export interface ScoredArticle extends NewsArticle {
  relevanceScore: number;
  recencyScore: number;
  sourceQualityScore: number;
  uniquenessScore: number;
  totalScore: number;
}

export function scoreArticles(
  articles: NewsArticle[],
  topic: string
): ScoredArticle[] {
  // Calculate all scores
  const scoredArticles: ScoredArticle[] = articles.map((article) => {
    const relevanceScore = calculateKeywordRelevance(article, topic);
    const recencyScore = calculateRecencyScore(article);
    const sourceQualityScore = calculateSourceQuality(article);

    // Initial uniqueness score (will be updated)
    const uniquenessScore = 1.0;

    // Weighted total score
    // Relevance: 40%, Recency: 30%, Source Quality: 20%, Uniqueness: 10%
    const totalScore =
      relevanceScore * 0.4 +
      recencyScore * 0.3 +
      sourceQualityScore * 0.2 +
      uniquenessScore * 0.1;

    return {
      ...article,
      relevanceScore,
      recencyScore,
      sourceQualityScore,
      uniquenessScore,
      totalScore,
    };
  });

  // Update uniqueness scores (comparing against all other articles)
  for (let i = 0; i < scoredArticles.length; i++) {
    const article = scoredArticles[i];
    const uniquenessScore = calculateUniquenessScore(article, scoredArticles);

    // Recalculate total score with updated uniqueness
    article.uniquenessScore = uniquenessScore;
    article.totalScore =
      article.relevanceScore * 0.4 +
      article.recencyScore * 0.3 +
      article.sourceQualityScore * 0.2 +
      article.uniquenessScore * 0.1;
  }

  // Sort by total score (highest first)
  return scoredArticles.sort((a, b) => b.totalScore - a.totalScore);
}

// Filter and select top articles based on scores
export function selectTopArticles(
  scoredArticles: ScoredArticle[],
  count: number = 10
): NewsArticle[] {
  // Ensure we have at least 3 highly relevant articles (relevance > 0.3)
  const highlyRelevant = scoredArticles.filter((a) => a.relevanceScore > 0.3);
  const lessRelevant = scoredArticles.filter((a) => a.relevanceScore <= 0.3);

  // Take top N from highly relevant, fill remaining from less relevant
  const selectedCount = Math.min(count, scoredArticles.length);
  const fromHighlyRelevant = highlyRelevant.slice(0, selectedCount);
  const remaining = selectedCount - fromHighlyRelevant.length;
  const fromLessRelevant = lessRelevant.slice(0, remaining);

  const selected = [...fromHighlyRelevant, ...fromLessRelevant];

  // Return as NewsArticle (without scores)
  return selected.map(({ relevanceScore, recencyScore, sourceQualityScore, uniquenessScore, totalScore, ...article }) => article);
}

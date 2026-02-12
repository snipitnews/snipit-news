import { NewsArticle } from './openai';
import { getSourcesForTopic } from './newsSources';

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

  // Meaningful short keywords that should NOT be filtered out
  const MEANINGFUL_SHORT_WORDS = new Set([
    'us', 'uk', 'eu', 'ai', 'ev', 'pc', 'nba', 'nfl', 'mlb', 'nhl',
    'ufc', 'f1', 'gp', 'un', 'imf', 'who', 'ipo', 'ceo', 'cto',
  ]);

  // Split topic into keywords, keeping meaningful short words
  const keywords = topicLower.split(/\s+/).filter((word) => word.length > 2 || MEANINGFUL_SHORT_WORDS.has(word));

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
    const halfLife = 24; // hours
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

// Diversity score placeholder (for future clustering)
function calculateDiversityScore(): number {
  return 1.0;
}

// Calculate preferred source boost for topic-specific sources
function calculatePreferredSourceBoost(article: NewsArticle, topic: string): number {
  const preferredSources = getSourcesForTopic(topic);
  const url = article.url.toLowerCase();
  const sourceName = article.source.name.toLowerCase();

  for (const source of preferredSources) {
    if (url.includes(source) || sourceName.includes(source)) {
      return 0.15;
    }
  }

  return 0.0;
}

// Combined scoring algorithm
export interface ScoredArticle extends NewsArticle {
  relevanceScore: number;
  recencyScore: number;
  sourceQualityScore: number;
  diversityScore: number;
  preferredSourceBoost: number;
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
    const diversityScore = calculateDiversityScore();
    const preferredSourceBoost = calculatePreferredSourceBoost(article, topic);

    // Weighted total score: Relevance 45%, Recency 30%, Source Quality 25%
    const totalScore =
      relevanceScore * 0.45 +
      recencyScore * 0.30 +
      sourceQualityScore * 0.25 +
      preferredSourceBoost;

    return {
      ...article,
      relevanceScore,
      recencyScore,
      sourceQualityScore,
      diversityScore,
      preferredSourceBoost,
      totalScore,
    };
  });

  // Sort by total score (highest first)
  return scoredArticles.sort((a, b) => b.totalScore - a.totalScore);
}

// Filter and select top articles based on scores
export function selectTopArticles(
  scoredArticles: ScoredArticle[],
  count: number = 25
): ScoredArticle[] {
  // Ensure we have at least 3 highly relevant articles (relevance > 0.3)
  const highlyRelevant = scoredArticles.filter((a) => a.relevanceScore > 0.3);
  const lessRelevant = scoredArticles.filter((a) => a.relevanceScore <= 0.3);

  // Take top N from highly relevant, fill remaining from less relevant
  const selectedCount = Math.min(count, scoredArticles.length);
  const fromHighlyRelevant = highlyRelevant.slice(0, selectedCount);
  const remaining = selectedCount - fromHighlyRelevant.length;
  const fromLessRelevant = lessRelevant.slice(0, remaining);

  return [...fromHighlyRelevant, ...fromLessRelevant];
}

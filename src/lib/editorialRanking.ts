import { openai } from './openai';
import { ScoredArticle } from './articleScoring';
import { getSupabaseAdmin } from './supabase';

export interface EditorialRankedArticle {
  url: string;
  importanceScore: number;
  reasoning: string;
}

export interface EditorialRankingResult {
  rankedArticles: EditorialRankedArticle[];
  model: string;
  timestamp: string;
  fallback: boolean;
}

const EDITORIAL_MODEL = 'gpt-4o-mini';
const EDITORIAL_TIMEOUT_MS = 30000;

// Check for cached editorial ranking
async function checkEditorialCache(topic: string): Promise<EditorialRankingResult | null> {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('article_cache')
      .select('articles, created_at')
      .eq('topic', topic)
      .eq('date', today)
      .eq('source', 'editorial-ranking')
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const result = (data as { articles: unknown }).articles as EditorialRankingResult;
    console.log(`[Editorial] Cache hit for "${topic}"`);
    return result;
  } catch {
    return null;
  }
}

// Store editorial ranking in cache
async function storeEditorialCache(topic: string, result: EditorialRankingResult): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    await supabase
      .from('article_cache')
      .upsert({
        topic,
        date: today,
        source: 'editorial-ranking',
        articles: result as unknown,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as never, {
        onConflict: 'topic,date,source'
      });

    console.log(`[Editorial] Cached ranking for "${topic}"`);
  } catch (error) {
    console.error(`[Editorial] Error caching ranking for "${topic}":`, error);
  }
}

// Deterministic fallback: scale totalScore (0-1) to importance (1-10)
function deterministicFallback(candidates: ScoredArticle[]): EditorialRankingResult {
  const rankedArticles: EditorialRankedArticle[] = candidates.map((article) => ({
    url: article.url,
    importanceScore: Math.max(1, Math.min(10, Math.round(article.totalScore * 10))),
    reasoning: 'Deterministic score (editorial ranking unavailable)',
  }));

  rankedArticles.sort((a, b) => b.importanceScore - a.importanceScore);

  return {
    rankedArticles,
    model: 'deterministic-fallback',
    timestamp: new Date().toISOString(),
    fallback: true,
  };
}

export async function rankArticlesEditorially(
  candidates: ScoredArticle[],
  topic: string
): Promise<EditorialRankingResult> {
  if (candidates.length === 0) {
    return {
      rankedArticles: [],
      model: 'none',
      timestamp: new Date().toISOString(),
      fallback: true,
    };
  }

  // Check cache first
  const cached = await checkEditorialCache(topic);
  if (cached) {
    return cached;
  }

  // Build article payload for LLM (minimal data to save tokens)
  const articlePayload = candidates.map((a, i) => ({
    index: i,
    title: a.title,
    description: a.description.slice(0, 200),
    source: a.source.name,
    publishedAt: a.publishedAt,
    url: a.url,
    deterministicScore: Math.round(a.totalScore * 100) / 100,
  }));

  const systemPrompt = `You are a senior news editor with 20+ years of experience at a major international newsroom. Your job is to rank news articles by genuine editorial importance for the topic "${topic}".

Exercise independent editorial judgment — do NOT simply mirror the deterministic scores provided. Consider:
- **Significance**: Major policy announcements, breaking developments, and paradigm shifts outrank routine updates
- **Impact breadth**: Stories affecting millions outrank niche developments
- **Novelty**: Genuinely new information outranks rehashed or incremental updates
- **Diversity**: Ensure the top results cover different sub-stories within the topic — avoid clustering multiple articles about the same event
- **Source credibility**: Weight authoritative primary sources over aggregators or opinion pieces

Return a JSON object with a "rankings" array. Each entry must have:
- "url": the article URL (must match exactly from input)
- "importanceScore": integer 1-10 (10 = must-read, 1 = filler)
- "reasoning": one sentence explaining why

Rank ALL provided articles. Output ONLY valid JSON, no markdown fences.`;

  const userPrompt = `Rank these ${articlePayload.length} articles for the topic "${topic}":\n\n${JSON.stringify(articlePayload, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EDITORIAL_TIMEOUT_MS);

    const response = await openai.chat.completions.create({
      model: EDITORIAL_MODEL,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`[Editorial] Empty response from LLM for "${topic}", using fallback`);
      return deterministicFallback(candidates);
    }

    const parsed = JSON.parse(content);
    const rankings: EditorialRankedArticle[] = parsed.rankings;

    if (!Array.isArray(rankings) || rankings.length === 0) {
      console.warn(`[Editorial] Invalid rankings format for "${topic}", using fallback`);
      return deterministicFallback(candidates);
    }

    // Validate and normalize rankings
    const validRankings = rankings
      .filter((r) => r.url && typeof r.importanceScore === 'number')
      .map((r) => ({
        url: r.url,
        importanceScore: Math.max(1, Math.min(10, Math.round(r.importanceScore))),
        reasoning: r.reasoning || '',
      }));

    if (validRankings.length === 0) {
      console.warn(`[Editorial] No valid rankings for "${topic}", using fallback`);
      return deterministicFallback(candidates);
    }

    validRankings.sort((a, b) => b.importanceScore - a.importanceScore);

    const result: EditorialRankingResult = {
      rankedArticles: validRankings,
      model: EDITORIAL_MODEL,
      timestamp: new Date().toISOString(),
      fallback: false,
    };

    console.log(`[Editorial] Ranked ${validRankings.length} articles for "${topic}" via ${EDITORIAL_MODEL}`);

    // Cache the result
    await storeEditorialCache(topic, result);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Editorial] LLM call failed for "${topic}" (${message}), using deterministic fallback`);
    return deterministicFallback(candidates);
  }
}

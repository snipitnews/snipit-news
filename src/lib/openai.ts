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
  const SPORTS_TOPICS = [
    'sports',
    'nba',
    'nfl',
    'mlb',
    'nhl',
    'soccer',
    'la liga',
    'ligue 1',
    'epl',
    'tennis',
    'golf',
    'esports',
    'motorsports',
    'athlete spotlights',
    'recovery and injury prevention',
  ];

  const BUSINESS_TOPICS = [
    'business',
    'business and finance',
    'stock market',
    'startups',
    'corporate news',
    'personal finance tips',
    'investments',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'nfts',
    'economic policies',
    'inflation trends',
    'job market',
    'venture capital',
    'business models',
  ];

  const TECH_TOPICS = [
    'technology',
    'tech',
    'artificial intelligence',
    'ai',
    'startups',
    'gadgets',
    'big tech',
    'software development',
    'blockchain technology',
    'space exploration',
    'cybersecurity',
    'emerging tech trends',
  ];

  const HEALTH_TOPICS = [
    'health',
    'health and wellness',
    'fitness',
    'nutrition',
    'mental health',
    'public health policies',
    'therapy tips',
    'mindfulness',
    'coping mechanisms',
    'stress management',
    'wellness',
  ];

  const POLITICS_TOPICS = [
    'politics',
    'u.s. politics',
    'us politics',
    'global politics',
    'policy updates',
    'elections',
    'legislative news',
    'international law',
    'diplomacy',
    'europe',
    'asia',
    'conflict zones',
    'international relations',
  ];

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

  // First, filter articles by basic relevance (keyword check)
  // This is a quick first pass to remove obviously irrelevant articles
  const topicLower = topic.toLowerCase().trim();
  const isSportsTopic = SPORTS_TOPICS.some((sportsTopic) =>
    topicLower.includes(sportsTopic.toLowerCase())
  );
  const isBusinessTopic = BUSINESS_TOPICS.some((bizTopic) =>
    topicLower.includes(bizTopic.toLowerCase())
  );
  const isTechTopic = TECH_TOPICS.some((techTopic) =>
    topicLower.includes(techTopic.toLowerCase())
  );
  const isHealthTopic = HEALTH_TOPICS.some((healthTopic) =>
    topicLower.includes(healthTopic.toLowerCase())
  );
  const isPoliticsTopic = POLITICS_TOPICS.some((polTopic) =>
    topicLower.includes(polTopic.toLowerCase())
  );
  const topicKeywords = topicLower.split(/\s+/).filter(k => k.length > 2); // Filter out very short words
  const basicRelevanceFiltered = articles.filter((article) => {
    const searchText = `${article.title} ${article.description}`.toLowerCase();
    // For single-word topics, require exact word match (not substring)
    // For multi-word topics, require at least one significant keyword
    if (topicKeywords.length === 1) {
      // Use word boundary matching for single words to avoid false positives
      const word = topicKeywords[0];
      const wordBoundaryRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return wordBoundaryRegex.test(searchText);
    } else {
      // For multi-word topics, require at least one keyword match
      return topicKeywords.some(keyword => {
        const wordBoundaryRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return wordBoundaryRegex.test(searchText);
      });
    }
  });

  // If we have articles after basic filtering, use relevance filtering with OpenAI
  // This provides more accurate filtering but costs API calls
  let relevanceFiltered: NewsArticle[];
  if (basicRelevanceFiltered.length > 5) {
    console.log(`[OpenAI] Filtering ${basicRelevanceFiltered.length} articles for relevance to "${topic}"...`);
    relevanceFiltered = await filterArticlesByRelevance(basicRelevanceFiltered, topic);
  } else {
    // If we have 5 or fewer, skip OpenAI filtering to save API calls
    relevanceFiltered = basicRelevanceFiltered;
  }

  if (relevanceFiltered.length === 0) {
    console.log(`[OpenAI] No relevant articles found for topic: ${topic}`);
    return {
      topic,
      summaries: [],
    };
  }

  // Article selection: Take top articles, prioritizing those with better descriptions (more context)
  // For free tier: take top 7 articles to ensure we can get 3 good summaries
  // For paid tier: take top 7 articles to ensure we can get 4-5 good summaries
  const articlesToTake = isPaid ? 7 : 7;
  
  // Sort articles by description quality (longer = more context) before selecting
  const sortedArticles = [...relevanceFiltered].sort((a, b) => {
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

  const format = (isSportsTopic || isBusinessTopic || isTechTopic || isHealthTopic || isPoliticsTopic) ? 'bullet point' : isPaid ? 'paragraph' : 'bullet point';
  const summaryCount = isSportsTopic
    ? (isPaid ? 5 : 3)
    : isBusinessTopic
      ? (isPaid ? 5 : 3)
      : isTechTopic
        ? (isPaid ? 5 : 3)
        : isHealthTopic
          ? (isPaid ? 5 : 3)
          : isPoliticsTopic
            ? (isPaid ? 5 : 3)
          : isPaid ? 5 : 3; // Exact numbers, not ranges

  // Clear, structured prompt for free tier
  const freeTierInstructions = `For FREE TIER, return 1-3 summaries representing the most relevant and impactful points about "${topic}".
PREFER 3 summaries if enough distinct articles are available, but return 1-2 if that's all that's available.

CRITICAL REQUIREMENTS:
- NO REPETITION: Each point must be DISTINCT and UNIQUE. Do not repeat similar information.
- NO FLUFF: Bullets must be concise, factual, and information-dense. Remove marketing language, filler words, and unnecessary details.
- ACCURACY: Only include information that is directly stated in the articles. Do not infer or speculate.
- RELEVANCE: Prioritize points directly related to "${topic}". If no articles are directly about "${topic}", select the most relevant points from available articles. Only skip articles that mention "${topic}" only in passing or as a minor detail.
- IMPORTANT: You must return at least 1 summary if any articles are provided. Only return empty array if absolutely no articles relate to "${topic}" at all.

Each summary must have:
- A "title" field with the article title that best represents that point (NO duplicate titles)
- A "bullets" array with exactly 1 bullet point (1-2 sentences) that explains that specific point concisely
- The bullet should be detailed and informative, providing key information about that point without fluff
- "url" and "source" fields from the article that best supports that point

The points can come from:
- Different articles (preferred - one article per summary)
- The same article only if it covers multiple DISTINCT important points
- Return 1-3 summaries based on what's available - quality over quantity

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
    }
  ]
}`;

  const sportsFreeInstructions = `You are Snipit, a no-fluff sports news summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style (must follow):
- Each bullet must feel like a complete update, not a headline.
- Write bullets to the point: what happened + key detail + why it matters (standings/playoffs/availability/next game).
- Use scores/stats/records ONLY if explicitly included in the article text provided. Never guess.

Quick Score Add-on (IMPORTANT):
- If an article includes an actual game result with a score, format the start of the bullet as a one-line “quick score” like:
  BOS 118 — NYK 111 (Final) | Tatum 34 pts | Celtics: 8–2 last 10
- Keep it to ONE line, using " | " separators.
- Include: score + status (Final/OT/etc). Add 1 standout stat line and 1 trend (streak/record/standing) ONLY if stated.
- After the quick score line, add a short “so what” clause if needed (1 short sentence max) ONLY if supported by the article.

Selection guidance:
- For league topics (NBA/NFL/etc), prefer:
  - 1–2 quick-score game updates (if scores are available in the provided article text), and
  - 1 bigger storyline (trade/injury/suspension/coach quote/playoff scenario).
- If scores are NOT present in the provided article text, do NOT fake them—just summarize the key development with why it matters.

Output rules:
- "title": short Snipit headline (6–10 words), not the original article headline.
- "bullets": exactly 1 bullet string, up to 3 short sentences (sports can use 3).
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no vague filler (“signals”, “could”) unless directly attributed.
- IMPORTANT: Do NOT invent scores, stats, or records. Only include what is explicitly present in the provided article text.`;

  const sportsPaidInstructions = `You are Snipit, a no-fluff sports news summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style (must follow):
- Each bullet must feel like a complete update, not a headline.
- Write bullets to the point: what happened + key detail + why it matters (standings/playoffs/availability/next game).
- Use scores/stats/records ONLY if explicitly included in the article text provided. Never guess.

Quick Score Add-on (IMPORTANT):
- If an article includes an actual game result with a score, format the start of the bullet as a one-line “quick score” like:
  BOS 118 — NYK 111 (Final) | Tatum 34 pts | Celtics: 8–2 last 10
- Keep it to ONE line, using " | " separators.
- Include: score + status (Final/OT/etc). Add 1 standout stat line and 1 trend (streak/record/standing) ONLY if stated.
- After the quick score line, add a short “so what” clause if needed (1 short sentence max) ONLY if supported by the article.

Selection guidance:
- For league topics (NBA/NFL/etc), prefer:
  - 2–3 quick-score game updates (if scores are available in the provided article text), and
  - 2 bigger storylines (trade/injury/suspension/coach quote/playoff scenario).
- If scores are NOT present in the provided article text, do NOT fake them—just summarize the key development with why it matters.

Output rules:
- "title": short Snipit headline (6–10 words), not the original article headline.
- "bullets": exactly 1 bullet string, up to 3 short sentences (sports can use 3).
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no vague filler (“signals”, “could”) unless directly attributed.
- IMPORTANT: Do NOT invent scores, stats, or records. Only include what is explicitly present in the provided article text.`;

  const businessFreeInstructions = `You are Snipit, a no-fluff business/markets summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- If the article contains price/%/points: include them. If not, do not invent.
- If it’s a stock/crypto move and numbers are present, add an arrow: ↑ (up), ↓ (down), → (flat/mixed).
- Every bullet must include the driver/catalyst (earnings, guidance, rates, regulation, lawsuit, deal, downgrade, etc.).
- Add “so what” in one short clause: what changes for investors/businesses next.

Output rules:
- "title": short Snipit headline (6–10 words).
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No repetition, no generic market clichés.`;

  const businessPaidInstructions = `You are Snipit, a no-fluff business/markets summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- If the article contains price/%/points: include them. If not, do not invent.
- If it’s a stock/crypto move and numbers are present, add an arrow: ↑ (up), ↓ (down), → (flat/mixed).
- Every bullet must include the driver/catalyst (earnings, guidance, rates, regulation, lawsuit, deal, downgrade, etc.).
- Add “so what” in one short clause: what changes for investors/businesses next.

Output rules:
- "title": short Snipit headline (6–10 words).
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No repetition, no generic market clichés.`;

  const techFreeInstructions = `You are Snipit, a no-fluff technology summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Each bullet must give the full picture fast: what changed + who it impacts + why it matters.
- Include 1 concrete detail when available (feature, timeline, pricing, regulation, breach scope), but only if explicitly stated.
- For cybersecurity: state who’s affected + what users/orgs should do next (patch, rotate keys, etc.) if the article provides it.
- Avoid hype words (“game-changing”, “revolutionary”) and avoid speculation unless directly attributed.

Output rules:
- "title": short Snipit headline (6–10 words).
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles.`;

  const techPaidInstructions = `You are Snipit, a no-fluff technology summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must give the full picture fast: what changed + who it impacts + why it matters.
- Include 1 concrete detail when available (feature, timeline, pricing, regulation, breach scope), but only if explicitly stated.
- For cybersecurity: state who’s affected + what users/orgs should do next (patch, rotate keys, etc.) if the article provides it.
- Avoid hype words (“game-changing”, “revolutionary”) and avoid speculation unless directly attributed.

Output rules:
- "title": short Snipit headline (6–10 words).
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles.`;

  const healthFreeInstructions = `You are Snipit, a no-fluff health & wellness summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Prioritize: new guideline changes, major study results, recalls/safety notices, and actionable advice backed by the article.
- Each bullet must include: what happened + what it means for a normal person + what to do next (if the article supports it).
- If it’s research, include study type/phase and the key result ONLY if explicitly stated.
- No medical diagnosis language. No miracle framing.

Output rules:
- "title": short Snipit headline (6–10 words).
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const healthPaidInstructions = `You are Snipit, a no-fluff health & wellness summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: new guideline changes, major study results, recalls/safety notices, and actionable advice backed by the article.
- Each bullet must include: what happened + what it means for a normal person + what to do next (if the article supports it).
- If it’s research, include study type/phase and the key result ONLY if explicitly stated.
- No medical diagnosis language. No miracle framing.

Output rules:
- "title": short Snipit headline (6–10 words).
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const politicsFreeInstructions = `You are Snipit, a no-fluff politics summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Each bullet must give the full picture fast: what happened + what changes + who it affects.
- Include the “why now” driver (vote, court ruling, agency action, diplomatic move, scandal, etc.).
- Include numbers (vote counts, poll numbers, dates) ONLY if explicitly stated in the article text provided. Never guess.
- Avoid speculation unless the article itself frames it as such and you attribute it (“according to…”, “analysts say…”).

Output rules:
- "title": short Snipit headline (6–10 words), not the original article headline.
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no fluff.`;

  const politicsPaidInstructions = `You are Snipit, a no-fluff politics summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must give the full picture fast: what happened + what changes + who it affects.
- Include the “why now” driver (vote, court ruling, agency action, diplomatic move, scandal, etc.).
- Include numbers (vote counts, poll numbers, dates) ONLY if explicitly stated in the article text provided. Never guess.
- Avoid speculation unless the article itself frames it as such and you attribute it (“according to…”, “analysts say…”).

Output rules:
- "title": short Snipit headline (6–10 words), not the original article headline.
- "bullets": exactly 1 bullet string, up to 3 short sentences.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no fluff.`;

  const paidTierInstructions = `For PAID TIER, return 4-5 articles. Each article must have:
- A "title" field with the article title
- A "summary" field with a 2-3 sentence paragraph summary
- "url" and "source" fields`;

  const prompt = `Topic: ${topic}
Format: ${format}

You are summarizing news articles about "${topic}". From the articles below, ${
    isSportsTopic
      ? isPaid
        ? 'apply the PAID sports instructions exactly as written. Focus on 4–5 distinct updates with quick-score lines when scores are provided in the article text, plus key storylines. Do not invent scores or stats.'
        : 'apply the FREE sports instructions exactly as written. Focus on 1–3 distinct updates with quick-score lines when scores are provided in the article text, plus one key storyline. Do not invent scores or stats.'
      : isBusinessTopic
        ? isPaid
          ? 'apply the PAID business/markets instructions exactly as written. Focus on 4–5 distinct updates with catalysts and include price/%/points only when provided. Use arrows for stock/crypto moves when numbers are present. Add a concise "so what" clause.'
          : 'apply the FREE business/markets instructions exactly as written. Focus on 1–3 distinct updates with catalysts and include price/%/points only when provided. Use arrows for stock/crypto moves when numbers are present. Add a concise "so what" clause.'
        : isTechTopic
          ? isPaid
            ? 'apply the PAID technology instructions exactly as written. Focus on 4–5 distinct updates with concrete details only when explicitly stated; include who it impacts and why it matters; for cybersecurity include who is affected and recommended actions if provided. Avoid hype/speculation.'
            : 'apply the FREE technology instructions exactly as written. Focus on 1–3 distinct updates with concrete details only when explicitly stated; include who it impacts and why it matters; for cybersecurity include who is affected and recommended actions if provided. Avoid hype/speculation.'
          : isHealthTopic
            ? isPaid
              ? 'apply the PAID health & wellness instructions exactly as written. Focus on 4–5 distinct updates, prioritizing guidelines, studies, recalls, and actionable advice with what it means for a normal person and what to do next. Include study type/phase and key result only if explicitly stated. No diagnosis language or miracle framing.'
              : 'apply the FREE health & wellness instructions exactly as written. Focus on 1–3 distinct updates, prioritizing guidelines, studies, recalls, and actionable advice with what it means for a normal person and what to do next. Include study type/phase and key result only if explicitly stated. No diagnosis language or miracle framing.'
            : isPoliticsTopic
              ? isPaid
                ? 'apply the PAID politics instructions exactly as written. Focus on 4–5 distinct updates; full picture (what happened + what changes + who it affects); include “why now” drivers; include numbers only if provided; attribute speculation.'
                : 'apply the FREE politics instructions exactly as written. Focus on 1–3 distinct updates; full picture (what happened + what changes + who it affects); include “why now” drivers; include numbers only if provided; attribute speculation.'
              : isPaid
                ? `select the ${summaryCount} most relevant articles and provide concise, no-fluff paragraph summaries for each.`
                : `identify the 3 most relevant and impactful points about "${topic}" based on the articles provided. These 3 points must be DISTINCT, UNIQUE, and directly related to "${topic}". Each point should be substantial, informative, and contain no fluff or repetition.`
  } 

STRICT REQUIREMENTS:
- Prioritize articles that are DIRECTLY and PRIMARILY about "${topic}"
- If articles are available that are directly about "${topic}", use those
- If no articles are directly about "${topic}", select the MOST RELEVANT articles from what's available (articles where "${topic}" is a significant part of the content)
- REJECT articles that only mention "${topic}" in passing or as a minor detail
- NO repetition of information across summaries
- NO duplicate or very similar titles
- NO marketing language, filler words, or fluff - be concise and factual
- Prioritize the most important, impactful, and recent developments
- IMPORTANT: You must return at least 1 summary if any articles are provided. Only return an empty array if absolutely no articles relate to "${topic}" at all

${isSportsTopic
    ? (isPaid ? sportsPaidInstructions : sportsFreeInstructions)
    : isBusinessTopic
      ? (isPaid ? businessPaidInstructions : businessFreeInstructions)
      : isTechTopic
        ? (isPaid ? techPaidInstructions : techFreeInstructions)
        : isHealthTopic
          ? (isPaid ? healthPaidInstructions : healthFreeInstructions)
          : isPoliticsTopic
            ? (isPaid ? politicsPaidInstructions : politicsFreeInstructions)
            : isPaid ? paidTierInstructions : freeTierInstructions}

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

  const MAX_RETRIES = 2; // Reduced retries since we'll accept fewer summaries
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
        {
          role: 'system',
          content: isSportsTopic
            ? isPaid
              ? `You are Snipit, a no-fluff sports news summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid sports instructions: pick 4-5 distinct updates (prefer 5, max 5); concise bullets (what happened + key detail + why it matters); include a quick-score line only when the provided article text contains an actual score; never invent scores, stats, or records; no markdown or code fences.`
              : `You are Snipit, a no-fluff sports news summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free sports instructions: pick 1-3 distinct updates (prefer 3, max 3); concise bullets (what happened + key detail + why it matters); include a quick-score line only when the provided article text contains an actual score; never invent scores, stats, or records; no markdown or code fences.`
            : isBusinessTopic
              ? isPaid
                ? `You are Snipit, a no-fluff business/markets summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid business instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; include price/%/points only if present; add arrows for stock/crypto moves when numbers exist; always include the driver/catalyst; add a concise "so what" clause; no markdown or code fences.`
                : `You are Snipit, a no-fluff business/markets summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free business instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; include price/%/points only if present; add arrows for stock/crypto moves when numbers exist; always include the driver/catalyst; add a concise "so what" clause; no markdown or code fences.`
              : isTechTopic
                ? isPaid
                  ? `You are Snipit, a no-fluff technology summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid technology instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; give the full picture fast (what changed + who it impacts + why it matters); include one concrete detail only if explicitly stated; for cybersecurity, state who’s affected and recommended actions if provided; avoid hype/speculation; no markdown or code fences.`
                  : `You are Snipit, a no-fluff technology summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free technology instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; give the full picture fast (what changed + who it impacts + why it matters); include one concrete detail only if explicitly stated; for cybersecurity, state who’s affected and recommended actions if provided; avoid hype/speculation; no markdown or code fences.`
                : isPaid
                  ? `You are a news summarizer for paid tier. Return ONLY valid JSON with 4-5 articles about "${topic}". Prioritize articles where "${topic}" is the main subject, but if needed, select the most relevant articles available. Each article must have "title", "summary" (2-3 sentences, no fluff), "url", and "source". IMPORTANT: You must return at least 1 summary from the provided articles. Only return empty array if absolutely no articles relate to "${topic}". Ensure no duplicate titles or repeated information. No markdown, no code blocks.`
                  : `You are a news summarizer for free tier. Return ONLY valid JSON with 1-3 summaries (prefer 3, but return 1-2 if that's all available) about "${topic}". Prioritize summaries where "${topic}" is the main subject, but if needed, select the most relevant articles available. Each summary must have "title" (unique, no duplicates), "bullets" (array with exactly 1 string, 1-2 sentences, no fluff), "url", and "source". IMPORTANT: You must return at least 1 summary from the provided articles. Only return empty array if absolutely no articles relate to "${topic}". Ensure all points are DISTINCT and UNIQUE - no repetition. No markdown, no code blocks.`,
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
        // For free tier: prefer 3 summaries, but accept 1-2 if that's all available
        // For paid tier: prefer 4-5 summaries, but accept fewer if needed
        // Sports, Business, Tech, Health, Politics: use bullet format for both tiers; counts differ by tier
        const usePaidFormat = isPaid && !isSportsTopic && !isBusinessTopic && !isTechTopic && !isHealthTopic && !isPoliticsTopic;
        const preferredCount = isSportsTopic
          ? isPaid ? 5 : 3
          : isBusinessTopic
            ? isPaid ? 5 : 3
            : isTechTopic
              ? isPaid ? 5 : 3
              : isHealthTopic
                ? isPaid ? 5 : 3
                : isPoliticsTopic
                  ? isPaid ? 5 : 3
            : usePaidFormat ? 4 : 3;
        const maxCount = isSportsTopic
          ? isPaid ? 5 : 3
          : isBusinessTopic
            ? isPaid ? 5 : 3
            : isTechTopic
              ? isPaid ? 5 : 3
              : isHealthTopic
                ? isPaid ? 5 : 3
                : isPoliticsTopic
                  ? isPaid ? 5 : 3
                  : usePaidFormat ? 5 : 3;
        const minAcceptableCount = 1; // Accept 1 or more summaries
        
        let summaries = parsed.summaries;
        
        // Limit to max count
        summaries = summaries.slice(0, maxCount);
        
        // Validate each summary has required fields
        const validSummaries = summaries.filter((s: any) => {
          if (!s || typeof s !== 'object' || !s.title || !s.url || !s.source) {
            console.warn(`[OpenAI] Invalid summary structure: missing required fields`, s);
            return false;
          }
          
          if (!usePaidFormat) {
            // Bulleted format (free tier or sports): MUST have bullets array with at least 1 item
            if (!s.bullets || !Array.isArray(s.bullets)) {
              console.warn(`[OpenAI] Bulleted summary missing bullets array:`, s.title);
              return false;
            }
            if (s.bullets.length < 1) {
              console.warn(`[OpenAI] Bulleted summary has no bullets:`, s.title);
              return false;
            }
            // Ensure all bullets are non-empty strings
            const validBullets = s.bullets.filter((b: string) => typeof b === 'string' && b.trim().length > 0);
            if (validBullets.length < 1) {
              console.warn(`[OpenAI] Bulleted summary has invalid bullets:`, s.title);
              return false;
            }
            // Keep all valid bullets (can be 1 or more)
            s.bullets = validBullets;
            return true;
          } else {
            // Paid paragraph format: MUST have summary field
            if (!s.summary || typeof s.summary !== 'string' || s.summary.trim().length === 0) {
              console.warn(`[OpenAI] Paid tier summary missing summary field:`, s.title);
              return false;
            }
            return true;
          }
        });
        
        // Accept summaries if we have at least 1, but prefer the preferred count
        if (validSummaries.length === 0) {
          throw new Error('All summaries are missing required fields');
        }
        
        // If we have fewer than preferred, log a warning but continue (don't retry)
        if (validSummaries.length < preferredCount) {
          console.warn(`[OpenAI] Only ${validSummaries.length} valid summaries for "${topic}" (preferred: ${preferredCount}). Using available summaries.`);
        } else {
          console.log(`[OpenAI] Successfully parsed ${validSummaries.length} summaries for topic: ${topic}`);
        }
        
        // Post-processing: Deduplicate titles and bullets to ensure uniqueness
        const deduplicatedSummaries = deduplicateSummaries(validSummaries, usePaidFormat);
        
        // Use deduplicated summaries (even if fewer than preferred)
        const finalSummaries = deduplicatedSummaries.length > 0 
          ? deduplicatedSummaries 
          : validSummaries;
        
        if (deduplicatedSummaries.length < validSummaries.length) {
          console.log(`[OpenAI] Deduplication removed ${validSummaries.length - deduplicatedSummaries.length} duplicate summaries`);
        }
        
        // If we still have summaries after deduplication, use them (even if < 3)
        if (finalSummaries.length >= minAcceptableCount) {
        
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
        }
      } else {
        // If summaries array is empty, log the articles that were provided for debugging
        if (parsed.summaries && Array.isArray(parsed.summaries) && parsed.summaries.length === 0) {
          console.warn(`[OpenAI] OpenAI returned empty summaries array for topic: "${topic}"`);
          console.log(`[OpenAI] Articles provided to OpenAI (${articlesToSummarize.length}):`, 
            articlesToSummarize.map(a => ({ title: a.title.substring(0, 100), url: a.url }))
          );
          
          // If we haven't exceeded max retries and we have articles, retry with a less strict approach
          if (retries < MAX_RETRIES && articlesToSummarize.length > 0) {
            retries++; // Increment retry counter
            console.log(`[OpenAI] Retrying with less strict relevance requirements... (attempt ${retries}/${MAX_RETRIES})`);
            // Add a small delay before retrying
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue; // Retry the loop
          } else {
            // Max retries reached or no articles - break out and use fallback
            console.warn(`[OpenAI] Max retries reached or no articles available for "${topic}" - will use fallback`);
            break;
          }
        }
        
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
  // Only use fallback if we have articles but OpenAI failed
  if (articlesToSummarize.length === 0) {
    console.log(`[OpenAI] No articles available for ${topic} - returning empty summaries`);
    return {
      topic,
      summaries: [],
    };
  }

  console.log(`[OpenAI] Using fallback summaries for topic: ${topic}`);
  // Use top 3 latest articles (as per user requirement)
  const articlesToUse = articlesToSummarize.slice(0, 3);
  
  let fallbackResult: NewsSummary;
  
  if (isPaid) {
    // Paid tier fallback: paragraph summaries from top 3 articles
    fallbackResult = {
      topic,
      summaries: articlesToUse.map((article) => ({
        title: article.title,
        summary: article.description 
          ? (article.description.length > 300 
              ? article.description.substring(0, 300).trim() + '...' 
              : article.description.trim())
          : 'No description available',
        url: article.url,
        source: article.source.name,
      })),
    };
  } else {
    // Free tier fallback: create summaries from top 3 articles
    // Use each article as a separate summary with its description as a bullet
    fallbackResult = {
      topic,
      summaries: articlesToUse.map((article) => ({
        title: article.title,
        bullets: [article.description.length > 200 
          ? article.description.substring(0, 200).trim() + '...' 
          : article.description.trim()],
        summary: article.description.length > 200 
          ? article.description.substring(0, 200).trim() + '...' 
          : article.description.trim(),
        url: article.url,
        source: article.source.name,
      })),
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

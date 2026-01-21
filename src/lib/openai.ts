import OpenAI from 'openai';
import { getSupabaseAdmin } from './supabase';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// TOPIC CONFIGURATION
// ============================================================================
// Configuration-driven approach for topic detection and prompt generation

interface TopicConfig {
  keywords: string[];
  freeInstructions: string;
  paidInstructions: string;
  freeSystemPrompt: string;
  paidSystemPrompt: string;
  promptDescription: {
    free: string;
    paid: string;
  };
}

type TopicCategory =
  | 'sports' | 'business' | 'tech' | 'health' | 'politics'
  | 'worldNews' | 'science' | 'environment' | 'lifestyle'
  | 'education' | 'food' | 'gaming' | 'culture' | 'parenting'
  | 'automotive' | 'career' | 'adventure' | 'personalDevelopment'
  | 'default';

// Helper to detect topic category from user's topic string
function detectTopicCategory(topic: string): TopicCategory {
  const topicLower = topic.toLowerCase();

  for (const [category, config] of Object.entries(TOPIC_CONFIGS)) {
    if (category === 'default') continue;
    if (config.keywords.some(k => topicLower.includes(k.toLowerCase()))) {
      return category as TopicCategory;
    }
  }
  return 'default';
}

// Get the appropriate config for a topic
function getTopicConfig(topic: string): TopicConfig {
  const category = detectTopicCategory(topic);
  return TOPIC_CONFIGS[category];
}

// Topic configurations with keywords and instructions
const TOPIC_CONFIGS: Record<TopicCategory, TopicConfig> = {
  sports: {
    keywords: [
      'sports', 'nba', 'nfl', 'mlb', 'nhl', 'soccer', 'la liga', 'ligue 1',
      'epl', 'tennis', 'golf', 'esports', 'motorsports', 'athlete spotlights',
      'recovery and injury prevention'
    ],
    freeInstructions: `You are Snipit, a no-fluff sports news summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style (must follow):
- Each bullet must feel like a complete update, not a headline.
- Write bullets to the point: what happened + key detail + why it matters (standings/playoffs/availability/next game).
- Use scores/stats/records ONLY if explicitly included in the article text provided. Never guess.

Quick Score Add-on (IMPORTANT):
- If an article includes an actual game result with a score, format the start of the bullet as a one-line "quick score" like:
  BOS 118 — NYK 111 (Final) | Tatum 34 pts | Celtics: 8–2 last 10
- Keep it to ONE line, using " | " separators.
- Include: score + status (Final/OT/etc). Add 1 standout stat line and 1 trend (streak/record/standing) ONLY if stated.
- After the quick score line, add a short "so what" clause if needed (1 short sentence max) ONLY if supported by the article.

Selection guidance:
- For league topics (NBA/NFL/etc), prefer:
  - 1–2 quick-score game updates (if scores are available in the provided article text), and
  - 1 bigger storyline (trade/injury/suspension/coach quote/playoff scenario).
- If scores are NOT present in the provided article text, do NOT fake them—just summarize the key development with why it matters.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no vague filler ("signals", "could") unless directly attributed.
- IMPORTANT: Do NOT invent scores, stats, or records. Only include what is explicitly present in the provided article text.`,
    paidInstructions: `You are Snipit, a no-fluff sports news summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style (must follow):
- Each bullet must feel like a complete update, not a headline.
- Write bullets to the point: what happened + key detail + why it matters (standings/playoffs/availability/next game).
- Use scores/stats/records ONLY if explicitly included in the article text provided. Never guess.

Quick Score Add-on (IMPORTANT):
- If an article includes an actual game result with a score, format the start of the bullet as a one-line "quick score" like:
  BOS 118 — NYK 111 (Final) | Tatum 34 pts | Celtics: 8–2 last 10
- Keep it to ONE line, using " | " separators.
- Include: score + status (Final/OT/etc). Add 1 standout stat line and 1 trend (streak/record/standing) ONLY if stated.
- After the quick score line, add a short "so what" clause if needed (1 short sentence max) ONLY if supported by the article.

Selection guidance:
- For league topics (NBA/NFL/etc), prefer:
  - All quick-score game updates (if scores are available in the provided article text), and
  - 2 bigger storylines (trade/injury/suspension/coach quote/playoff scenario).
  - Interesting facts/statements that relate to that topic within the article.
  - Ideally getting to the point when outputting that statement/fact, no fluff repetitive verbiage.
- If scores are NOT present in the provided article text, do NOT fake them—just summarize the key development with why it matters.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no vague filler ("signals", "could") unless directly attributed.
- IMPORTANT: Do NOT invent scores, stats, or records. Only include what is explicitly present in the provided article text.`,
    freeSystemPrompt: `You are Snipit, a no-fluff sports news summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free sports instructions: pick 1-3 distinct updates (prefer 3, max 3); concise bullets (what happened + key detail + why it matters); include a quick-score line only when the provided article text contains an actual score; never invent scores, stats, or records; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff sports news summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid sports instructions: pick 4-5 distinct updates (prefer 5, max 5); concise bullets (what happened + key detail + why it matters); include a quick-score line only when the provided article text contains an actual score; never invent scores, stats, or records; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE sports instructions exactly as written. Focus on 1–3 distinct updates with quick-score lines when scores are provided in the article text, plus one key storyline. Do not invent scores or stats.',
      paid: 'apply the PAID sports instructions exactly as written. Focus on 4–5 distinct updates with quick-score lines when scores are provided in the article text, plus key storylines. Do not invent scores or stats.'
    }
  },
  business: {
    keywords: [
      'business', 'business and finance', 'stock market', 'startups', 'corporate news',
      'personal finance tips', 'investments', 'cryptocurrency', 'bitcoin', 'ethereum',
      'nfts', 'economic policies', 'inflation trends', 'job market', 'venture capital',
      'business models'
    ],
    freeInstructions: `You are Snipit, a no-fluff business/markets summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- If the article contains price/%/points: include them. If not, do not invent.
- If it's a stock/crypto move and numbers are present, add an arrow: ↑ (up), ↓ (down), → (flat/mixed).
- Every bullet must include the driver/catalyst (earnings, guidance, rates, regulation, lawsuit, deal, downgrade, etc.).
- Add "so what" in one short clause: what changes for investors/businesses next.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition, no generic market clichés.`,
    paidInstructions: `You are Snipit, a no-fluff business/markets summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- If the article contains price/%/points: include them. If not, do not invent.
- If it's a stock/crypto move and numbers are present, add an arrow: ↑ (up), ↓ (down), → (flat/mixed).
- Every bullet must include the driver/catalyst (earnings, guidance, rates, regulation, lawsuit, deal, downgrade, etc.).
- Add "so what" in one short clause: what changes for investors/businesses next.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition, no generic market clichés.`,
    freeSystemPrompt: `You are Snipit, a no-fluff business/markets summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free business instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; include price/%/points only if present; add arrows for stock/crypto moves when numbers exist; always include the driver/catalyst; add a concise "so what" clause; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff business/markets summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid business instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; include price/%/points only if present; add arrows for stock/crypto moves when numbers exist; always include the driver/catalyst; add a concise "so what" clause; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE business/markets instructions exactly as written. Focus on 1–3 distinct updates with catalysts and include price/%/points only when provided. Use arrows for stock/crypto moves when numbers are present. Add a concise "so what" clause.',
      paid: 'apply the PAID business/markets instructions exactly as written. Focus on 4–5 distinct updates with catalysts and include price/%/points only when provided. Use arrows for stock/crypto moves when numbers are present. Add a concise "so what" clause.'
    }
  },
  tech: {
    keywords: [
      'technology', 'tech', 'artificial intelligence', 'ai', 'gadgets', 'big tech',
      'software development', 'blockchain technology', 'space exploration',
      'cybersecurity', 'emerging tech trends'
    ],
    freeInstructions: `You are Snipit, a no-fluff technology summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Each bullet must give the full picture fast: what changed + who it impacts + why it matters.
- Include 1 concrete detail when available (feature, timeline, pricing, regulation, breach scope), but only if explicitly stated.
- For cybersecurity: state who's affected + what users/orgs should do next (patch, rotate keys, etc.) if the article provides it.
- Avoid hype words ("game-changing", "revolutionary") and avoid speculation unless directly attributed.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles.`,
    paidInstructions: `You are Snipit, a no-fluff technology summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must give the full picture fast: what changed + who it impacts + why it matters.
- Include 1 concrete detail when available (feature, timeline, pricing, regulation, breach scope), but only if explicitly stated.
- For cybersecurity: state who's affected + what users/orgs should do next (patch, rotate keys, etc.) if the article provides it.
- Avoid hype words ("game-changing", "revolutionary") and avoid speculation unless directly attributed.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles.`,
    freeSystemPrompt: `You are Snipit, a no-fluff technology summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free technology instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; give the full picture fast (what changed + who it impacts + why it matters); include one concrete detail only if explicitly stated; for cybersecurity, state who's affected and recommended actions if provided; avoid hype/speculation; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff technology summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid technology instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; give the full picture fast (what changed + who it impacts + why it matters); include one concrete detail only if explicitly stated; for cybersecurity, state who's affected and recommended actions if provided; avoid hype/speculation; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE technology instructions exactly as written. Focus on 1–3 distinct updates with concrete details only when explicitly stated; include who it impacts and why it matters; for cybersecurity include who is affected and recommended actions if provided. Avoid hype/speculation.',
      paid: 'apply the PAID technology instructions exactly as written. Focus on 4–5 distinct updates with concrete details only when explicitly stated; include who it impacts and why it matters; for cybersecurity include who is affected and recommended actions if provided. Avoid hype/speculation.'
    }
  },
  health: {
    keywords: [
      'health', 'health and wellness', 'fitness', 'nutrition', 'mental health',
      'public health policies', 'therapy tips', 'mindfulness', 'coping mechanisms',
      'stress management', 'wellness'
    ],
    freeInstructions: `You are Snipit, a no-fluff health & wellness summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Prioritize: new guideline changes, major study results, recalls/safety notices, and actionable advice backed by the article.
- Each bullet must include: what happened + what it means for a normal person + what to do next (if the article supports it).
- If it's research, include study type/phase and the key result ONLY if explicitly stated.
- No medical diagnosis language. No miracle framing.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff health & wellness summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: new guideline changes, major study results, recalls/safety notices, and actionable advice backed by the article.
- Each bullet must include: what happened + what it means for a normal person + what to do next (if the article supports it).
- If it's research, include study type/phase and the key result ONLY if explicitly stated.
- No medical diagnosis language. No miracle framing.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff health & wellness summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free health instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize guidelines, studies, recalls, actionable advice; include what it means for a normal person and what to do next; include study type/phase and key result only if explicitly stated; no diagnosis language or miracle framing; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff health & wellness summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid health instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize guidelines, studies, recalls, actionable advice; include what it means for a normal person and what to do next; include study type/phase and key result only if explicitly stated; no diagnosis language or miracle framing; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE health & wellness instructions exactly as written. Focus on 1–3 distinct updates, prioritizing guidelines, studies, recalls, and actionable advice with what it means for a normal person and what to do next. Include study type/phase and key result only if explicitly stated. No diagnosis language or miracle framing.',
      paid: 'apply the PAID health & wellness instructions exactly as written. Focus on 4–5 distinct updates, prioritizing guidelines, studies, recalls, and actionable advice with what it means for a normal person and what to do next. Include study type/phase and key result only if explicitly stated. No diagnosis language or miracle framing.'
    }
  },
  politics: {
    keywords: [
      'politics', 'u.s. politics', 'us politics', 'global politics', 'policy updates',
      'elections', 'legislative news', 'international law', 'diplomacy'
    ],
    freeInstructions: `You are Snipit, a no-fluff politics summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Each bullet must give the full picture fast: what happened + what changes + who it affects.
- Include the "why now" driver (vote, court ruling, agency action, diplomatic move, scandal, etc.).
- Include numbers (vote counts, poll numbers, dates) ONLY if explicitly stated in the article text provided. Never guess.
- Avoid speculation unless the article itself frames it as such and you attribute it ("according to…", "analysts say…").

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no fluff.`,
    paidInstructions: `You are Snipit, a no-fluff politics summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must give the full picture fast: what happened + what changes + who it affects.
- Include the "why now" driver (vote, court ruling, agency action, diplomatic move, scandal, etc.).
- Include numbers (vote counts, poll numbers, dates) ONLY if explicitly stated in the article text provided. Never guess.
- Avoid speculation unless the article itself frames it as such and you attribute it ("according to…", "analysts say…").

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no fluff.`,
    freeSystemPrompt: `You are Snipit, a no-fluff politics summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free politics instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff politics summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid politics instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE politics instructions exactly as written. Focus on 1–3 distinct updates; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation.',
      paid: 'apply the PAID politics instructions exactly as written. Focus on 4–5 distinct updates; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation.'
    }
  },
  worldNews: {
    keywords: [
      'world news', 'regional news', 'europe', 'asia', 'africa', 'global events',
      'conflict zones', 'international relations'
    ],
    freeInstructions: `You are Snipit, a no-fluff world news summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Bullets must answer: what happened + where + why it matters globally.
- Prioritize: conflict escalations/de-escalations, major elections, sanctions, diplomacy, disasters, major economic shocks.
- Include concrete details (locations, key actors, dates, casualties/aid figures) ONLY if explicitly stated in the article text.
- Do not editorialize or take sides; stick to verified facts in the article.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff world news summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must answer: what happened + where + why it matters globally.
- Prioritize: conflict escalations/de-escalations, major elections, sanctions, diplomacy, disasters, major economic shocks.
- Include concrete details (locations, key actors, dates, casualties/aid figures) ONLY if explicitly stated in the article text.
- Do not editorialize or take sides; stick to verified facts in the article.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff world news summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free world news instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff world news summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid world news instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE world news instructions exactly as written. Focus on 1–3 distinct updates; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing.',
      paid: 'apply the PAID world news instructions exactly as written. Focus on 4–5 distinct updates; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing.'
    }
  },
  science: {
    keywords: [
      'science', 'medical research', 'environmental science', 'astronomy',
      'nasa missions', 'scientific discoveries'
    ],
    freeInstructions: `You are Snipit, a no-fluff science summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Each bullet must include: what was discovered/announced + what's new + why it matters (real-world impact or next milestone).
- If it's medical research, include study type/phase and the key finding ONLY if explicitly stated.
- If it's space/astronomy, include the milestone and next step (launch, test, data release) if stated.
- No hype; no "breakthrough" language unless the article uses it and supports it with specifics.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff science summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must include: what was discovered/announced + what's new + why it matters (real-world impact or next milestone).
- If it's medical research, include study type/phase and the key finding ONLY if explicitly stated.
- If it's space/astronomy, include the milestone and next step (launch, test, data release) if stated.
- No hype; no "breakthrough" language unless the article uses it and supports it with specifics.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff science summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free science instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; include what was discovered/announced + what's new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff science summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid science instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; include what was discovered/announced + what's new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE science instructions exactly as written. Focus on 1–3 distinct updates; include what was discovered/announced + what\'s new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics.',
      paid: 'apply the PAID science instructions exactly as written. Focus on 4–5 distinct updates; include what was discovered/announced + what\'s new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics.'
    }
  },
  environment: {
    keywords: [
      'environment', 'climate change', 'renewable energy', 'wildlife conservation',
      'marine conservation', 'eco-tourism', 'sustainable agriculture', 'climate'
    ],
    freeInstructions: `You are Snipit, a no-fluff environment/climate summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Bullets must cover: what happened + what's driving it + what changes next (policy, cost, risks, timelines).
- Prioritize: major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through.
- Include metrics (temperatures, emissions, costs, targets, acres, adoption rates) ONLY if explicitly stated in the article text.
- Avoid vague "awareness" stories unless there's a clear action or consequence.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff environment/climate summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must cover: what happened + what's driving it + what changes next (policy, cost, risks, timelines).
- Prioritize: major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through.
- Include metrics (temperatures, emissions, costs, targets, acres, adoption rates) ONLY if explicitly stated in the article text.
- Avoid vague "awareness" stories unless there's a clear action or consequence.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff environment/climate summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free environment instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; cover what happened + what's driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there's a clear action or consequence; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff environment/climate summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid environment instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; cover what happened + what's driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there's a clear action or consequence; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE environment/climate instructions exactly as written. Focus on 1–3 distinct updates; cover what happened + what\'s driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there\'s a clear action or consequence.',
      paid: 'apply the PAID environment/climate instructions exactly as written. Focus on 4–5 distinct updates; cover what happened + what\'s driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there\'s a clear action or consequence.'
    }
  },
  lifestyle: {
    keywords: [
      'lifestyle', 'lifestyle and luxury', 'luxury', 'high-end fashion', 'home decor',
      'travel', 'exclusive destinations', 'fine dining', 'watches', 'skincare',
      'sustainable living'
    ],
    freeInstructions: `You are Snipit, a no-fluff lifestyle/luxury summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Focus on changes that affect real decisions: launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics.
- Every bullet must include a concrete detail (brand/product/place/date/feature) ONLY if explicitly stated.
- Avoid vague trend talk; make it specific: what it is + why it's popular + who it's for.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff lifestyle/luxury summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Focus on changes that affect real decisions: launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics.
- Every bullet must include a concrete detail (brand/product/place/date/feature) ONLY if explicitly stated.
- Avoid vague trend talk; make it specific: what it is + why it's popular + who it's for.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff lifestyle/luxury summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free lifestyle instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it's popular + who it's for; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff lifestyle/luxury summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid lifestyle instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it's popular + who it's for; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE lifestyle/luxury instructions exactly as written. Focus on 1–3 distinct updates; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what\'s in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it\'s popular + who it\'s for.',
      paid: 'apply the PAID lifestyle/luxury instructions exactly as written. Focus on 4–5 distinct updates; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what\'s in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it\'s popular + who it\'s for.'
    }
  },
  education: {
    keywords: [
      'education', 'higher education', 'online learning', 'trends in education',
      'edtech innovations', 'virtual reality in education', 'edtech'
    ],
    freeInstructions: `You are Snipit, a no-fluff education summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Bullets must answer: what changed + who it affects (students/teachers/parents) + what's next.
- Prioritize: policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules.
- Include figures (budgets, enrollment, outcomes) ONLY if explicitly stated in the article text.
- Avoid generic "education is changing" commentary.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff education summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must answer: what changed + who it affects (students/teachers/parents) + what's next.
- Prioritize: policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules.
- Include figures (budgets, enrollment, outcomes) ONLY if explicitly stated in the article text.
- Avoid generic "education is changing" commentary.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff education summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free education instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; answer what changed + who it affects (students/teachers/parents) + what's next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff education summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid education instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; answer what changed + who it affects (students/teachers/parents) + what's next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE education instructions exactly as written. Focus on 1–3 distinct updates; answer what changed + who it affects (students/teachers/parents) + what\'s next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary.',
      paid: 'apply the PAID education instructions exactly as written. Focus on 4–5 distinct updates; answer what changed + who it affects (students/teachers/parents) + what\'s next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary.'
    }
  },
  food: {
    keywords: ['food', 'recipes', 'restaurant reviews', 'food trends', 'fine dining'],
    freeInstructions: `You are Snipit, a no-fluff food summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Make it usable: what's new + what to try + why it's trending (or why it matters).
- Prioritize: notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories.
- Include specific dish/restaurant/city/ingredient details ONLY if explicitly stated in the article text.
- Avoid filler like "foodies are excited" unless the article provides a real reason.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff food summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Make it usable: what's new + what to try + why it's trending (or why it matters).
- Prioritize: notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories.
- Include specific dish/restaurant/city/ingredient details ONLY if explicitly stated in the article text.
- Avoid filler like "foodies are excited" unless the article provides a real reason.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff food summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free food instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; make it usable: what's new + what to try + why it's trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff food summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid food instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; make it usable: what's new + what to try + why it's trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE food instructions exactly as written. Focus on 1–3 distinct updates; make it usable: what\'s new + what to try + why it\'s trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason.',
      paid: 'apply the PAID food instructions exactly as written. Focus on 4–5 distinct updates; make it usable: what\'s new + what to try + why it\'s trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason.'
    }
  },
  gaming: {
    keywords: [
      'gaming', 'game releases', 'console updates', 'pc gaming', 'video games',
      'gaming news'
    ],
    freeInstructions: `You are Snipit, a no-fluff gaming summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize: major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results.
- If esports: include result/score/prize ONLY if explicitly stated in the article text; never guess.
- If game updates: include what changed and what it means for players (meta, balance, progression) in plain terms.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff gaming summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results.
- If esports: include result/score/prize ONLY if explicitly stated in the article text; never guess.
- If game updates: include what changed and what it means for players (meta, balance, progression) in plain terms.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff gaming summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free gaming instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff gaming summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid gaming instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE gaming instructions exactly as written. Focus on 1–3 distinct updates; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms.',
      paid: 'apply the PAID gaming instructions exactly as written. Focus on 4–5 distinct updates; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms.'
    }
  },
  culture: {
    keywords: [
      'culture', 'art', 'painting', 'graphic design', 'sculpture', 'architecture',
      'history', 'literature', 'books', 'heritage', 'cultural'
    ],
    freeInstructions: `You are Snipit, a no-fluff culture summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Keep it substantive: what happened + the cultural significance + what changes next.
- Prioritize: major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases).
- Include specific names/places/dates ONLY if explicitly stated in the article text.
- Avoid abstract opinion pieces unless there's a concrete news hook.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff culture summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Keep it substantive: what happened + the cultural significance + what changes next.
- Prioritize: major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases).
- Include specific names/places/dates ONLY if explicitly stated in the article text.
- Avoid abstract opinion pieces unless there's a concrete news hook.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff culture summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free culture instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there's a concrete news hook; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff culture summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid culture instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there's a concrete news hook; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE culture instructions exactly as written. Focus on 1–3 distinct updates; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there\'s a concrete news hook.',
      paid: 'apply the PAID culture instructions exactly as written. Focus on 4–5 distinct updates; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there\'s a concrete news hook.'
    }
  },
  parenting: {
    keywords: [
      'parenting', 'parenting and family', 'family', 'parenting tips', 'child development',
      'work-life balance', 'family health', 'teen trends', 'children', 'kids'
    ],
    freeInstructions: `You are Snipit, a no-fluff parenting/family summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize practical, credible updates: child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics.
- Each bullet must include: what's the takeaway + what a parent should do/know next (only if the article supports it).
- Avoid medical diagnosis language and avoid fear-mongering.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff parenting/family summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize practical, credible updates: child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics.
- Each bullet must include: what's the takeaway + what a parent should do/know next (only if the article supports it).
- Avoid medical diagnosis language and avoid fear-mongering.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff parenting/family summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free parenting instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what's the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff parenting/family summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid parenting instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what's the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE parenting/family instructions exactly as written. Focus on 1–3 distinct updates; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what\'s the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering.',
      paid: 'apply the PAID parenting/family instructions exactly as written. Focus on 4–5 distinct updates; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what\'s the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering.'
    }
  },
  automotive: {
    keywords: [
      'automotive', 'electric vehicles', 'car reviews', 'auto industry news',
      'drones in transportation', 'cars', 'vehicles', 'ev', 'electric cars',
      'autonomous vehicles'
    ],
    freeInstructions: `You are Snipit, a no-fluff automotive summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Bullets must include: what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety).
- Prioritize: EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates.
- Include specs (range, price, horsepower, charging time) ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff automotive summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must include: what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety).
- Prioritize: EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates.
- Include specs (range, price, horsepower, charging time) ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff automotive summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free automotive instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff automotive summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid automotive instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE automotive instructions exactly as written. Focus on 1–3 distinct updates; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated.',
      paid: 'apply the PAID automotive instructions exactly as written. Focus on 4–5 distinct updates; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated.'
    }
  },
  career: {
    keywords: [
      'career', 'career and professional development', 'professional development',
      'resume tips', 'networking', 'industry trends', 'remote work',
      'career growth strategies', 'work culture', 'jobs', 'hiring', 'workplace'
    ],
    freeInstructions: `You are Snipit, a no-fluff career summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize: hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics.
- Each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article.
- Include numbers (layoffs, wage data, openings) ONLY if explicitly stated.
- Avoid generic motivation content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff career summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics.
- Each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article.
- Include numbers (layoffs, wage data, openings) ONLY if explicitly stated.
- Avoid generic motivation content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff career summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free career instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff career summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid career instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE career instructions exactly as written. Focus on 1–3 distinct updates; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content.',
      paid: 'apply the PAID career instructions exactly as written. Focus on 4–5 distinct updates; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content.'
    }
  },
  adventure: {
    keywords: [
      'adventure', 'adventure and outdoor activities', 'outdoor activities', 'hiking',
      'camping', 'climbing', 'outdoor', 'outdoors', 'parks', 'trails',
      'mountaineering', 'backpacking'
    ],
    freeInstructions: `You are Snipit, a no-fluff adventure/outdoors summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize: park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events.
- Make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated.
- Include specific locations, dates, difficulty, costs ONLY if explicitly stated in the article text.
- Avoid vague inspiration content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff adventure/outdoors summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events.
- Make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated.
- Include specific locations, dates, difficulty, costs ONLY if explicitly stated in the article text.
- Avoid vague inspiration content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff adventure/outdoors summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free adventure instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff adventure/outdoors summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid adventure instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE adventure/outdoors instructions exactly as written. Focus on 1–3 distinct updates; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content.',
      paid: 'apply the PAID adventure/outdoors instructions exactly as written. Focus on 4–5 distinct updates; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content.'
    }
  },
  personalDevelopment: {
    keywords: [
      'personal development', 'productivity', 'time management', 'goal setting',
      'emotional intelligence', 'self improvement', 'self-improvement',
      'self help', 'self-help'
    ],
    freeInstructions: `You are Snipit, a no-fluff personal development summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes.
- Each bullet must include a concrete "try this" takeaway that is directly supported by the article.
- Avoid pseudo-science, extreme claims, and generic motivation.
- Include any numbers/study findings ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    paidInstructions: `You are Snipit, a no-fluff personal development summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes.
- Each bullet must include a concrete "try this" takeaway that is directly supported by the article.
- Avoid pseudo-science, extreme claims, and generic motivation.
- Include any numbers/study findings ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`,
    freeSystemPrompt: `You are Snipit, a no-fluff personal development summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free personal development instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated; no markdown or code fences.`,
    paidSystemPrompt: `You are Snipit, a no-fluff personal development summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid personal development instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated; no markdown or code fences.`,
    promptDescription: {
      free: 'apply the FREE personal development instructions exactly as written. Focus on 1–3 distinct updates; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated.',
      paid: 'apply the PAID personal development instructions exactly as written. Focus on 4–5 distinct updates; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated.'
    }
  },
  default: {
    keywords: [],
    freeInstructions: `For FREE TIER, return 1-3 summaries representing the most relevant and impactful points about the topic.
PREFER 3 summaries if enough distinct articles are available, but return 1-2 if that's all that's available.

CRITICAL REQUIREMENTS:
- NO REPETITION: Each point must be DISTINCT and UNIQUE. Do not repeat similar information.
- NO FLUFF: Bullets must be concise, factual, and information-dense. Remove marketing language, filler words, and unnecessary details.
- ACCURACY: Only include information that is directly stated in the articles. Do not infer or speculate.
- RELEVANCE: Prioritize points directly related to the topic.
- IMPORTANT: You must return at least 1 summary if any articles are provided.

Each summary must have:
- A "title" field with the article title that best represents that point (NO duplicate titles)
- A "bullets" array with exactly 1 bullet point (1-2 sentences) that explains that specific point concisely
- "url" and "source" fields from the article`,
    paidInstructions: `For PAID TIER, return 4-5 articles. Each article must have:
- A "title" field with the article title
- A "summary" field with a 2-3 sentence paragraph summary
- "url" and "source" fields`,
    freeSystemPrompt: `You are a news summarizer for free tier. Return ONLY valid JSON with 1-3 summaries (prefer 3, but return 1-2 if that's all available). Each summary must have "title" (unique, no duplicates), "bullets" (array with exactly 1 string, 1-2 sentences, no fluff), "url", and "source". IMPORTANT: You must return at least 1 summary from the provided articles. Ensure all points are DISTINCT and UNIQUE - no repetition. No markdown, no code blocks.`,
    paidSystemPrompt: `You are a news summarizer for paid tier. Return ONLY valid JSON with 4-5 articles. Each article must have "title", "summary" (2-3 sentences, no fluff), "url", and "source". IMPORTANT: You must return at least 1 summary from the provided articles. Ensure no duplicate titles or repeated information. No markdown, no code blocks.`,
    promptDescription: {
      free: `identify the 3 most relevant and impactful points based on the articles provided. These 3 points must be DISTINCT, UNIQUE, and directly related to the topic. Each point should be substantial, informative, and contain no fluff or repetition.`,
      paid: `select the most relevant articles and provide concise, no-fluff paragraph summaries for each.`
    }
  }
};

// ============================================================================
// END TOPIC CONFIGURATION
// ============================================================================

// Helper function to clean description text for fallback use
function cleanDescriptionForFallback(description: string): string {
  if (!description) return '';

  let cleaned = description
    .replace(/Follow Us On Social Media/gi, '')
    .replace(/Share on (Facebook|Twitter|LinkedIn|WhatsApp|Email)/gi, '')
    .replace(/READ MORE:?.*$/i, '')
    .replace(/ALSO READ:?.*$/i, '')
    .replace(/Related:?.*$/i, '')
    .replace(/Click here.*$/i, '')
    .replace(/Subscribe.*$/i, '')
    .replace(/Sign up.*$/i, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\.\.\.\s*$/g, '')
    .replace(/…\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If still starts with garbage (all caps), try to extract real content
  if (/^[A-Z\s]{10,}/.test(cleaned) && cleaned.includes('.')) {
    const match = cleaned.match(/\.\s+([A-Z][^.]+\.)/);
    if (match) {
      cleaned = match[1];
    }
  }

  return cleaned;
}

// Helper function to check if a description is usable (not garbage)
function isUsableDescription(description: string): boolean {
  if (!description || description.length < 30) return false;

  // Check for common garbage patterns
  const garbagePatterns = [
    /^Follow Us/i,
    /^Share on/i,
    /^Click here/i,
    /^Subscribe/i,
    /^READ MORE/i,
    /^[A-Z\s]{20,}$/, // All caps gibberish
  ];

  for (const pattern of garbagePatterns) {
    if (pattern.test(description)) return false;
  }

  // Check if it looks like a real sentence (has at least some lowercase letters and punctuation)
  const hasLowercase = /[a-z]/.test(description);
  const hasPunctuation = /[.,!?]/.test(description);

  return hasLowercase && hasPunctuation;
}

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

  const WORLD_NEWS_TOPICS = [
    'world news',
    'regional news',
    'europe',
    'asia',
    'africa',
    'global events',
    'conflict zones',
    'international relations',
  ];

  const SCIENCE_TOPICS = [
    'science',
    'space exploration',
    'medical research',
    'environmental science',
    'astronomy',
    'nasa missions',
    'scientific discoveries',
  ];

  const ENVIRONMENT_TOPICS = [
    'environment',
    'climate change',
    'renewable energy',
    'wildlife conservation',
    'marine conservation',
    'eco-tourism',
    'sustainable agriculture',
    'climate',
  ];

  const LIFESTYLE_TOPICS = [
    'lifestyle',
    'lifestyle and luxury',
    'luxury',
    'high-end fashion',
    'wellness',
    'home decor',
    'travel',
    'exclusive destinations',
    'fine dining',
    'watches',
    'skincare',
    'sustainable living',
  ];

  const EDUCATION_TOPICS = [
    'education',
    'higher education',
    'online learning',
    'trends in education',
    'edtech innovations',
    'virtual reality in education',
    'edtech',
  ];

  const FOOD_TOPICS = [
    'food',
    'recipes',
    'restaurant reviews',
    'food trends',
    'fine dining',
  ];

  const GAMING_TOPICS = [
    'gaming',
    'esports',
    'game releases',
    'console updates',
    'pc gaming',
    'video games',
    'gaming news',
  ];

  const CULTURE_TOPICS = [
    'culture',
    'art',
    'painting',
    'graphic design',
    'sculpture',
    'architecture',
    'history',
    'literature',
    'books',
    'heritage',
    'cultural',
  ];

  const PARENTING_TOPICS = [
    'parenting',
    'parenting and family',
    'family',
    'parenting tips',
    'child development',
    'work-life balance',
    'family health',
    'teen trends',
    'children',
    'kids',
  ];

  const AUTOMOTIVE_TOPICS = [
    'automotive',
    'electric vehicles',
    'car reviews',
    'auto industry news',
    'drones in transportation',
    'cars',
    'vehicles',
    'ev',
    'electric cars',
    'autonomous vehicles',
  ];

  const CAREER_TOPICS = [
    'career',
    'career and professional development',
    'professional development',
    'resume tips',
    'networking',
    'industry trends',
    'remote work',
    'career growth strategies',
    'work culture',
    'jobs',
    'hiring',
    'workplace',
  ];

  const ADVENTURE_TOPICS = [
    'adventure',
    'adventure and outdoor activities',
    'outdoor activities',
    'hiking',
    'camping',
    'climbing',
    'outdoor',
    'outdoors',
    'parks',
    'trails',
    'mountaineering',
    'backpacking',
  ];

  const PERSONAL_DEVELOPMENT_TOPICS = [
    'personal development',
    'productivity',
    'time management',
    'goal setting',
    'emotional intelligence',
    'self improvement',
    'self-improvement',
    'self help',
    'self-help',
  ];

  if (articles.length === 0) {
    return {
      topic,
      summaries: [],
    };
  }

  // Note: We no longer cache summaries - articles are cached in article_cache table
  // This allows us to regenerate summaries with improved prompts without clearing article cache

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
  const isWorldNewsTopic = WORLD_NEWS_TOPICS.some((worldTopic) =>
    topicLower.includes(worldTopic.toLowerCase())
  );
  const isScienceTopic = SCIENCE_TOPICS.some((scienceTopic) =>
    topicLower.includes(scienceTopic.toLowerCase())
  );
  const isEnvironmentTopic = ENVIRONMENT_TOPICS.some((envTopic) =>
    topicLower.includes(envTopic.toLowerCase())
  );
  const isLifestyleTopic = LIFESTYLE_TOPICS.some((lifestyleTopic) =>
    topicLower.includes(lifestyleTopic.toLowerCase())
  );
  const isEducationTopic = EDUCATION_TOPICS.some((educationTopic) =>
    topicLower.includes(educationTopic.toLowerCase())
  );
  const isFoodTopic = FOOD_TOPICS.some((foodTopic) =>
    topicLower.includes(foodTopic.toLowerCase())
  );
  const isGamingTopic = GAMING_TOPICS.some((gamingTopic) =>
    topicLower.includes(gamingTopic.toLowerCase())
  );
  const isCultureTopic = CULTURE_TOPICS.some((cultureTopic) =>
    topicLower.includes(cultureTopic.toLowerCase())
  );
  const isParentingTopic = PARENTING_TOPICS.some((parentingTopic) =>
    topicLower.includes(parentingTopic.toLowerCase())
  );
  const isAutomotiveTopic = AUTOMOTIVE_TOPICS.some((automotiveTopic) =>
    topicLower.includes(automotiveTopic.toLowerCase())
  );
  const isCareerTopic = CAREER_TOPICS.some((careerTopic) =>
    topicLower.includes(careerTopic.toLowerCase())
  );
  const isAdventureTopic = ADVENTURE_TOPICS.some((adventureTopic) =>
    topicLower.includes(adventureTopic.toLowerCase())
  );
  const isPersonalDevelopmentTopic = PERSONAL_DEVELOPMENT_TOPICS.some((personalDevTopic) =>
    topicLower.includes(personalDevTopic.toLowerCase())
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

  // Use basic keyword filtering - OpenAI relevance filtering removed as redundant
  // articleScoring.ts already scores articles by relevance
  if (basicRelevanceFiltered.length === 0) {
    console.log(`[OpenAI] No relevant articles found for topic: ${topic}`);
    return {
      topic,
      summaries: [],
    };
  }

  console.log(`[OpenAI] Using ${basicRelevanceFiltered.length} articles after keyword filtering for "${topic}"`);

  // Article selection: Take top articles, prioritizing those with better descriptions (more context)
  // For free tier: take top 7 articles to ensure we can get 3 good summaries
  // For paid tier: take top 7 articles to ensure we can get 4-5 good summaries
  const articlesToTake = isPaid ? 7 : 7;
  
  // Sort articles by description quality (longer = more context) before selecting
  const sortedArticles = [...basicRelevanceFiltered].sort((a, b) => {
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

  const format = (isSportsTopic || isBusinessTopic || isTechTopic || isHealthTopic || isPoliticsTopic || isWorldNewsTopic || isScienceTopic || isEnvironmentTopic || isLifestyleTopic || isEducationTopic || isFoodTopic || isGamingTopic || isCultureTopic || isParentingTopic || isAutomotiveTopic || isCareerTopic || isAdventureTopic || isPersonalDevelopmentTopic) ? 'bullet point' : isPaid ? 'paragraph' : 'bullet point';
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
            : isWorldNewsTopic
              ? (isPaid ? 5 : 3)
              : isScienceTopic
                ? (isPaid ? 5 : 3)
                : isEnvironmentTopic
                  ? (isPaid ? 5 : 3)
                  : isLifestyleTopic
                    ? (isPaid ? 5 : 3)
                    : isEducationTopic
                      ? (isPaid ? 5 : 3)
                      : isFoodTopic
                        ? (isPaid ? 5 : 3)
                        : isGamingTopic
                          ? (isPaid ? 5 : 3)
                          : isCultureTopic
                            ? (isPaid ? 5 : 3)
                            : isParentingTopic
                              ? (isPaid ? 5 : 3)
                              : isAutomotiveTopic
                                ? (isPaid ? 5 : 3)
                                : isCareerTopic
                                  ? (isPaid ? 5 : 3)
                                  : isAdventureTopic
                                    ? (isPaid ? 5 : 3)
                                    : isPersonalDevelopmentTopic
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
  - All quick-score game updates (if scores are available in the provided article text), and
  - 2 bigger storylines (trade/injury/suspension/coach quote/playoff scenario).
  - Interesting facts/statements that relate to that topic within the article.
  - Ideally getting to the point when outputting that statement/fact, no fluff repetitive verbiage.
- If scores are NOT present in the provided article text, do NOT fake them—just summarize the key development with why it matters.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
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
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no fluff.`;

  const politicsPaidInstructions = `You are Snipit, a no-fluff politics summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must give the full picture fast: what happened + what changes + who it affects.
- Include the "why now" driver (vote, court ruling, agency action, diplomatic move, scandal, etc.).
- Include numbers (vote counts, poll numbers, dates) ONLY if explicitly stated in the article text provided. Never guess.
- Avoid speculation unless the article itself frames it as such and you attribute it ("according to…", "analysts say…").

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No duplicate titles, no repeated angles, no fluff.`;

  const worldNewsFreeInstructions = `You are Snipit, a no-fluff world news summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Bullets must answer: what happened + where + why it matters globally.
- Prioritize: conflict escalations/de-escalations, major elections, sanctions, diplomacy, disasters, major economic shocks.
- Include concrete details (locations, key actors, dates, casualties/aid figures) ONLY if explicitly stated in the article text.
- Do not editorialize or take sides; stick to verified facts in the article.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const worldNewsPaidInstructions = `You are Snipit, a no-fluff world news summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must answer: what happened + where + why it matters globally.
- Prioritize: conflict escalations/de-escalations, major elections, sanctions, diplomacy, disasters, major economic shocks.
- Include concrete details (locations, key actors, dates, casualties/aid figures) ONLY if explicitly stated in the article text.
- Do not editorialize or take sides; stick to verified facts in the article.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const scienceFreeInstructions = `You are Snipit, a no-fluff science summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Each bullet must include: what was discovered/announced + what's new + why it matters (real-world impact or next milestone).
- If it's medical research, include study type/phase and the key finding ONLY if explicitly stated.
- If it's space/astronomy, include the milestone and next step (launch, test, data release) if stated.
- No hype; no "breakthrough" language unless the article uses it and supports it with specifics.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const sciencePaidInstructions = `You are Snipit, a no-fluff science summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Each bullet must include: what was discovered/announced + what's new + why it matters (real-world impact or next milestone).
- If it's medical research, include study type/phase and the key finding ONLY if explicitly stated.
- If it's space/astronomy, include the milestone and next step (launch, test, data release) if stated.
- No hype; no "breakthrough" language unless the article uses it and supports it with specifics.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const environmentFreeInstructions = `You are Snipit, a no-fluff environment/climate summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Bullets must cover: what happened + what's driving it + what changes next (policy, cost, risks, timelines).
- Prioritize: major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through.
- Include metrics (temperatures, emissions, costs, targets, acres, adoption rates) ONLY if explicitly stated in the article text.
- Avoid vague "awareness" stories unless there's a clear action or consequence.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const environmentPaidInstructions = `You are Snipit, a no-fluff environment/climate summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must cover: what happened + what's driving it + what changes next (policy, cost, risks, timelines).
- Prioritize: major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through.
- Include metrics (temperatures, emissions, costs, targets, acres, adoption rates) ONLY if explicitly stated in the article text.
- Avoid vague "awareness" stories unless there's a clear action or consequence.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const lifestyleFreeInstructions = `You are Snipit, a no-fluff lifestyle/luxury summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Focus on changes that affect real decisions: launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics.
- Every bullet must include a concrete detail (brand/product/place/date/feature) ONLY if explicitly stated.
- Avoid vague trend talk; make it specific: what it is + why it's popular + who it's for.

Numbers & Momentum (ONLY if stated):

If the article includes any quantified changes, include them in the bullet (%, $, units, rank, dates, YoY/QoQ, guidance ranges).

If multiple metrics are available, include up to 3 in this order:

Primary change (price increase / sales / subscribers / bookings / margins)

Business impact (revenue/profit/traffic/conversion/retention)

Forward-looking (guidance, next launch date, expansion count)

Use labels to avoid ambiguity: Price: +X% | Sales: +Y% | Retention: +Z%

Do not infer (“effective”, “led to”, “drove”) unless the article explicitly links the metric to the action.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const lifestylePaidInstructions = `You are Snipit, a no-fluff lifestyle/luxury summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Focus on changes that affect real decisions: launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics.
- Every bullet must include a concrete detail (brand/product/place/date/feature) ONLY if explicitly stated.
- Avoid vague trend talk; make it specific: what it is + why it's popular + who it's for.

Numbers & Momentum (ONLY if stated):

If the article includes any quantified changes, include them in the bullet (%, $, units, rank, dates, YoY/QoQ, guidance ranges).

If multiple metrics are available, include up to 3 in this order:

Primary change (price increase / sales / subscribers / bookings / margins)

Business impact (revenue/profit/traffic/conversion/retention)

Forward-looking (guidance, next launch date, expansion count)

Use labels to avoid ambiguity: Price: +X% | Sales: +Y% | Retention: +Z%

Do not infer (“effective”, “led to”, “drove”) unless the article explicitly links the metric to the action.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.

- "url" and "source" must match the best supporting article.
- No repetition.`;

  const educationFreeInstructions = `You are Snipit, a no-fluff education summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible (never exceed 3).

Style:
- Bullets must answer: what changed + who it affects (students/teachers/parents) + what's next.
- Prioritize: policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules.
- Include figures (budgets, enrollment, outcomes) ONLY if explicitly stated in the article text.
- Avoid generic "education is changing" commentary.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const educationPaidInstructions = `You are Snipit, a no-fluff education summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must answer: what changed + who it affects (students/teachers/parents) + what's next.
- Prioritize: policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules.
- Include figures (budgets, enrollment, outcomes) ONLY if explicitly stated in the article text.
- Avoid generic "education is changing" commentary.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const foodFreeInstructions = `You are Snipit, a no-fluff food summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Make it usable: what's new + what to try + why it's trending (or why it matters).
- Prioritize: notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories.
- Include specific dish/restaurant/city/ingredient details ONLY if explicitly stated in the article text.
- Avoid filler like "foodies are excited" unless the article provides a real reason.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const foodPaidInstructions = `You are Snipit, a no-fluff food summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Make it usable: what's new + what to try + why it's trending (or why it matters).
- Prioritize: notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories.
- Include specific dish/restaurant/city/ingredient details ONLY if explicitly stated in the article text.
- Avoid filler like "foodies are excited" unless the article provides a real reason.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const gamingFreeInstructions = `You are Snipit, a no-fluff gaming summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize: major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results.
- If esports: include result/score/prize ONLY if explicitly stated in the article text; never guess.
- If game updates: include what changed and what it means for players (meta, balance, progression) in plain terms.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const gamingPaidInstructions = `You are Snipit, a no-fluff gaming summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results.
- If esports: include result/score/prize ONLY if explicitly stated in the article text; never guess.
- If game updates: include what changed and what it means for players (meta, balance, progression) in plain terms.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const cultureFreeInstructions = `You are Snipit, a no-fluff culture summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Keep it substantive: what happened + the cultural significance + what changes next.
- Prioritize: major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases).
- Include specific names/places/dates ONLY if explicitly stated in the article text.
- Avoid abstract opinion pieces unless there's a concrete news hook.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const culturePaidInstructions = `You are Snipit, a no-fluff culture summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Keep it substantive: what happened + the cultural significance + what changes next.
- Prioritize: major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases).
- Include specific names/places/dates ONLY if explicitly stated in the article text.
- Avoid abstract opinion pieces unless there's a concrete news hook.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const parentingFreeInstructions = `You are Snipit, a no-fluff parenting/family summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize practical, credible updates: child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics.
- Each bullet must include: what's the takeaway + what a parent should do/know next (only if the article supports it).
- Avoid medical diagnosis language and avoid fear-mongering.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const parentingPaidInstructions = `You are Snipit, a no-fluff parenting/family summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize practical, credible updates: child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics.
- Each bullet must include: what's the takeaway + what a parent should do/know next (only if the article supports it).
- Avoid medical diagnosis language and avoid fear-mongering.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const automotiveFreeInstructions = `You are Snipit, a no-fluff automotive summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Bullets must include: what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety).
- Prioritize: EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates.
- Include specs (range, price, horsepower, charging time) ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const automotivePaidInstructions = `You are Snipit, a no-fluff automotive summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Bullets must include: what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety).
- Prioritize: EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates.
- Include specs (range, price, horsepower, charging time) ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const careerFreeInstructions = `You are Snipit, a no-fluff career summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize: hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics.
- Each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article.
- Include numbers (layoffs, wage data, openings) ONLY if explicitly stated.
- Avoid generic motivation content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const careerPaidInstructions = `You are Snipit, a no-fluff career summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics.
- Each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article.
- Include numbers (layoffs, wage data, openings) ONLY if explicitly stated.
- Avoid generic motivation content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const adventureFreeInstructions = `You are Snipit, a no-fluff adventure/outdoors summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize: park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events.
- Make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated.
- Include specific locations, dates, difficulty, costs ONLY if explicitly stated in the article text.
- Avoid vague inspiration content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const adventurePaidInstructions = `You are Snipit, a no-fluff adventure/outdoors summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize: park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events.
- Make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated.
- Include specific locations, dates, difficulty, costs ONLY if explicitly stated in the article text.
- Avoid vague inspiration content.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const personalDevelopmentFreeInstructions = `You are Snipit, a no-fluff personal development summarizer (FREE TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 1–3 DISTINCT updates that matter most for the topic. Prefer 3 if possible.

Style:
- Prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes.
- Each bullet must include a concrete "try this" takeaway that is directly supported by the article.
- Avoid pseudo-science, extreme claims, and generic motivation.
- Include any numbers/study findings ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

  const personalDevelopmentPaidInstructions = `You are Snipit, a no-fluff personal development summarizer (PAID TIER).

Return ONLY valid JSON: {"summaries":[...]}.

Pick 4–5 DISTINCT updates that matter most for the topic. Prefer 5 if possible (never exceed 5).

Style:
- Prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes.
- Each bullet must include a concrete "try this" takeaway that is directly supported by the article.
- Avoid pseudo-science, extreme claims, and generic motivation.
- Include any numbers/study findings ONLY if explicitly stated in the article text.

Output rules:
- "title": short Snipit headline (6–15 words).
- "bullets": up to 4 bullet strings, up to 3 short sentences each.
- "url" and "source" must match the best supporting article.
- No repetition.`;

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
                ? 'apply the PAID politics instructions exactly as written. Focus on 4–5 distinct updates; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation.'
                : 'apply the FREE politics instructions exactly as written. Focus on 1–3 distinct updates; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation.'
              : isWorldNewsTopic
                ? isPaid
                  ? 'apply the PAID world news instructions exactly as written. Focus on 4–5 distinct updates; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing.'
                  : 'apply the FREE world news instructions exactly as written. Focus on 1–3 distinct updates; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing.'
                : isScienceTopic
                  ? isPaid
                    ? 'apply the PAID science instructions exactly as written. Focus on 4–5 distinct updates; include what was discovered/announced + what\'s new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics.'
                    : 'apply the FREE science instructions exactly as written. Focus on 1–3 distinct updates; include what was discovered/announced + what\'s new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics.'
                  : isEnvironmentTopic
                    ? isPaid
                      ? 'apply the PAID environment/climate instructions exactly as written. Focus on 4–5 distinct updates; cover what happened + what\'s driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there\'s a clear action or consequence.'
                      : 'apply the FREE environment/climate instructions exactly as written. Focus on 1–3 distinct updates; cover what happened + what\'s driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there\'s a clear action or consequence.'
                    : isLifestyleTopic
                      ? isPaid
                        ? 'apply the PAID lifestyle/luxury instructions exactly as written. Focus on 4–5 distinct updates; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what\'s in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it\'s popular + who it\'s for.'
                        : 'apply the FREE lifestyle/luxury instructions exactly as written. Focus on 1–3 distinct updates; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what\'s in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it\'s popular + who it\'s for.'
                      : isEducationTopic
                        ? isPaid
                          ? 'apply the PAID education instructions exactly as written. Focus on 4–5 distinct updates; answer what changed + who it affects (students/teachers/parents) + what\'s next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary.'
                          : 'apply the FREE education instructions exactly as written. Focus on 1–3 distinct updates; answer what changed + who it affects (students/teachers/parents) + what\'s next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary.'
                        : isFoodTopic
                          ? isPaid
                            ? 'apply the PAID food instructions exactly as written. Focus on 4–5 distinct updates; make it usable: what\'s new + what to try + why it\'s trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason.'
                            : 'apply the FREE food instructions exactly as written. Focus on 1–3 distinct updates; make it usable: what\'s new + what to try + why it\'s trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason.'
                          : isGamingTopic
                            ? isPaid
                              ? 'apply the PAID gaming instructions exactly as written. Focus on 4–5 distinct updates; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms.'
                              : 'apply the FREE gaming instructions exactly as written. Focus on 1–3 distinct updates; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms.'
                            : isCultureTopic
                              ? isPaid
                                ? 'apply the PAID culture instructions exactly as written. Focus on 4–5 distinct updates; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there\'s a concrete news hook.'
                                : 'apply the FREE culture instructions exactly as written. Focus on 1–3 distinct updates; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there\'s a concrete news hook.'
                              : isParentingTopic
                                ? isPaid
                                  ? 'apply the PAID parenting/family instructions exactly as written. Focus on 4–5 distinct updates; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what\'s the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering.'
                                  : 'apply the FREE parenting/family instructions exactly as written. Focus on 1–3 distinct updates; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what\'s the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering.'
                                : isAutomotiveTopic
                                  ? isPaid
                                    ? 'apply the PAID automotive instructions exactly as written. Focus on 4–5 distinct updates; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated.'
                                    : 'apply the FREE automotive instructions exactly as written. Focus on 1–3 distinct updates; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated.'
                                      : isCareerTopic
                                        ? isPaid
                                          ? 'apply the PAID career instructions exactly as written. Focus on 4–5 distinct updates; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content.'
                                          : 'apply the FREE career instructions exactly as written. Focus on 1–3 distinct updates; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content.'
                                        : isAdventureTopic
                                          ? isPaid
                                            ? 'apply the PAID adventure/outdoors instructions exactly as written. Focus on 4–5 distinct updates; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content.'
                                            : 'apply the FREE adventure/outdoors instructions exactly as written. Focus on 1–3 distinct updates; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content.'
                                          : isPersonalDevelopmentTopic
                                            ? isPaid
                                              ? 'apply the PAID personal development instructions exactly as written. Focus on 4–5 distinct updates; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated.'
                                              : 'apply the FREE personal development instructions exactly as written. Focus on 1–3 distinct updates; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated.'
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

CONTENT CLEANING REQUIREMENTS:
- IGNORE navigation text, metadata, and website UI elements in article descriptions
- IGNORE patterns like "Follow Us On Social Media", "Skip to comments", "Posted on [date] by [author]", source attribution lines, etc.
- IGNORE multiple headlines concatenated together - extract only the relevant content
- Extract ONLY the actual news content, not website navigation or metadata
- If an article description contains navigation/metadata text, focus on the actual news story content

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
            : isWorldNewsTopic
              ? (isPaid ? worldNewsPaidInstructions : worldNewsFreeInstructions)
              : isScienceTopic
                ? (isPaid ? sciencePaidInstructions : scienceFreeInstructions)
                : isEnvironmentTopic
                  ? (isPaid ? environmentPaidInstructions : environmentFreeInstructions)
                  : isLifestyleTopic
                    ? (isPaid ? lifestylePaidInstructions : lifestyleFreeInstructions)
                    : isEducationTopic
                      ? (isPaid ? educationPaidInstructions : educationFreeInstructions)
                      : isFoodTopic
                        ? (isPaid ? foodPaidInstructions : foodFreeInstructions)
                        : isGamingTopic
                          ? (isPaid ? gamingPaidInstructions : gamingFreeInstructions)
                          : isCultureTopic
                            ? (isPaid ? culturePaidInstructions : cultureFreeInstructions)
                            : isParentingTopic
                              ? (isPaid ? parentingPaidInstructions : parentingFreeInstructions)
                              : isAutomotiveTopic
                                ? (isPaid ? automotivePaidInstructions : automotiveFreeInstructions)
                                : isCareerTopic
                                  ? (isPaid ? careerPaidInstructions : careerFreeInstructions)
                                : isAdventureTopic
                                  ? (isPaid ? adventurePaidInstructions : adventureFreeInstructions)
                                  : isPersonalDevelopmentTopic
                                    ? (isPaid ? personalDevelopmentPaidInstructions : personalDevelopmentFreeInstructions)
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
                  ? `You are Snipit, a no-fluff technology summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid technology instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; give the full picture fast (what changed + who it impacts + why it matters); include one concrete detail only if explicitly stated; for cybersecurity, state who's affected and recommended actions if provided; avoid hype/speculation; no markdown or code fences.`
                  : `You are Snipit, a no-fluff technology summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free technology instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; give the full picture fast (what changed + who it impacts + why it matters); include one concrete detail only if explicitly stated; for cybersecurity, state who's affected and recommended actions if provided; avoid hype/speculation; no markdown or code fences.`
                : isHealthTopic
                  ? isPaid
                    ? `You are Snipit, a no-fluff health & wellness summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid health instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize guidelines, studies, recalls, actionable advice; include what it means for a normal person and what to do next; include study type/phase and key result only if explicitly stated; no diagnosis language or miracle framing; no markdown or code fences.`
                    : `You are Snipit, a no-fluff health & wellness summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free health instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize guidelines, studies, recalls, actionable advice; include what it means for a normal person and what to do next; include study type/phase and key result only if explicitly stated; no diagnosis language or miracle framing; no markdown or code fences.`
                  : isPoliticsTopic
                    ? isPaid
                      ? `You are Snipit, a no-fluff politics summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid politics instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation; no markdown or code fences.`
                      : `You are Snipit, a no-fluff politics summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free politics instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; full picture (what happened + what changes + who it affects); include "why now" drivers; include numbers only if provided; attribute speculation; no markdown or code fences.`
                    : isWorldNewsTopic
                      ? isPaid
                        ? `You are Snipit, a no-fluff world news summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid world news instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing; no markdown or code fences.`
                        : `You are Snipit, a no-fluff world news summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free world news instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; answer what happened + where + why it matters globally; prioritize conflicts, elections, sanctions, diplomacy, disasters, economic shocks; include concrete details only if explicitly stated; stick to verified facts, no editorializing; no markdown or code fences.`
                      : isScienceTopic
                        ? isPaid
                          ? `You are Snipit, a no-fluff science summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid science instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; include what was discovered/announced + what's new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics; no markdown or code fences.`
                          : `You are Snipit, a no-fluff science summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free science instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; include what was discovered/announced + what's new + why it matters (real-world impact or next milestone); for medical research include study type/phase and key finding only if explicitly stated; for space/astronomy include milestone and next step if stated; no hype or "breakthrough" language unless article uses it with specifics; no markdown or code fences.`
                        : isEnvironmentTopic
                          ? isPaid
                            ? `You are Snipit, a no-fluff environment/climate summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid environment instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; cover what happened + what's driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there's a clear action or consequence; no markdown or code fences.`
                            : `You are Snipit, a no-fluff environment/climate summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free environment instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; cover what happened + what's driving it + what changes next (policy, cost, risks, timelines); prioritize major climate events, renewables policy, regulation, conservation actions, corporate commitments with real follow-through; include metrics only if explicitly stated; avoid vague "awareness" stories unless there's a clear action or consequence; no markdown or code fences.`
                          : isLifestyleTopic
                            ? isPaid
                              ? `You are Snipit, a no-fluff lifestyle/luxury summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid lifestyle instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it's popular + who it's for; no markdown or code fences.`
                              : `You are Snipit, a no-fluff lifestyle/luxury summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free lifestyle instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; focus on changes that affect real decisions (launches, trend shifts, pricing moves, travel access, brand strategy, "what's in/out" with specifics); include concrete details (brand/product/place/date/feature) only if explicitly stated; avoid vague trend talk; make it specific: what it is + why it's popular + who it's for; no markdown or code fences.`
                            : isEducationTopic
                              ? isPaid
                                ? `You are Snipit, a no-fluff education summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid education instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; answer what changed + who it affects (students/teachers/parents) + what's next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary; no markdown or code fences.`
                                : `You are Snipit, a no-fluff education summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free education instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; answer what changed + who it affects (students/teachers/parents) + what's next; prioritize policy shifts, funding changes, curriculum/testing updates, major edtech moves, higher ed admissions/AI rules; include figures (budgets, enrollment, outcomes) only if explicitly stated; avoid generic "education is changing" commentary; no markdown or code fences.`
                              : isFoodTopic
                                ? isPaid
                                  ? `You are Snipit, a no-fluff food summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid food instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; make it usable: what's new + what to try + why it's trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason; no markdown or code fences.`
                                  : `You are Snipit, a no-fluff food summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free food instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; make it usable: what's new + what to try + why it's trending (or why it matters); prioritize notable restaurant openings/closures, major food recalls, big trend shifts, standout recipe/technique stories; include specific dish/restaurant/city/ingredient details only if explicitly stated; avoid filler like "foodies are excited" unless the article provides a real reason; no markdown or code fences.`
                                : isGamingTopic
                                  ? isPaid
                                    ? `You are Snipit, a no-fluff gaming summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid gaming instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms; no markdown or code fences.`
                                    : `You are Snipit, a no-fluff gaming summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free gaming instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize major releases, delays, patches/nerfs, platform moves, studio acquisitions/closures, esports results; if esports include result/score/prize only if explicitly stated; if game updates include what changed and what it means for players (meta, balance, progression) in plain terms; no markdown or code fences.`
                                  : isCultureTopic
                                    ? isPaid
                                      ? `You are Snipit, a no-fluff culture summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid culture instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there's a concrete news hook; no markdown or code fences.`
                                      : `You are Snipit, a no-fluff culture summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free culture instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; keep it substantive: what happened + the cultural significance + what changes next; prioritize major exhibitions/books, heritage findings, big cultural debates with real events (bans, awards, policy, releases); include specific names/places/dates only if explicitly stated; avoid abstract opinion pieces unless there's a concrete news hook; no markdown or code fences.`
                                    : isParentingTopic
                                      ? isPaid
                                        ? `You are Snipit, a no-fluff parenting/family summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid parenting instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what's the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering; no markdown or code fences.`
                                        : `You are Snipit, a no-fluff parenting/family summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free parenting instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize practical, credible updates (child development guidance, school/family policy changes, safety recalls, teen tech trends with specifics); each bullet must include what's the takeaway + what a parent should do/know next (only if the article supports it); avoid medical diagnosis language and avoid fear-mongering; no markdown or code fences.`
                                      : isAutomotiveTopic
                                        ? isPaid
                                          ? `You are Snipit, a no-fluff automotive summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid automotive instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated; no markdown or code fences.`
                                            : `You are Snipit, a no-fluff automotive summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free automotive instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; bullets must include what changed + the concrete detail + why it matters (buyers, manufacturers, regulation, pricing, safety); prioritize EV moves, recalls, new models, charging/infra changes, major manufacturer strategy, autonomous/drone transport updates; include specs (range, price, horsepower, charging time) only if explicitly stated; no markdown or code fences.`
                                          : isCareerTopic
                                            ? isPaid
                                              ? `You are Snipit, a no-fluff career summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid career instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content; no markdown or code fences.`
                                              : `You are Snipit, a no-fluff career summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free career instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize hiring trends, pay/benefits shifts, major workplace policy, remote work moves, and high-signal job-search tactics; each bullet must include one actionable takeaway (what to do / what to watch) grounded in the article; include numbers (layoffs, wage data, openings) only if explicitly stated; avoid generic motivation content; no markdown or code fences.`
                                            : isAdventureTopic
                                              ? isPaid
                                                ? `You are Snipit, a no-fluff adventure/outdoors summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid adventure instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content; no markdown or code fences.`
                                                : `You are Snipit, a no-fluff adventure/outdoors summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free adventure instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize park access/closures, permit changes, gear safety recalls, major route/trail updates, standout destinations/events; make it usable: what changed + where + what to do next (timing/permit/route alternative) if stated; include specific locations, dates, difficulty, costs only if explicitly stated; avoid vague inspiration content; no markdown or code fences.`
                                              : isPersonalDevelopmentTopic
                                                ? isPaid
                                                  ? `You are Snipit, a no-fluff personal development summarizer for PAID TIER. Return ONLY valid JSON with "summaries". Follow the paid personal development instructions: pick 4-5 distinct updates (prefer 5, max 5); bullets only; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated; no markdown or code fences.`
                                                  : `You are Snipit, a no-fluff personal development summarizer for FREE TIER. Return ONLY valid JSON with "summaries". Follow the free personal development instructions: pick 1-3 distinct updates (prefer 3, max 3); bullets only; prioritize high-signal, practical ideas tied to evidence, research, or real workplace/productivity outcomes; each bullet must include a concrete "try this" takeaway that is directly supported by the article; avoid pseudo-science, extreme claims, and generic motivation; include any numbers/study findings only if explicitly stated; no markdown or code fences.`
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

        // Note: Summaries are no longer cached - articles are cached in article_cache table
        // This allows us to regenerate summaries with improved prompts without clearing article cache

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
  // Use top 3 latest articles with usable descriptions
  // Filter out articles with garbage descriptions first
  const usableArticles = articlesToSummarize.filter((article) => {
    const cleanedDesc = cleanDescriptionForFallback(article.description);
    return isUsableDescription(cleanedDesc);
  });

  // If no usable articles, return empty (don't show garbage to users)
  if (usableArticles.length === 0) {
    console.log(`[OpenAI] No articles with usable descriptions for fallback - returning empty`);
    return {
      topic,
      summaries: [],
    };
  }

  const articlesToUse = usableArticles.slice(0, 3);

  let fallbackResult: NewsSummary;

  if (isPaid) {
    // Paid tier fallback: paragraph summaries from top 3 articles
    fallbackResult = {
      topic,
      summaries: articlesToUse.map((article) => {
        const cleanedDesc = cleanDescriptionForFallback(article.description);
        return {
          title: article.title,
          summary: cleanedDesc.length > 300
            ? cleanedDesc.substring(0, 300).trim()
            : cleanedDesc,
          url: article.url,
          source: article.source.name,
        };
      }),
    };
  } else {
    // Free tier fallback: create summaries from top 3 articles
    // Use each article as a separate summary with its description as a bullet
    fallbackResult = {
      topic,
      summaries: articlesToUse.map((article) => {
        const cleanedDesc = cleanDescriptionForFallback(article.description);
        const bulletText = cleanedDesc.length > 200
          ? cleanedDesc.substring(0, 200).trim()
          : cleanedDesc;
        return {
          title: article.title,
          bullets: [bulletText],
          summary: bulletText,
          url: article.url,
          source: article.source.name,
        };
      }),
    };
  }

  // Note: Fallback summaries are no longer cached - articles are cached in article_cache table
  // This allows us to regenerate summaries with improved prompts without clearing article cache

  return fallbackResult;
}

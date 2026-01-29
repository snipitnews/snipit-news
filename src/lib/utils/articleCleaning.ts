/**
 * Shared article cleaning utilities for news API sources
 * Extracts and cleans article descriptions by removing common garbage patterns
 */

/**
 * Cleans article content by removing common garbage patterns
 * Used by both NewsAPI and Currents API handlers
 */
export function cleanArticleContent(textContent: string): string {
  if (!textContent) return '';

  let cleaned = textContent
    .replace(/\[.*?\]/g, '') // Remove [Source] tags
    .replace(/Follow Us On Social Media/gi, '') // Remove social media boilerplate
    .replace(/Share on (Facebook|Twitter|LinkedIn|WhatsApp|Email)/gi, '') // Remove share buttons
    .replace(/READ MORE:?.*$/i, '') // Remove "READ MORE" and everything after
    .replace(/ALSO READ:?.*$/i, '') // Remove "ALSO READ" and everything after
    .replace(/Related:?.*$/i, '') // Remove "Related" links
    .replace(/Click here.*$/i, '') // Remove "Click here" CTAs
    .replace(/Subscribe.*$/i, '') // Remove subscription prompts
    .replace(/Sign up.*$/i, '') // Remove signup prompts
    .replace(/\.\.\.\s*$/g, '') // Remove trailing ellipsis (often truncation artifacts)
    .replace(/…\s*$/g, '') // Remove unicode ellipsis
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // If content starts with garbage (all caps social media text), try to find real content
  if (/^[A-Z\s]{10,}/.test(cleaned) && cleaned.includes('.')) {
    // Find first real sentence (starts after a period and space)
    const firstSentenceMatch = cleaned.match(/\.\s+([A-Z][^.]+\.)/);
    if (firstSentenceMatch) {
      cleaned = firstSentenceMatch[1];
    }
  }

  return cleaned;
}

/**
 * Truncates text at sentence boundaries to avoid cutting mid-sentence
 * Attempts to find the last complete sentence before the maxLength limit
 * If no sentence boundary is found within a reasonable range, falls back to word boundary
 */
export function truncateAtSentenceBoundary(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // First, try to find the last sentence boundary (., !, ?) before maxLength
  // Look back up to 200 characters to find a sentence end
  const lookbackRange = Math.min(200, maxLength * 0.2);
  const searchStart = Math.max(0, maxLength - lookbackRange);
  const searchEnd = maxLength;
  
  // Find last sentence boundary in the search range
  const sentenceEndRegex = /[.!?]\s+/g;
  let lastMatch: RegExpMatchArray | null = null;
  let match: RegExpMatchArray | null;
  
  // Reset regex to search from start
  sentenceEndRegex.lastIndex = searchStart;
  
  while ((match = sentenceEndRegex.exec(text)) !== null) {
    if (match.index <= searchEnd) {
      lastMatch = match;
    } else {
      break;
    }
  }
  
  // If we found a sentence boundary, truncate there
  if (lastMatch && lastMatch.index > 0) {
    return text.substring(0, lastMatch.index + 1).trim();
  }
  
  // Fallback: try to find last word boundary (space) before maxLength
  const wordBoundaryIndex = text.lastIndexOf(' ', maxLength);
  if (wordBoundaryIndex > maxLength * 0.8) {
    // Only use word boundary if it's reasonably close to maxLength (within 20%)
    return text.substring(0, wordBoundaryIndex).trim();
  }
  
  // Last resort: hard cut at maxLength (but this should be rare)
  return text.substring(0, maxLength).trim();
}
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
    .replace(/©\s*\d{4}[^.]*\./gi, '') // Remove "© 2024 Company Name."
    .replace(/all rights reserved\.?/gi, '') // Remove "All rights reserved"
    .replace(/terms of (service|use)\.?/gi, '') // Remove legal links
    .replace(/privacy policy\.?/gi, '') // Remove legal links
    .replace(/visit our (corporate |)site\.?/gi, '') // Remove corporate boilerplate
    .replace(/\d+\s+(st|nd|rd|th)\s+floor[^.]*\./gi, '') // Remove address with floor
    .replace(/\d{5}(-\d{4})?/g, '') // Remove zip codes
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
    if (match.index !== undefined && match.index <= searchEnd) {
      lastMatch = match;
    } else {
      break;
    }
  }
  
  // If we found a sentence boundary, truncate there
  if (lastMatch && lastMatch.index !== undefined && lastMatch.index > 0) {
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

/**
 * Checks if a description is garbage content that should be rejected.
 * Returns true if the description is garbage (unusable), false if it's usable.
 */
export function isGarbageDescription(description: string): boolean {
  if (!description || description.length < 80) return true;

  // Copyright/legal boilerplate
  if (/©|\bcopyright\b|all rights reserved/i.test(description)) return true;

  // Corporate boilerplate
  if (/visit our (corporate |)site/i.test(description)) return true;

  // Looks like concatenated headlines (3+ capitalized fragments separated by ; or |)
  const fragments = description.split(/[;|]/).filter(f => f.trim().length > 5);
  if (fragments.length >= 3) {
    const capsFragments = fragments.filter(f => /^[A-Z]/.test(f.trim()));
    if (capsFragments.length >= 3) return true;
  }

  // No lowercase letters (all caps dump)
  if (!/[a-z]/.test(description)) return true;

  // No punctuation (not a real sentence)
  if (!/[.,!?]/.test(description)) return true;

  // Common garbage patterns
  if (/^Follow Us/i.test(description)) return true;
  if (/^Share on/i.test(description)) return true;
  if (/^Click here/i.test(description)) return true;
  if (/^Subscribe/i.test(description)) return true;
  if (/^READ MORE/i.test(description)) return true;

  return false;
}
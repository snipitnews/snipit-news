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

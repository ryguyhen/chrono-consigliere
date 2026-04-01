// src/lib/format.ts
// Shared text-formatting utilities used across the app and scraper pipeline.

/**
 * Decode HTML entities in a plain-text string.
 *
 * Handles:
 *   - Named entities: &amp; &lt; &gt; &quot; &apos;
 *   - Decimal numeric entities: &#8220; &#8221; &#39; etc.
 *   - Hex numeric entities: &#x201C; &#x2019; etc.
 *
 * Safe to call on already-decoded strings (idempotent — won't double-decode
 * because after the first pass no `&...;` sequences remain).
 */
export function decodeHtmlEntities(text: string): string {
  return text
    // Named entities first
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Hex numeric entities (e.g. &#x201C;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Decimal numeric entities (e.g. &#8220; &#39; &#160;)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

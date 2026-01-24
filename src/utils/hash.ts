/**
 * Hash utilities for content identification
 */

/**
 * Generate a simple hash for content identification.
 * Uses a fast string hashing algorithm suitable for deduplication.
 *
 * @param content - The string content to hash
 * @returns A hash string in format "hexhash-length"
 */
export function hashContent(content: string): string {
  let hash = 0;
  // Only hash first 10000 chars for performance on large files
  const len = Math.min(content.length, 10000);
  for (let i = 0; i < len; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${hash.toString(16)}-${content.length}`;
}

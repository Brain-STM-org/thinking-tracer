/**
 * Hash utilities for content identification
 * Uses Web Crypto API for secure SHA-256 hashing
 */

/**
 * Generate a SHA-256 hash for content identification.
 * Hashes the entire content for collision resistance.
 *
 * @param content - The string content to hash
 * @returns A hash string in format "sha256hex-length"
 */
export async function hashContent(content: string): Promise<string> {
  if (!content) {
    return `${'0'.repeat(64)}-0`;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `${hashHex}-${content.length}`;
}

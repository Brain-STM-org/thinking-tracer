/**
 * Hash utilities for content identification
 * Uses Web Crypto API (SHA-256) when available, with fallback for non-secure contexts
 */

/**
 * FNV-1a hash fallback for non-secure contexts (plain HTTP)
 * where crypto.subtle is unavailable.
 * Hashes the full content with two independent 32-bit hashes for 64-bit collision resistance.
 */
function fnv1aFallback(content: string): string {
  // Two independent FNV-1a hashes with different offsets for better collision resistance
  let h1 = 0x811c9dc5;
  let h2 = 0x62b821b5;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x0100019d);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}-${content.length}`;
}

/**
 * Generate a hash for content identification.
 * Uses SHA-256 via Web Crypto API in secure contexts (HTTPS/localhost).
 * Falls back to FNV-1a in non-secure contexts (plain HTTP).
 *
 * @param content - The string content to hash
 * @returns A hash string in format "hex-length"
 */
export async function hashContent(content: string): Promise<string> {
  if (!content) {
    return `${'0'.repeat(16)}-0`;
  }

  if (crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex}-${content.length}`;
  }

  return fnv1aFallback(content);
}

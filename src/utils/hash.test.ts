/**
 * Unit tests for hash utilities
 */

import { describe, it, expect } from 'vitest';
import { hashContent } from './hash';

describe('hashContent', () => {
  it('generates consistent hash for same content', async () => {
    const content = 'test content';
    const hash1 = await hashContent(content);
    const hash2 = await hashContent(content);
    expect(hash1).toBe(hash2);
  });

  it('generates different hashes for different content', async () => {
    const hash1 = await hashContent('content A');
    const hash2 = await hashContent('content B');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', async () => {
    const hash = await hashContent('');
    expect(hash).toBe('0'.repeat(16) + '-0');
  });

  it('includes content length in hash', async () => {
    const hash = await hashContent('test');
    expect(hash).toMatch(/-4$/);
  });

  it('hashes entire content for long files', async () => {
    const content = 'x'.repeat(20000);
    const hash = await hashContent(content);
    // Should include full length
    expect(hash).toContain('-20000');
  });

  it('returns string in expected format', async () => {
    const hash = await hashContent('test');
    // Format: 64-char hex SHA-256 followed by -length
    expect(hash).toMatch(/^[0-9a-f]{64}-\d+$/);
  });

  it('handles special characters', async () => {
    const hash = await hashContent('Hello\nWorld\t!@#$%^&*()');
    expect(hash).toMatch(/^[0-9a-f]{64}-\d+$/);
  });

  it('handles unicode characters', async () => {
    const hash = await hashContent('Hello 世界 🌍');
    expect(hash).toMatch(/^[0-9a-f]{64}-\d+$/);
  });

  it('produces different hashes for similar content', async () => {
    const hash1 = await hashContent('abc');
    const hash2 = await hashContent('abd');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for content differing only at end', async () => {
    // Verify the full content is hashed, not just a prefix
    const base = 'a'.repeat(15000);
    const hash1 = await hashContent(base + 'x');
    const hash2 = await hashContent(base + 'y');
    expect(hash1).not.toBe(hash2);
  });

  it('produces known SHA-256 hash for test vector', async () => {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const hash = await hashContent('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824-5');
  });
});

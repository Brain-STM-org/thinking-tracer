/**
 * Unit tests for hash utilities
 */

import { describe, it, expect } from 'vitest';
import { hashContent } from './hash';

describe('hashContent', () => {
  it('generates consistent hash for same content', () => {
    const content = 'test content';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
  });

  it('generates different hashes for different content', () => {
    const hash1 = hashContent('content A');
    const hash2 = hashContent('content B');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = hashContent('');
    expect(hash).toBe('0-0');
  });

  it('includes content length in hash', () => {
    const hash = hashContent('test');
    expect(hash).toMatch(/-4$/);
  });

  it('handles long content efficiently', () => {
    const content = 'x'.repeat(20000);
    const hash = hashContent(content);
    // Should include full length even though only first 10000 chars are hashed
    expect(hash).toContain('-20000');
  });

  it('returns string in expected format', () => {
    const hash = hashContent('test');
    // Format: hexhash-length
    expect(hash).toMatch(/^-?[0-9a-f]+-\d+$/);
  });

  it('handles special characters', () => {
    const hash = hashContent('Hello\nWorld\t!@#$%^&*()');
    expect(hash).toMatch(/^-?[0-9a-f]+-\d+$/);
  });

  it('handles unicode characters', () => {
    const hash = hashContent('Hello 世界 🌍');
    expect(hash).toMatch(/^-?[0-9a-f]+-\d+$/);
  });

  it('produces different hashes for similar content', () => {
    const hash1 = hashContent('abc');
    const hash2 = hashContent('abd');
    expect(hash1).not.toBe(hash2);
  });

  it('handles content at exactly 10000 chars', () => {
    const content = 'a'.repeat(10000);
    const hash = hashContent(content);
    expect(hash).toContain('-10000');
  });

  it('handles content just over 10000 chars', () => {
    const content = 'a'.repeat(10001);
    const hash = hashContent(content);
    expect(hash).toContain('-10001');
    // Hash should be same as 10000 chars since we only hash first 10000
    const truncatedHash = hashContent('a'.repeat(10000));
    expect(hash.split('-')[0]).toBe(truncatedHash.split('-')[0]);
  });
});

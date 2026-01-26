/**
 * Tests for search functionality
 */

import { describe, it, expect } from 'vitest';
import {
  isValidRegex,
  findMatch,
  highlightSnippet,
  performSearch,
  getMatchingClusters,
  getNextResultIndex,
  getPrevResultIndex,
  formatResultCount,
  type SearchableCluster,
} from './searcher';

describe('isValidRegex', () => {
  it('returns true for valid regex patterns', () => {
    expect(isValidRegex('hello')).toBe(true);
    expect(isValidRegex('hello.*world')).toBe(true);
    expect(isValidRegex('[a-z]+')).toBe(true);
    expect(isValidRegex('\\d{3}-\\d{4}')).toBe(true);
  });

  it('returns false for invalid regex patterns', () => {
    expect(isValidRegex('[')).toBe(false);
    expect(isValidRegex('(unclosed')).toBe(false);
    expect(isValidRegex('*invalid')).toBe(false);
    expect(isValidRegex('[z-a]')).toBe(false);
  });

  it('returns true for empty string', () => {
    expect(isValidRegex('')).toBe(true);
  });
});

describe('findMatch', () => {
  describe('plain text mode', () => {
    it('finds case-insensitive match', () => {
      const result = findMatch('Hello World', 'world', false);
      expect(result.found).toBe(true);
      expect(result.start).toBe(6);
      expect(result.end).toBe(11);
    });

    it('returns snippet with context', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const result = findMatch(text, 'fox', false, 10, 10);
      expect(result.found).toBe(true);
      expect(result.snippet).toContain('fox');
    });

    it('adds ellipsis when truncated at start', () => {
      const text = 'A'.repeat(50) + 'target' + 'B'.repeat(50);
      const result = findMatch(text, 'target', false, 10, 10);
      expect(result.snippet.startsWith('...')).toBe(true);
    });

    it('adds ellipsis when truncated at end', () => {
      const text = 'A'.repeat(10) + 'target' + 'B'.repeat(100);
      const result = findMatch(text, 'target', false, 20, 10);
      expect(result.snippet.endsWith('...')).toBe(true);
    });

    it('returns not found for no match', () => {
      const result = findMatch('Hello World', 'xyz', false);
      expect(result.found).toBe(false);
      expect(result.snippet).toBe('');
      expect(result.start).toBe(-1);
    });

    it('handles empty text', () => {
      const result = findMatch('', 'query', false);
      expect(result.found).toBe(false);
    });

    it('handles empty query', () => {
      const result = findMatch('some text', '', false);
      expect(result.found).toBe(false);
    });
  });

  describe('regex mode', () => {
    it('finds regex match', () => {
      const result = findMatch('Error code: 404', '\\d+', true);
      expect(result.found).toBe(true);
      expect(result.snippet).toContain('404');
    });

    it('handles complex regex patterns', () => {
      const result = findMatch('Email: test@example.com here', '[a-z]+@[a-z]+\\.[a-z]+', true);
      expect(result.found).toBe(true);
      expect(result.snippet).toContain('test@example.com');
    });

    it('returns not found for invalid regex', () => {
      const result = findMatch('some text', '[invalid', true);
      expect(result.found).toBe(false);
    });

    it('is case insensitive', () => {
      const result = findMatch('Hello World', 'HELLO', true);
      expect(result.found).toBe(true);
    });
  });
});

describe('highlightSnippet', () => {
  it('wraps match in mark tags', () => {
    const result = highlightSnippet('Hello World', 'World');
    expect(result).toBe('Hello <mark>World</mark>');
  });

  it('handles case-insensitive matching', () => {
    const result = highlightSnippet('Hello World', 'world');
    expect(result).toContain('<mark>World</mark>');
  });

  it('escapes HTML in non-matched parts', () => {
    const result = highlightSnippet('<script>alert("xss")</script> World', 'World');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('<mark>World</mark>');
  });

  it('escapes HTML in matched parts', () => {
    const result = highlightSnippet('test <b>bold</b> test', '<b>');
    expect(result).toContain('<mark>&lt;b&gt;</mark>');
  });

  it('returns escaped text when no query', () => {
    const result = highlightSnippet('<test>', '');
    expect(result).toBe('&lt;test&gt;');
  });

  it('returns empty string for empty snippet', () => {
    expect(highlightSnippet('', 'query')).toBe('');
  });

  it('returns escaped text when no match found', () => {
    const result = highlightSnippet('Hello World', 'xyz');
    expect(result).toBe('Hello World');
    expect(result).not.toContain('<mark>');
  });

  describe('regex mode', () => {
    it('highlights regex matches', () => {
      const result = highlightSnippet('Error 404 found', '\\d+', true);
      expect(result).toContain('<mark>404</mark>');
    });

    it('falls back to plain text for invalid regex', () => {
      // Use a truly invalid regex pattern that throws
      const result = highlightSnippet('test (text', '(unclosed', true);
      expect(result).toBe('test (text');
    });
  });
});

describe('performSearch', () => {
  const sampleClusters: SearchableCluster[] = [
    {
      clusterIndex: 0,
      userText: 'How do I use TypeScript?',
      assistantText: 'TypeScript is a typed superset of JavaScript.',
      thinkingBlocks: [{ text: 'Let me think about TypeScript...' }],
      toolUses: [{ name: 'read_file', input: '{"path": "tsconfig.json"}' }],
      toolResults: [{ content: '{"compilerOptions": {}}', isError: false }],
      documents: [],
    },
    {
      clusterIndex: 1,
      userText: 'What about Python?',
      assistantText: 'Python is a dynamic language.',
      thinkingBlocks: [],
      toolUses: [],
      toolResults: [],
      documents: [],
    },
  ];

  it('finds matches in user text', () => {
    const results = performSearch(sampleClusters, 'TypeScript', {
      filters: new Set(['user']),
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('user');
    expect(results[0].clusterIndex).toBe(0);
  });

  it('finds matches in assistant text', () => {
    const results = performSearch(sampleClusters, 'TypeScript', {
      filters: new Set(['assistant']),
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('assistant');
  });

  it('finds matches in thinking blocks', () => {
    const results = performSearch(sampleClusters, 'TypeScript', {
      filters: new Set(['thinking']),
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('thinking');
  });

  it('finds matches in tool uses', () => {
    const results = performSearch(sampleClusters, 'tsconfig', {
      filters: new Set(['tool_use']),
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('tool_use');
  });

  it('finds matches in tool results', () => {
    const results = performSearch(sampleClusters, 'compilerOptions', {
      filters: new Set(['tool_result']),
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('tool_result');
  });

  it('respects filter settings', () => {
    const results = performSearch(sampleClusters, 'TypeScript', {
      filters: new Set(['user']), // Only search user text
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('user');
  });

  it('searches all types when all filters enabled', () => {
    const results = performSearch(sampleClusters, 'TypeScript', {
      filters: new Set(['user', 'assistant', 'thinking', 'tool_use', 'tool_result']),
    });
    expect(results).toHaveLength(3); // user, assistant, thinking
  });

  it('returns empty array for empty query', () => {
    const results = performSearch(sampleClusters, '');
    expect(results).toHaveLength(0);
  });

  it('returns empty array for whitespace-only query', () => {
    const results = performSearch(sampleClusters, '   ');
    expect(results).toHaveLength(0);
  });

  it('supports regex mode', () => {
    const results = performSearch(sampleClusters, 'Type.*Script', {
      useRegex: true,
      filters: new Set(['user']),
    });
    expect(results).toHaveLength(1);
  });

  it('returns empty for invalid regex in regex mode', () => {
    const results = performSearch(sampleClusters, '[invalid', {
      useRegex: true,
    });
    expect(results).toHaveLength(0);
  });

  it('searches across multiple clusters', () => {
    const results = performSearch(sampleClusters, 'language', {
      filters: new Set(['assistant']),
    });
    expect(results).toHaveLength(1);
    expect(results[0].clusterIndex).toBe(1);
  });

  it('is case insensitive', () => {
    const results = performSearch(sampleClusters, 'TYPESCRIPT', {
      filters: new Set(['user']),
    });
    expect(results).toHaveLength(1);
  });
});

describe('getMatchingClusters', () => {
  it('returns unique cluster indices', () => {
    const results = [
      { type: 'user' as const, clusterIndex: 0, text: '', matchStart: 0, matchEnd: 0 },
      { type: 'assistant' as const, clusterIndex: 0, text: '', matchStart: 0, matchEnd: 0 },
      { type: 'user' as const, clusterIndex: 1, text: '', matchStart: 0, matchEnd: 0 },
      { type: 'thinking' as const, clusterIndex: 2, text: '', matchStart: 0, matchEnd: 0 },
    ];

    const clusters = getMatchingClusters(results);
    expect(clusters).toEqual([0, 1, 2]);
  });

  it('returns empty array for no results', () => {
    expect(getMatchingClusters([])).toEqual([]);
  });

  it('deduplicates same cluster appearing multiple times', () => {
    const results = [
      { type: 'user' as const, clusterIndex: 5, text: '', matchStart: 0, matchEnd: 0 },
      { type: 'thinking' as const, clusterIndex: 5, text: '', matchStart: 0, matchEnd: 0 },
      { type: 'assistant' as const, clusterIndex: 5, text: '', matchStart: 0, matchEnd: 0 },
    ];

    const clusters = getMatchingClusters(results);
    expect(clusters).toEqual([5]);
  });
});

describe('getNextResultIndex', () => {
  it('returns next index', () => {
    expect(getNextResultIndex(0, 5)).toBe(1);
    expect(getNextResultIndex(3, 5)).toBe(4);
  });

  it('wraps around at end', () => {
    expect(getNextResultIndex(4, 5)).toBe(0);
  });

  it('returns -1 for empty results', () => {
    expect(getNextResultIndex(0, 0)).toBe(-1);
  });
});

describe('getPrevResultIndex', () => {
  it('returns previous index', () => {
    expect(getPrevResultIndex(3, 5)).toBe(2);
    expect(getPrevResultIndex(1, 5)).toBe(0);
  });

  it('wraps around at start', () => {
    expect(getPrevResultIndex(0, 5)).toBe(4);
  });

  it('returns -1 for empty results', () => {
    expect(getPrevResultIndex(0, 0)).toBe(-1);
  });
});

describe('formatResultCount', () => {
  it('formats current position', () => {
    expect(formatResultCount(0, 10, true)).toBe('1 / 10');
    expect(formatResultCount(5, 10, true)).toBe('6 / 10');
  });

  it('returns "No matches" when no results but has query', () => {
    expect(formatResultCount(-1, 0, true)).toBe('No matches');
  });

  it('returns empty string when no results and no query', () => {
    expect(formatResultCount(-1, 0, false)).toBe('');
  });
});

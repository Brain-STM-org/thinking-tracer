/**
 * Search functionality for conversation traces
 */

import { escapeHtml } from '../export';
import type { SearchableCluster } from '../data/types';

/**
 * Content type for search filtering
 */
export type SearchContentType = 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result';

/**
 * A single search result
 */
export interface SearchResult {
  type: SearchContentType;
  clusterIndex: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Match result from findMatch
 */
export interface MatchResult {
  found: boolean;
  snippet: string;
  start: number;
  end: number;
}

// Re-export for consumers that import from here
export type { SearchableCluster };

/**
 * Search options
 */
export interface SearchOptions {
  useRegex: boolean;
  filters: Set<SearchContentType>;
  contextBefore?: number;
  contextAfter?: number;
}

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  useRegex: false,
  filters: new Set(['user', 'assistant', 'thinking', 'tool_use', 'tool_result']),
  contextBefore: 30,
  contextAfter: 50,
};

/**
 * Validate a regex pattern
 */
export function isValidRegex(pattern: string): boolean {
  if (!pattern) return true; // Empty is valid (just won't match anything)
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

/**
 * Find first match in text and return context snippet
 * Supports both plain text (case-insensitive) and regex modes
 */
export function findMatch(
  text: string,
  query: string,
  useRegex: boolean,
  contextBefore = 30,
  contextAfter = 50
): MatchResult {
  if (!text || !query) {
    return { found: false, snippet: '', start: -1, end: -1 };
  }

  let matchIndex = -1;
  let matchLength = 0;

  if (useRegex) {
    try {
      const regex = new RegExp(query, 'i'); // case-insensitive
      const match = text.match(regex);
      if (match && match.index !== undefined) {
        matchIndex = match.index;
        matchLength = match[0].length;
      }
    } catch {
      // Invalid regex - no match
      return { found: false, snippet: '', start: -1, end: -1 };
    }
  } else {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    matchIndex = lowerText.indexOf(lowerQuery);
    matchLength = query.length;
  }

  if (matchIndex === -1) {
    return { found: false, snippet: '', start: -1, end: -1 };
  }

  // Extract context around match
  const snippetStart = Math.max(0, matchIndex - contextBefore);
  const snippetEnd = Math.min(text.length, matchIndex + matchLength + contextAfter);
  let snippet = text.slice(snippetStart, snippetEnd);

  // Add ellipsis if truncated
  if (snippetStart > 0) snippet = '...' + snippet;
  if (snippetEnd < text.length) snippet = snippet + '...';

  return { found: true, snippet, start: matchIndex, end: matchIndex + matchLength };
}

/**
 * Highlight search query in snippet (for display)
 * Returns HTML with <mark> tags around matches
 */
export function highlightSnippet(snippet: string, query: string, useRegex = false): string {
  if (!snippet) return '';
  if (!query) return escapeHtml(snippet);

  if (useRegex) {
    try {
      const regex = new RegExp(`(${query})`, 'gi');
      const parts = snippet.split(regex);
      return parts
        .map((part, i) => {
          // Odd indices are matches (captured groups)
          if (i % 2 === 1) {
            return `<mark>${escapeHtml(part)}</mark>`;
          }
          return escapeHtml(part);
        })
        .join('');
    } catch {
      // Invalid regex, fall through to plain text
    }
  }

  // Plain text case-insensitive highlighting
  const lowerSnippet = snippet.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerSnippet.indexOf(lowerQuery);

  if (index === -1) return escapeHtml(snippet);

  const before = snippet.slice(0, index);
  const match = snippet.slice(index, index + query.length);
  const after = snippet.slice(index + query.length);

  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

/**
 * Perform search across all clusters
 */
export function performSearch(
  clusters: SearchableCluster[],
  query: string,
  options: Partial<SearchOptions> = {}
): SearchResult[] {
  const results: SearchResult[] = [];

  if (!query.trim()) return results;

  const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  const { useRegex, filters, contextBefore, contextAfter } = opts;

  // Validate regex if in regex mode
  if (useRegex && !isValidRegex(query)) {
    return results;
  }

  for (const cluster of clusters) {
    // Search user text
    if (filters.has('user') && cluster.userText) {
      const match = findMatch(cluster.userText, query, useRegex, contextBefore, contextAfter);
      if (match.found) {
        results.push({
          type: 'user',
          clusterIndex: cluster.clusterIndex,
          text: match.snippet,
          matchStart: match.start,
          matchEnd: match.end,
        });
      }
    }

    // Search assistant text
    if (filters.has('assistant') && cluster.assistantText) {
      const match = findMatch(cluster.assistantText, query, useRegex, contextBefore, contextAfter);
      if (match.found) {
        results.push({
          type: 'assistant',
          clusterIndex: cluster.clusterIndex,
          text: match.snippet,
          matchStart: match.start,
          matchEnd: match.end,
        });
      }
    }

    // Search thinking blocks
    if (filters.has('thinking')) {
      for (const thinking of cluster.thinkingBlocks) {
        const match = findMatch(thinking, query, useRegex, contextBefore, contextAfter);
        if (match.found) {
          results.push({
            type: 'thinking',
            clusterIndex: cluster.clusterIndex,
            text: match.snippet,
            matchStart: match.start,
            matchEnd: match.end,
          });
        }
      }
    }

    // Search tool uses
    if (filters.has('tool_use')) {
      for (const toolUse of cluster.toolUses) {
        const searchText = `${toolUse.name} ${toolUse.input}`;
        const match = findMatch(searchText, query, useRegex, contextBefore, contextAfter);
        if (match.found) {
          results.push({
            type: 'tool_use',
            clusterIndex: cluster.clusterIndex,
            text: match.snippet,
            matchStart: match.start,
            matchEnd: match.end,
          });
        }
      }
    }

    // Search tool results
    if (filters.has('tool_result')) {
      for (const toolResult of cluster.toolResults) {
        const match = findMatch(toolResult.content, query, useRegex, contextBefore, contextAfter);
        if (match.found) {
          results.push({
            type: 'tool_result',
            clusterIndex: cluster.clusterIndex,
            text: match.snippet,
            matchStart: match.start,
            matchEnd: match.end,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Get unique cluster indices from search results
 */
export function getMatchingClusters(results: SearchResult[]): number[] {
  return [...new Set(results.map((r) => r.clusterIndex))];
}

/**
 * Calculate next result index (with wrapping)
 */
export function getNextResultIndex(currentIndex: number, totalResults: number): number {
  if (totalResults === 0) return -1;
  return (currentIndex + 1) % totalResults;
}

/**
 * Calculate previous result index (with wrapping)
 */
export function getPrevResultIndex(currentIndex: number, totalResults: number): number {
  if (totalResults === 0) return -1;
  return currentIndex <= 0 ? totalResults - 1 : currentIndex - 1;
}

/**
 * Format result count display string
 */
export function formatResultCount(currentIndex: number, totalResults: number, hasQuery: boolean): string {
  if (totalResults === 0) {
    return hasQuery ? 'No matches' : '';
  }
  return `${currentIndex + 1} / ${totalResults}`;
}

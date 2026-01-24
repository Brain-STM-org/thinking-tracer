/**
 * Search module - search functionality for conversation traces
 */

export {
  isValidRegex,
  findMatch,
  highlightSnippet,
  performSearch,
  getMatchingClusters,
  getNextResultIndex,
  getPrevResultIndex,
  formatResultCount,
  DEFAULT_SEARCH_OPTIONS,
  type SearchResult,
  type MatchResult,
  type SearchableCluster,
  type SearchOptions,
  type SearchContentType,
} from './searcher';

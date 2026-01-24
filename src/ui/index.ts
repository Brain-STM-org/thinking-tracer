/**
 * UI module - panel components and types
 */

export { MetricsPanel } from './panels';
export { DetailPanel, truncate, buildTurnText } from './panels';
export {
  WordFrequencyPanel,
  extractWords,
  getWordFrequencies,
  hexToCSS,
  getHighlightColor,
} from './panels';
export { ConversationPanel } from './panels';
export { formatMetricValue } from './panels/MetricsPanel';

export type {
  MetricKey,
  ClusterMetrics,
  ViewerInterface,
  MetricsPanelElements,
  SearchableCluster,
  Selection,
  ConversationData,
} from './types';
export type { DetailPanelElements } from './panels/DetailPanel';
export type { WordFrequencyPanelElements, WordFrequencySource } from './panels/WordFrequencyPanel';
export type { ConversationPanelElements, ConversationFilterState } from './panels/ConversationPanel';

// Loaders
export { FileLoader, RecentTracesManager } from './loaders';
export type {
  FileLoaderOptions,
  FileLoadCallback,
  RecentTracesManagerOptions,
  RecentTraceSelectCallback,
  RecentTrace,
  TraceUIState,
} from './loaders';

// Search
export { SearchController } from './search';
export type {
  SearchControllerElements,
  SearchControllerOptions,
  SearchableViewer,
  FilterablePanel,
} from './search';

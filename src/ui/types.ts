/**
 * Shared types for UI panels
 */

/**
 * Metric keys available for charting
 */
export type MetricKey =
  | 'totalTokens'
  | 'outputTokens'
  | 'inputTokens'
  | 'thinkingCount'
  | 'toolCount'
  | 'contentLength';

/**
 * Cluster metrics data structure (from Viewer)
 */
export interface ClusterMetrics {
  index: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  thinkingCount: number;
  toolCount: number;
  contentLength: number;
}

/**
 * Searchable cluster data structure
 */
export interface SearchableCluster {
  clusterIndex: number;
  userText: string;
  assistantText: string;
  thinkingBlocks: string[];
  toolUses: Array<{ name: string; input: string }>;
  toolResults: Array<{ content: string; isError: boolean }>;
}

/**
 * Selection data from the viewer
 */
export interface Selection {
  type: string;
  data: unknown;
  turnIndex: number;
  clusterIndex?: number;
}

/**
 * Minimal viewer interface for UI panels
 * Panels depend on this interface, not the full Viewer class
 */
export interface ViewerInterface {
  getClusterCount(): number;
  getClusterMetrics(): ClusterMetrics[];
  getSearchableContent(): SearchableCluster[];
  selectClusterByIndex(index: number): void;
  toggleCluster(index: number): void;
  focusOnCluster(index: number): void;
}

/**
 * DOM elements required by MetricsPanel
 */
export interface MetricsPanelElements {
  container: HTMLElement;
  rangeLabel?: HTMLElement | null;
  tooltip?: HTMLElement | null;
}

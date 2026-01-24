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
 * Minimal viewer interface for UI panels
 * Panels depend on this interface, not the full Viewer class
 */
export interface ViewerInterface {
  getClusterCount(): number;
  getClusterMetrics(): ClusterMetrics[];
  selectClusterByIndex(index: number): void;
}

/**
 * DOM elements required by MetricsPanel
 */
export interface MetricsPanelElements {
  container: HTMLElement;
  rangeLabel?: HTMLElement | null;
  tooltip?: HTMLElement | null;
}

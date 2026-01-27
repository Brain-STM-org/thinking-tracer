/**
 * Shared types for UI panels
 */

import type { SearchableCluster } from '../data/types';

// Re-export SearchableCluster from canonical location
export type { SearchableCluster };

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
 * Selection data from the viewer
 */
export interface Selection {
  type: string;
  data: unknown;
  turnIndex: number;
  clusterIndex?: number;
}

/**
 * Conversation data structure (simplified for UI panels)
 */
export interface ConversationData {
  meta: {
    title?: string;
    model?: string;
    cwd?: string;
    git_branch?: string;
    duration_ms?: number;
    source?: string;
  };
  turns: unknown[];
}

/**
 * Minimal viewer interface for UI panels
 * Panels depend on this interface, not the full Viewer class
 */
export interface ViewerInterface {
  getClusterCount(): number;
  getClusterMetrics(): ClusterMetrics[];
  getSearchableContent(): SearchableCluster[];
  getConversation(): ConversationData | null;
  selectClusterByIndex(index: number): void;
  toggleCluster(index: number): void;
  focusOnCluster(index: number): void;
  // Word highlighting methods
  highlightClustersWithWord(word: string, color: number): number[];
  unhighlightClustersByColor(color: number): void;
  clearAllHighlights(): void;
}

/**
 * DOM elements required by MetricsPanel
 */
export interface MetricsPanelElements {
  container: HTMLElement;
  rangeLabel?: HTMLElement | null;
  tooltip?: HTMLElement | null;
}

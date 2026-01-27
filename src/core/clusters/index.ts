/**
 * Clusters module - pure functions for building and analyzing conversation clusters
 */

export {
  buildClusters,
  extractSearchableContent,
  calculateClusterMetrics,
  clusterContainsWord,
  findClustersWithWord,
  isToolResultOnly,
} from './cluster-builder';

export type {
  TurnCluster,
  SearchableClusterContent,
  ClusterMetrics,
} from './cluster-builder';

// Export strategy types and registry
export { strategyRegistry, claudeCodeStrategy } from './strategies';
export type { ClusterStrategy, ClusterTimingData } from './strategies';

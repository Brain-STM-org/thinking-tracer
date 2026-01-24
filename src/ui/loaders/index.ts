/**
 * Loaders module - file loading and recent traces management
 */

export { FileLoader, type FileLoaderOptions, type FileLoadCallback } from './FileLoader';
export {
  RecentTracesManager,
  type RecentTracesManagerOptions,
  type RecentTraceSelectCallback,
  type RecentTrace,
  type TraceUIState,
} from './RecentTracesManager';

/**
 * Loaders module - file loading and recent traces management
 */

export { FileLoader, type FileLoaderOptions, type FileLoadCallback } from './FileLoader';
export {
  RecentTracesManager,
  type RecentTracesManagerOptions,
  type RecentTraceSelectCallback,
  type ExampleTraceSelectCallback,
  type RecentTrace,
  type TraceUIState,
  type ExampleTrace,
} from './RecentTracesManager';

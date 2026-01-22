/**
 * thinking-trace-viewer
 *
 * WebGL/WebGPU visualization tool for exploring LLM conversations in 3D
 *
 * @packageDocumentation
 */

// Core exports
export { Viewer, type ViewerOptions, type ViewerStats } from './core/Viewer';
export { Scene, type SceneOptions } from './core/Scene';
export { Controls, type ControlsOptions } from './core/Controls';

// Data types
export type {
  Conversation,
  ConversationMeta,
  Turn,
  ContentBlock,
  ContentBlockType,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ToolResultBlock,
  ImageBlock,
  TokenUsage,
  Role,
  TraceParser,
} from './data/types';

// Parsers
export { claudeCodeParser } from './data/parsers/claude-code';

// Utilities
export { initFileDrop, type FileDropOptions } from './utils/file-drop';

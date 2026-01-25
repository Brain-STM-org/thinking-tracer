/**
 * Core data types for conversation traces
 */

/** Supported content block types */
export type ContentBlockType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'image'
  | 'document';

/** Base interface for all content blocks */
export interface ContentBlockBase {
  type: ContentBlockType;
  id?: string;
}

/** Text content block */
export interface TextBlock extends ContentBlockBase {
  type: 'text';
  text: string;
}

/** Thinking/reasoning block */
export interface ThinkingBlock extends ContentBlockBase {
  type: 'thinking';
  thinking: string;
  /** Whether thinking content was redacted */
  redacted?: boolean;
  /** Signature for thinking block verification */
  signature?: string;
}

/** Tool use block */
export interface ToolUseBlock extends ContentBlockBase {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Tool result block */
export interface ToolResultBlock extends ContentBlockBase {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

/** Image content block */
export interface ImageBlock extends ContentBlockBase {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
    url?: string;
  };
}

/** Document content block (PDFs, text files, etc.) */
export interface DocumentBlock extends ContentBlockBase {
  type: 'document';
  source: {
    type: 'base64' | 'url' | 'file';
    media_type?: string;
    data?: string;
    url?: string;
    file_id?: string;
  };
  title?: string;
  context?: string;
}

/** Union of all content block types */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock
  | DocumentBlock;

/** Role in a conversation turn */
export type Role = 'user' | 'assistant' | 'system';

/** A single turn in the conversation */
export interface Turn {
  id: string;
  role: Role;
  content: ContentBlock[];
  /** Timestamp of the turn */
  timestamp?: string;
  /** Model used for this turn (assistant only) */
  model?: string;
  /** Token usage for this turn */
  usage?: TokenUsage;
  /** Parent turn ID for branching conversations */
  parentId?: string;
  /** Whether this turn is part of a sidechain (sub-agent) */
  isSidechain?: boolean;
  /** Agent ID if from a sub-agent */
  agentId?: string;
  /** Error message if this turn encountered an error */
  error?: string;
  /** Whether this is an API error message */
  isApiErrorMessage?: boolean;
  /** Stop reason from the API response */
  stopReason?: string;
  /** Request ID from the API */
  requestId?: string;
  /** Thinking metadata for this turn */
  thinkingMetadata?: ThinkingMetadata;
  /** Permission mode active during this turn */
  permissionMode?: string;
  /** Original entry type from JSONL */
  entryType?: EntryType;
}

/** Cache creation token details */
export interface CacheCreation {
  ephemeral_5m_input_tokens?: number;
  ephemeral_1h_input_tokens?: number;
}

/** Token usage information */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  thinking_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  /** Detailed cache creation breakdown */
  cache_creation?: CacheCreation;
  /** Tokens used by server-side tool execution */
  server_tool_use?: number;
  /** Service tier used for the request */
  service_tier?: string;
}

/** Thinking configuration metadata */
export interface ThinkingMetadata {
  level?: string;
  disabled?: boolean;
  triggers?: string[];
}

/** Metadata about the conversation */
export interface ConversationMeta {
  /** Unique identifier for the conversation */
  id?: string;
  /** Title or summary */
  title?: string;
  /** When the conversation started */
  created_at?: string;
  /** When the conversation was last updated */
  updated_at?: string;
  /** Primary model used */
  model?: string;
  /** Source agent/application */
  source?: string;
  /** Source application version */
  source_version?: string;
  /** Working directory */
  cwd?: string;
  /** Git branch */
  git_branch?: string;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Total token usage */
  total_usage?: TokenUsage;
  /** Conversation slug */
  slug?: string;
  /** Summary entries extracted from the conversation */
  summaries?: string[];
  /** Number of system entries in the conversation */
  systemMessageCount?: number;
  /** Whether any entries had errors */
  hasErrors?: boolean;
  /** Unique agent IDs found in the conversation */
  agentIds?: string[];
}

/** Complete conversation trace */
export interface Conversation {
  meta: ConversationMeta;
  turns: Turn[];
  /** Raw entries from JSONL (all entry types, not just user/assistant) */
  entries?: Entry[];
}

/** Parser interface for different agent formats */
export interface TraceParser {
  /** Check if this parser can handle the given data */
  canParse(data: unknown): boolean;
  /** Parse raw data into a Conversation */
  parse(data: unknown): Conversation;
}

/**
 * Document/media attachment metadata
 */
export interface DocumentMeta {
  /** MIME type (e.g., "image/png", "application/pdf") */
  mediaType: string;
  /** Source type: url, base64, or file (Files API) */
  sourceType: 'url' | 'base64' | 'file';
  /** Size in bytes (for base64 data) */
  size?: number;
  /** Document title if provided */
  title?: string;
}

/**
 * Searchable content extracted from a cluster/turn
 * Used for search, export, and display purposes
 */
export interface SearchableCluster {
  clusterIndex: number;
  userText: string;
  assistantText: string;
  thinkingBlocks: string[];
  toolUses: Array<{ name: string; input: string }>;
  toolResults: Array<{ content: string; isError: boolean }>;
  /** Document/media attachments (images, PDFs, etc.) - metadata only */
  documents: DocumentMeta[];
  /** Whether this cluster is from a sidechain */
  isSidechain?: boolean;
  /** Agent ID if from a sub-agent */
  agentId?: string;
  /** Whether this cluster has an error */
  hasError?: boolean;
  /** Stop reason from the assistant turn */
  stopReason?: string;
  /** Error message text */
  error?: string;
}

// ============================================
// Entry types (full JSONL line representation)
// ============================================

/** All known entry types from Claude Code JSONL */
export type EntryType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'progress'
  | 'file-history-snapshot'
  | 'summary'
  | 'queue-operation';

/** Parsed user message within an entry */
export interface ParsedUserMessage {
  role: 'user';
  content: ContentBlock[] | string;
}

/** Parsed assistant message within an entry */
export interface ParsedAssistantMessage {
  role: 'assistant';
  model?: string;
  content: ContentBlock[];
  stopReason?: string;
  usage?: TokenUsage;
}

/** Full JSONL line representation (~30 fields, matching Go struct) */
export interface Entry {
  // Identity
  type: EntryType;
  uuid?: string;
  parentUuid?: string;
  sessionId?: string;

  // Timing
  timestamp?: string;

  // Environment
  version?: string;
  cwd?: string;
  gitBranch?: string;

  // Message content (parsed from raw message field)
  parsedUserMessage?: ParsedUserMessage;
  parsedAssistantMessage?: ParsedAssistantMessage;

  // Agent/sidechain
  isSidechain?: boolean;
  agentId?: string;

  // Error handling
  error?: string;
  isApiErrorMessage?: boolean;

  // API response metadata
  stopReason?: string;
  requestId?: string;

  // Thinking configuration
  thinkingMetadata?: ThinkingMetadata;

  // Permission
  permissionMode?: string;

  // Summary (for type='summary')
  summary?: string;

  // Progress (for type='progress')
  progressStatus?: string;

  // Raw message for anything not parsed above
  rawMessage?: Record<string, unknown>;
}

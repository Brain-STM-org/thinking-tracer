/**
 * Core data types for conversation traces
 */

/** Supported content block types */
export type ContentBlockType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'image';

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

/** Union of all content block types */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock;

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
}

/** Token usage information */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  thinking_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
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
}

/** Complete conversation trace */
export interface Conversation {
  meta: ConversationMeta;
  turns: Turn[];
}

/** Parser interface for different agent formats */
export interface TraceParser {
  /** Check if this parser can handle the given data */
  canParse(data: unknown): boolean;
  /** Parse raw data into a Conversation */
  parse(data: unknown): Conversation;
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
}

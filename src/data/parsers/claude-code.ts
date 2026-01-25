/**
 * Parser for Claude Code conversation files (JSONL format)
 */

import type {
  Conversation,
  ConversationMeta,
  Turn,
  ContentBlock,
  ImageBlock,
  TraceParser,
  TokenUsage,
  Entry,
  EntryType,
  ParsedUserMessage,
  ParsedAssistantMessage,
  ThinkingMetadata,
  CacheCreation,
} from '../types';

/** Raw Claude Code JSONL line (used only for legacy object format) */
interface LegacyClaudeCodeLine {
  type: 'user' | 'assistant' | 'file-history-snapshot' | string;
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  version?: string;
  cwd?: string;
  gitBranch?: string;
  message?: {
    role?: string;
    content?: unknown[] | string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

/**
 * Parse a raw content block from Claude Code format
 */
function parseContentBlock(raw: unknown): ContentBlock | null {
  if (typeof raw === 'string') {
    return { type: 'text', text: raw };
  }

  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const block = raw as Record<string, unknown>;

  switch (block.type) {
    case 'text':
      return {
        type: 'text',
        text: String(block.text || ''),
      };

    case 'thinking':
      return {
        type: 'thinking',
        thinking: String(block.thinking || ''),
        redacted: block.redacted === true,
        ...(typeof block.signature === 'string' ? { signature: block.signature } : {}),
      };

    case 'tool_use':
      return {
        type: 'tool_use',
        id: String(block.id || ''),
        name: String(block.name || ''),
        input: (block.input as Record<string, unknown>) || {},
      };

    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: String(block.tool_use_id || ''),
        content: String(block.content || ''),
        is_error: block.is_error === true,
      };

    case 'image':
      return {
        type: 'image',
        source: block.source as ImageBlock['source'],
      };

    default:
      // Unknown block type, try to extract as text
      if ('text' in block) {
        return { type: 'text', text: String(block.text) };
      }
      return null;
  }
}

/**
 * Parse user message content from raw message.
 * The role can be determined by the entry type, so we accept an optional roleHint.
 */
function parseUserMessage(message: Record<string, unknown>, roleHint?: string): ParsedUserMessage | undefined {
  if (!message) return undefined;
  const role = message.role || roleHint;
  if (role !== 'user') return undefined;

  const rawContent = message.content;

  // String content (simple user messages)
  if (typeof rawContent === 'string') {
    return { role: 'user', content: rawContent };
  }

  // Array content (tool results, images, etc.)
  if (Array.isArray(rawContent)) {
    const blocks: ContentBlock[] = [];
    for (const rawBlock of rawContent) {
      const block = parseContentBlock(rawBlock);
      if (block) blocks.push(block);
    }
    return { role: 'user', content: blocks };
  }

  return undefined;
}

/**
 * Parse assistant message content from raw message.
 * The role can be determined by the entry type, so we accept an optional roleHint.
 */
function parseAssistantMessage(message: Record<string, unknown>, roleHint?: string): ParsedAssistantMessage | undefined {
  if (!message) return undefined;
  const role = message.role || roleHint;
  if (role !== 'assistant') return undefined;

  const rawContent = message.content;
  const blocks: ContentBlock[] = [];

  if (Array.isArray(rawContent)) {
    for (const rawBlock of rawContent) {
      const block = parseContentBlock(rawBlock);
      if (block) blocks.push(block);
    }
  }

  // Parse usage with cache creation details
  let usage: TokenUsage | undefined;
  if (message.usage && typeof message.usage === 'object') {
    const rawUsage = message.usage as Record<string, unknown>;
    usage = {
      input_tokens: typeof rawUsage.input_tokens === 'number' ? rawUsage.input_tokens : undefined,
      output_tokens: typeof rawUsage.output_tokens === 'number' ? rawUsage.output_tokens : undefined,
      cache_read_input_tokens: typeof rawUsage.cache_read_input_tokens === 'number' ? rawUsage.cache_read_input_tokens : undefined,
      cache_creation_input_tokens: typeof rawUsage.cache_creation_input_tokens === 'number' ? rawUsage.cache_creation_input_tokens : undefined,
    };

    // Parse cache creation details
    if (rawUsage.cache_creation && typeof rawUsage.cache_creation === 'object') {
      const cc = rawUsage.cache_creation as Record<string, unknown>;
      const cacheCreation: CacheCreation = {};
      if (typeof cc.ephemeral_5m_input_tokens === 'number') cacheCreation.ephemeral_5m_input_tokens = cc.ephemeral_5m_input_tokens;
      if (typeof cc.ephemeral_1h_input_tokens === 'number') cacheCreation.ephemeral_1h_input_tokens = cc.ephemeral_1h_input_tokens;
      if (Object.keys(cacheCreation).length > 0) usage.cache_creation = cacheCreation;
    }

    // Parse server tool use tokens
    if (typeof rawUsage.server_tool_use === 'number') usage.server_tool_use = rawUsage.server_tool_use;

    // Parse service tier
    if (typeof rawUsage.service_tier === 'string') usage.service_tier = rawUsage.service_tier;
  }

  return {
    role: 'assistant',
    model: typeof message.model === 'string' ? message.model : undefined,
    content: blocks,
    stopReason: typeof message.stop_reason === 'string' ? message.stop_reason : undefined,
    usage,
  };
}

/**
 * Parse a raw JSONL object into a structured Entry
 */
function parseEntry(raw: Record<string, unknown>): Entry {
  const entryType = String(raw.type || 'user') as EntryType;

  const entry: Entry = {
    type: entryType,
    uuid: typeof raw.uuid === 'string' ? raw.uuid : undefined,
    parentUuid: typeof raw.parentUuid === 'string' ? raw.parentUuid : undefined,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
    version: typeof raw.version === 'string' ? raw.version : undefined,
    cwd: typeof raw.cwd === 'string' ? raw.cwd : undefined,
    gitBranch: typeof raw.gitBranch === 'string' ? raw.gitBranch : undefined,
  };

  // Parse message field
  if (raw.message && typeof raw.message === 'object') {
    const message = raw.message as Record<string, unknown>;
    entry.rawMessage = message;

    if (entryType === 'user') {
      entry.parsedUserMessage = parseUserMessage(message, 'user');
    } else if (entryType === 'assistant') {
      entry.parsedAssistantMessage = parseAssistantMessage(message, 'assistant');
    }
  }

  // Agent/sidechain fields
  if (typeof raw.isSidechain === 'boolean') entry.isSidechain = raw.isSidechain;
  if (typeof raw.agentId === 'string') entry.agentId = raw.agentId;

  // Error fields
  if (typeof raw.error === 'string') entry.error = raw.error;
  if (typeof raw.isApiErrorMessage === 'boolean') entry.isApiErrorMessage = raw.isApiErrorMessage;

  // API response metadata
  if (typeof raw.stopReason === 'string') entry.stopReason = raw.stopReason;
  if (typeof raw.requestId === 'string') entry.requestId = raw.requestId;

  // Thinking metadata
  if (raw.thinkingMetadata && typeof raw.thinkingMetadata === 'object') {
    const tm = raw.thinkingMetadata as Record<string, unknown>;
    const thinkingMetadata: ThinkingMetadata = {};
    if (typeof tm.level === 'string') thinkingMetadata.level = tm.level;
    if (typeof tm.disabled === 'boolean') thinkingMetadata.disabled = tm.disabled;
    if (Array.isArray(tm.triggers)) thinkingMetadata.triggers = tm.triggers.filter((t): t is string => typeof t === 'string');
    if (Object.keys(thinkingMetadata).length > 0) entry.thinkingMetadata = thinkingMetadata;
  }

  // Permission mode
  if (typeof raw.permissionMode === 'string') entry.permissionMode = raw.permissionMode;

  // Summary entries
  if (entryType === 'summary') {
    if (typeof raw.summary === 'string') entry.summary = raw.summary;
    // Also check message.summary
    if (!entry.summary && raw.message && typeof raw.message === 'object') {
      const msg = raw.message as Record<string, unknown>;
      if (typeof msg.summary === 'string') entry.summary = msg.summary;
    }
  }

  // Progress entries
  if (entryType === 'progress') {
    if (typeof raw.status === 'string') entry.progressStatus = raw.status;
  }

  return entry;
}

/**
 * Convert an Entry to a Turn (only for user/assistant entries)
 */
function entryToTurn(entry: Entry): Turn | null {
  if (entry.type !== 'user' && entry.type !== 'assistant') {
    return null;
  }

  const content: ContentBlock[] = [];

  if (entry.type === 'user' && entry.parsedUserMessage) {
    const msg = entry.parsedUserMessage;
    if (typeof msg.content === 'string') {
      content.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      content.push(...msg.content);
    }
  } else if (entry.type === 'assistant' && entry.parsedAssistantMessage) {
    content.push(...entry.parsedAssistantMessage.content);
  } else if (entry.rawMessage) {
    // Fallback: try to parse content from raw message
    const rawContent = entry.rawMessage.content;
    if (typeof rawContent === 'string') {
      content.push({ type: 'text', text: rawContent });
    } else if (Array.isArray(rawContent)) {
      for (const rawBlock of rawContent) {
        const block = parseContentBlock(rawBlock);
        if (block) content.push(block);
      }
    }
  }

  // If no message at all, skip
  if (!entry.parsedUserMessage && !entry.parsedAssistantMessage && !entry.rawMessage) {
    return null;
  }

  const turn: Turn = {
    id: entry.uuid || '',
    role: entry.type === 'user' ? 'user' : 'assistant',
    content,
    timestamp: entry.timestamp,
    parentId: entry.parentUuid,
    entryType: entry.type,
  };

  // Assistant-specific fields
  if (entry.type === 'assistant' && entry.parsedAssistantMessage) {
    turn.model = entry.parsedAssistantMessage.model;
    turn.usage = entry.parsedAssistantMessage.usage;
    turn.stopReason = entry.parsedAssistantMessage.stopReason ?? entry.stopReason;
  }

  // Stop reason from entry level (fallback)
  if (!turn.stopReason && entry.stopReason) {
    turn.stopReason = entry.stopReason;
  }

  // Propagate enriched fields
  if (entry.isSidechain !== undefined) turn.isSidechain = entry.isSidechain;
  if (entry.agentId) turn.agentId = entry.agentId;
  if (entry.error) turn.error = entry.error;
  if (entry.isApiErrorMessage !== undefined) turn.isApiErrorMessage = entry.isApiErrorMessage;
  if (entry.requestId) turn.requestId = entry.requestId;
  if (entry.thinkingMetadata) turn.thinkingMetadata = entry.thinkingMetadata;
  if (entry.permissionMode) turn.permissionMode = entry.permissionMode;

  return turn;
}

/**
 * Extract enriched metadata from all entries
 */
function extractMeta(entries: Entry[]): Partial<ConversationMeta> {
  const meta: Partial<ConversationMeta> = {};

  const summaries: string[] = [];
  let systemMessageCount = 0;
  let hasErrors = false;
  const agentIdSet = new Set<string>();

  for (const entry of entries) {
    // Collect summaries
    if (entry.type === 'summary' && entry.summary) {
      summaries.push(entry.summary);
    }

    // Count system messages
    if (entry.type === 'system') {
      systemMessageCount++;
    }

    // Detect errors
    if (entry.error || entry.isApiErrorMessage) {
      hasErrors = true;
    }

    // Collect agent IDs
    if (entry.agentId) {
      agentIdSet.add(entry.agentId);
    }
  }

  if (summaries.length > 0) meta.summaries = summaries;
  if (systemMessageCount > 0) meta.systemMessageCount = systemMessageCount;
  if (hasErrors) meta.hasErrors = true;
  if (agentIdSet.size > 0) meta.agentIds = Array.from(agentIdSet);

  return meta;
}

/**
 * Compute total usage from turns
 */
function computeTotalUsage(turns: Turn[]): TokenUsage {
  let totalUsage: TokenUsage = {};

  for (const turn of turns) {
    if (turn.usage) {
      totalUsage = {
        input_tokens: (totalUsage.input_tokens || 0) + (turn.usage.input_tokens || 0),
        output_tokens: (totalUsage.output_tokens || 0) + (turn.usage.output_tokens || 0),
        cache_read_input_tokens: (totalUsage.cache_read_input_tokens || 0) + (turn.usage.cache_read_input_tokens || 0),
        cache_creation_input_tokens: (totalUsage.cache_creation_input_tokens || 0) + (turn.usage.cache_creation_input_tokens || 0),
      };
    }
  }

  return totalUsage;
}

/**
 * Parse JSONL string into array of raw objects
 */
function parseJsonl(text: string): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      lines.push(JSON.parse(trimmed));
    } catch {
      // Skip invalid JSON lines
      console.warn('Skipping invalid JSON line');
    }
  }

  return lines;
}

/**
 * Check if text is JSONL format (Claude Code)
 */
function isJsonl(text: string): boolean {
  const firstLine = text.trim().split('\n')[0];
  if (!firstLine) return false;

  try {
    const parsed = JSON.parse(firstLine);
    // Claude Code JSONL has type field
    return typeof parsed === 'object' && parsed !== null && 'type' in parsed;
  } catch {
    return false;
  }
}

/**
 * Claude Code conversation parser
 */
export const claudeCodeParser: TraceParser = {
  canParse(data: unknown): boolean {
    // Handle string input (JSONL)
    if (typeof data === 'string') {
      return isJsonl(data);
    }

    // Handle object input (legacy format)
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check for legacy Claude Code conversation structure
    return (
      Array.isArray(obj.messages) &&
      obj.messages.length > 0 &&
      typeof obj.messages[0] === 'object' &&
      obj.messages[0] !== null &&
      'uuid' in obj.messages[0] &&
      'message' in obj.messages[0]
    );
  },

  parse(data: unknown): Conversation {
    // Handle JSONL string input
    if (typeof data === 'string') {
      const rawLines = parseJsonl(data);

      // Parse all lines into entries
      const entries = rawLines.map(parseEntry);

      // Convert user/assistant entries to turns
      const turns: Turn[] = [];
      for (const entry of entries) {
        const turn = entryToTurn(entry);
        if (turn) turns.push(turn);
      }

      // Extract session info from first message-bearing entry
      const messageEntries = entries.filter(e => e.type === 'user' || e.type === 'assistant');
      const firstMsg = messageEntries[0];
      const lastMsg = messageEntries[messageEntries.length - 1];

      const sessionId = firstMsg?.sessionId;
      const firstTimestamp = firstMsg?.timestamp;
      const lastTimestamp = lastMsg?.timestamp;

      // Calculate duration
      let durationMs: number | undefined;
      if (firstTimestamp && lastTimestamp) {
        const start = new Date(firstTimestamp).getTime();
        const end = new Date(lastTimestamp).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          durationMs = end - start;
        }
      }

      // Find model from assistant messages
      const modelEntry = messageEntries.find(e => e.type === 'assistant' && e.parsedAssistantMessage?.model);
      const model = modelEntry?.parsedAssistantMessage?.model;

      // Calculate total usage
      const totalUsage = computeTotalUsage(turns);

      // Extract enriched metadata from all entries
      const enrichedMeta = extractMeta(entries);

      const meta: ConversationMeta = {
        id: sessionId,
        title: sessionId ? `Session ${sessionId.slice(0, 8)}...` : 'Claude Code Session',
        created_at: firstTimestamp,
        updated_at: lastTimestamp,
        model,
        source: 'claude-code',
        source_version: firstMsg?.version,
        cwd: firstMsg?.cwd,
        git_branch: firstMsg?.gitBranch,
        duration_ms: durationMs,
        total_usage: totalUsage,
        ...enrichedMeta,
      };

      return { meta, turns, entries };
    }

    // Handle legacy object format
    const raw = data as { uuid?: string; name?: string; created?: number; updated?: number; model?: string; messages: LegacyClaudeCodeLine[] };

    const meta: ConversationMeta = {
      id: raw.uuid,
      title: raw.name,
      created_at: raw.created ? new Date(raw.created).toISOString() : undefined,
      updated_at: raw.updated ? new Date(raw.updated).toISOString() : undefined,
      model: raw.model,
      source: 'claude-code',
    };

    // For legacy format, convert through the entry pipeline too
    const entries: Entry[] = raw.messages.map(line => parseEntry(line as unknown as Record<string, unknown>));
    const turns: Turn[] = [];
    for (const entry of entries) {
      const turn = entryToTurn(entry);
      if (turn) turns.push(turn);
    }

    // Calculate total usage
    meta.total_usage = computeTotalUsage(turns);

    // Extract enriched metadata
    const enrichedMeta = extractMeta(entries);
    Object.assign(meta, enrichedMeta);

    return { meta, turns, entries };
  },
};

// Export helper functions for testing
export { parseEntry, parseContentBlock, entryToTurn, extractMeta, computeTotalUsage, parseJsonl, parseUserMessage, parseAssistantMessage };
export type { Entry, EntryType };

export default claudeCodeParser;

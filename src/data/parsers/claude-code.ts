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
} from '../types';

/** Raw Claude Code JSONL line format */
interface ClaudeCodeLine {
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
 * Parse a Claude Code JSONL line into a Turn
 */
function parseLine(line: ClaudeCodeLine): Turn | null {
  // Skip non-message lines
  if (line.type !== 'user' && line.type !== 'assistant') {
    return null;
  }

  if (!line.message) {
    return null;
  }

  const content: ContentBlock[] = [];

  // Handle string content (user messages)
  if (typeof line.message.content === 'string') {
    content.push({ type: 'text', text: line.message.content });
  } else if (Array.isArray(line.message.content)) {
    for (const rawBlock of line.message.content) {
      const block = parseContentBlock(rawBlock);
      if (block) {
        content.push(block);
      }
    }
  }

  const usage: TokenUsage | undefined = line.message.usage
    ? {
        input_tokens: line.message.usage.input_tokens,
        output_tokens: line.message.usage.output_tokens,
        cache_read_input_tokens: line.message.usage.cache_read_input_tokens,
        cache_creation_input_tokens: line.message.usage.cache_creation_input_tokens,
      }
    : undefined;

  return {
    id: line.uuid || '',
    role: line.type === 'user' ? 'user' : 'assistant',
    content,
    timestamp: line.timestamp,
    model: line.message.model,
    usage,
    parentId: line.parentUuid ?? undefined,
  };
}

/**
 * Parse JSONL string into array of objects
 */
function parseJsonl(text: string): ClaudeCodeLine[] {
  const lines: ClaudeCodeLine[] = [];

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
      const lines = parseJsonl(data);

      // Extract session info from first message line
      const messageLines = lines.filter(l => l.type === 'user' || l.type === 'assistant');
      const firstMsg = messageLines[0];
      const lastMsg = messageLines[messageLines.length - 1];

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
      const modelLine = messageLines.find(l => l.type === 'assistant' && l.message?.model);
      const model = modelLine?.message?.model;

      // Parse all message lines into turns
      const turns: Turn[] = [];
      for (const line of lines) {
        const turn = parseLine(line);
        if (turn) {
          turns.push(turn);
        }
      }

      // Calculate total usage with cache tokens
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

      const meta: ConversationMeta = {
        id: sessionId,
        title: sessionId ? `Session ${sessionId.slice(0, 8)}...` : 'Claude Code Session',
        created_at: firstTimestamp,
        updated_at: lastTimestamp,
        model: model,
        source: 'claude-code',
        source_version: firstMsg?.version,
        cwd: firstMsg?.cwd,
        git_branch: firstMsg?.gitBranch,
        duration_ms: durationMs,
        total_usage: totalUsage,
      };

      return { meta, turns };
    }

    // Handle legacy object format
    const raw = data as { uuid?: string; name?: string; created?: number; updated?: number; model?: string; messages: ClaudeCodeLine[] };

    const meta: ConversationMeta = {
      id: raw.uuid,
      title: raw.name,
      created_at: raw.created ? new Date(raw.created).toISOString() : undefined,
      updated_at: raw.updated ? new Date(raw.updated).toISOString() : undefined,
      model: raw.model,
      source: 'claude-code',
    };

    const turns: Turn[] = [];
    for (const line of raw.messages) {
      const turn = parseLine(line);
      if (turn) {
        turns.push(turn);
      }
    }

    // Calculate total usage
    let totalUsage: TokenUsage = {};
    for (const turn of turns) {
      if (turn.usage) {
        totalUsage = {
          input_tokens: (totalUsage.input_tokens || 0) + (turn.usage.input_tokens || 0),
          output_tokens: (totalUsage.output_tokens || 0) + (turn.usage.output_tokens || 0),
        };
      }
    }
    meta.total_usage = totalUsage;

    return { meta, turns };
  },
};

export default claudeCodeParser;

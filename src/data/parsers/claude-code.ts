/**
 * Parser for Claude Code conversation files
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

/** Raw Claude Code message format */
interface ClaudeCodeMessage {
  uuid: string;
  type: 'human' | 'assistant' | 'system';
  message: {
    id?: string;
    type?: string;
    role?: string;
    content: unknown[];
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  timestamp?: string;
  parentMessageUUID?: string;
}

/** Raw Claude Code conversation format */
interface ClaudeCodeConversation {
  uuid?: string;
  name?: string;
  created?: number;
  updated?: number;
  model?: string;
  messages: ClaudeCodeMessage[];
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
 * Parse a Claude Code message into a Turn
 */
function parseMessage(msg: ClaudeCodeMessage): Turn {
  const roleMap: Record<string, Turn['role']> = {
    human: 'user',
    assistant: 'assistant',
    system: 'system',
  };

  const content: ContentBlock[] = [];

  if (Array.isArray(msg.message.content)) {
    for (const rawBlock of msg.message.content) {
      const block = parseContentBlock(rawBlock);
      if (block) {
        content.push(block);
      }
    }
  }

  const usage: TokenUsage | undefined = msg.message.usage
    ? {
        input_tokens: msg.message.usage.input_tokens,
        output_tokens: msg.message.usage.output_tokens,
        cache_read_input_tokens: msg.message.usage.cache_read_input_tokens,
        cache_creation_input_tokens: msg.message.usage.cache_creation_input_tokens,
      }
    : undefined;

  return {
    id: msg.uuid,
    role: roleMap[msg.type] || 'user',
    content,
    timestamp: msg.timestamp,
    model: msg.message.model,
    usage,
    parentId: msg.parentMessageUUID,
  };
}

/**
 * Claude Code conversation parser
 */
export const claudeCodeParser: TraceParser = {
  canParse(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check for Claude Code conversation structure
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
    const raw = data as ClaudeCodeConversation;

    const meta: ConversationMeta = {
      id: raw.uuid,
      title: raw.name,
      created_at: raw.created ? new Date(raw.created).toISOString() : undefined,
      updated_at: raw.updated ? new Date(raw.updated).toISOString() : undefined,
      model: raw.model,
      source: 'claude-code',
    };

    const turns = raw.messages.map(parseMessage);

    // Calculate total usage
    let totalUsage: TokenUsage = {};
    for (const turn of turns) {
      if (turn.usage) {
        totalUsage = {
          input_tokens: (totalUsage.input_tokens || 0) + (turn.usage.input_tokens || 0),
          output_tokens: (totalUsage.output_tokens || 0) + (turn.usage.output_tokens || 0),
          thinking_tokens: (totalUsage.thinking_tokens || 0) + (turn.usage.thinking_tokens || 0),
        };
      }
    }
    meta.total_usage = totalUsage;

    return { meta, turns };
  },
};

export default claudeCodeParser;

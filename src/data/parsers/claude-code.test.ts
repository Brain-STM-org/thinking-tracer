/**
 * Tests for Claude Code parser
 */

import { describe, it, expect } from 'vitest';
import {
  claudeCodeParser,
  parseEntry,
  parseContentBlock,
  entryToTurn,
  extractMeta,
  computeTotalUsage,
  parseUserMessage,
  parseAssistantMessage,
} from './claude-code';
import type { Entry } from '../../data/types';

describe('claudeCodeParser', () => {
  describe('canParse - JSONL format', () => {
    it('returns true for valid JSONL with type field', () => {
      const jsonl = '{"type":"user","uuid":"123","message":{"content":"Hello"}}\n';
      expect(claudeCodeParser.canParse(jsonl)).toBe(true);
    });

    it('returns false for plain JSON object string', () => {
      const json = '{"name": "test"}';
      expect(claudeCodeParser.canParse(json)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(claudeCodeParser.canParse('')).toBe(false);
    });
  });

  describe('canParse - legacy object format', () => {
    it('returns true for valid legacy format', () => {
      const data = {
        uuid: 'test-uuid',
        messages: [
          {
            uuid: 'msg-1',
            type: 'user',
            message: {
              content: [{ type: 'text', text: 'Hello' }],
            },
          },
        ],
      };

      expect(claudeCodeParser.canParse(data)).toBe(true);
    });

    it('returns false for non-object input', () => {
      expect(claudeCodeParser.canParse(null)).toBe(false);
      expect(claudeCodeParser.canParse(123)).toBe(false);
    });
  });

  describe('parse - JSONL format', () => {
    it('parses a simple JSONL conversation', () => {
      const jsonl = [
        '{"type":"user","uuid":"msg-1","sessionId":"sess-123","timestamp":"2026-01-22T10:00:00Z","message":{"role":"user","content":"Hello Claude"}}',
        '{"type":"assistant","uuid":"msg-2","sessionId":"sess-123","timestamp":"2026-01-22T10:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello! How can I help?"}],"usage":{"input_tokens":10,"output_tokens":8}}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.meta.id).toBe('sess-123');
      expect(result.meta.source).toBe('claude-code');
      expect(result.turns).toHaveLength(2);

      expect(result.turns[0].role).toBe('user');
      expect(result.turns[0].content[0]).toEqual({
        type: 'text',
        text: 'Hello Claude',
      });

      expect(result.turns[1].role).toBe('assistant');
      expect(result.turns[1].usage?.input_tokens).toBe(10);
      expect(result.turns[1].usage?.output_tokens).toBe(8);
    });

    it('skips file-history-snapshot lines', () => {
      const jsonl = [
        '{"type":"file-history-snapshot","messageId":"123"}',
        '{"type":"user","uuid":"msg-1","message":{"content":"Hello"}}',
        '{"type":"file-history-snapshot","messageId":"456"}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);
      expect(result.turns).toHaveLength(1);
      expect(result.turns[0].role).toBe('user');
    });

    it('parses thinking blocks', () => {
      const jsonl = [
        '{"type":"assistant","uuid":"msg-1","message":{"content":[{"type":"thinking","thinking":"Let me think..."},{"type":"text","text":"Here is my answer."}]}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);
      const content = result.turns[0].content;

      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({
        type: 'thinking',
        thinking: 'Let me think...',
        redacted: false,
      });
      expect(content[1]).toEqual({
        type: 'text',
        text: 'Here is my answer.',
      });
    });

    it('parses tool use and results', () => {
      const jsonl = [
        '{"type":"assistant","uuid":"msg-1","message":{"content":[{"type":"tool_use","id":"tool-1","name":"read_file","input":{"path":"/test.txt"}}]}}',
        '{"type":"user","uuid":"msg-2","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","content":"File contents here"}]}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      const toolUse = result.turns[0].content[0];
      expect(toolUse.type).toBe('tool_use');
      if (toolUse.type === 'tool_use') {
        expect(toolUse.name).toBe('read_file');
        expect(toolUse.input).toEqual({ path: '/test.txt' });
      }

      const toolResult = result.turns[1].content[0];
      expect(toolResult.type).toBe('tool_result');
      if (toolResult.type === 'tool_result') {
        expect(toolResult.tool_use_id).toBe('tool-1');
        expect(toolResult.content).toBe('File contents here');
      }
    });

    it('calculates total token usage', () => {
      const jsonl = [
        '{"type":"assistant","uuid":"msg-1","message":{"content":[],"usage":{"input_tokens":100,"output_tokens":50}}}',
        '{"type":"assistant","uuid":"msg-2","message":{"content":[],"usage":{"input_tokens":150,"output_tokens":75}}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.meta.total_usage?.input_tokens).toBe(250);
      expect(result.meta.total_usage?.output_tokens).toBe(125);
    });

    it('handles string content in user messages', () => {
      const jsonl = '{"type":"user","uuid":"msg-1","message":{"content":"Simple string content"}}';

      const result = claudeCodeParser.parse(jsonl);

      expect(result.turns[0].content[0]).toEqual({
        type: 'text',
        text: 'Simple string content',
      });
    });

    it('skips invalid JSON lines gracefully', () => {
      const jsonl = [
        '{"type":"user","uuid":"msg-1","message":{"content":"Valid"}}',
        'invalid json here',
        '{"type":"assistant","uuid":"msg-2","message":{"content":[{"type":"text","text":"Also valid"}]}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);
      expect(result.turns).toHaveLength(2);
    });

    it('populates entries[] with all 7 entry types, turns only from user/assistant', () => {
      const jsonl = [
        '{"type":"user","uuid":"u1","message":{"content":"Hello"}}',
        '{"type":"assistant","uuid":"a1","message":{"content":[{"type":"text","text":"Hi"}]}}',
        '{"type":"system","uuid":"s1"}',
        '{"type":"progress","uuid":"p1","status":"running"}',
        '{"type":"file-history-snapshot","uuid":"f1"}',
        '{"type":"summary","uuid":"sm1","summary":"This was a conversation"}',
        '{"type":"queue-operation","uuid":"q1"}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      // All 7 entry types in entries[]
      expect(result.entries).toHaveLength(7);
      expect(result.entries!.map(e => e.type)).toEqual([
        'user', 'assistant', 'system', 'progress',
        'file-history-snapshot', 'summary', 'queue-operation',
      ]);

      // Only user/assistant in turns[]
      expect(result.turns).toHaveLength(2);
      expect(result.turns[0].role).toBe('user');
      expect(result.turns[1].role).toBe('assistant');
    });

    it('parses assistant error and stopReason fields', () => {
      const jsonl = '{"type":"assistant","uuid":"a1","error":"rate_limit_exceeded","stopReason":"max_tokens","isApiErrorMessage":true,"message":{"content":[{"type":"text","text":"Error"}]}}';

      const result = claudeCodeParser.parse(jsonl);

      expect(result.turns[0].error).toBe('rate_limit_exceeded');
      expect(result.turns[0].stopReason).toBe('max_tokens');
      expect(result.turns[0].isApiErrorMessage).toBe(true);
    });

    it('parses user thinkingMetadata and permissionMode', () => {
      const jsonl = '{"type":"user","uuid":"u1","thinkingMetadata":{"level":"high","disabled":false,"triggers":["complex_task"]},"permissionMode":"auto","message":{"content":"Hello"}}';

      const result = claudeCodeParser.parse(jsonl);

      expect(result.turns[0].thinkingMetadata).toEqual({
        level: 'high',
        disabled: false,
        triggers: ['complex_task'],
      });
      expect(result.turns[0].permissionMode).toBe('auto');
    });

    it('parses isSidechain and agentId', () => {
      const jsonl = [
        '{"type":"user","uuid":"u1","isSidechain":true,"agentId":"agent-xyz","message":{"content":"Sub-task"}}',
        '{"type":"assistant","uuid":"a1","isSidechain":true,"agentId":"agent-xyz","message":{"content":[{"type":"text","text":"Done"}]}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.turns[0].isSidechain).toBe(true);
      expect(result.turns[0].agentId).toBe('agent-xyz');
      expect(result.turns[1].isSidechain).toBe(true);
      expect(result.turns[1].agentId).toBe('agent-xyz');
    });

    it('extracts summaries into meta.summaries', () => {
      const jsonl = [
        '{"type":"summary","uuid":"s1","summary":"First summary"}',
        '{"type":"user","uuid":"u1","message":{"content":"Hello"}}',
        '{"type":"summary","uuid":"s2","summary":"Second summary"}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.meta.summaries).toEqual(['First summary', 'Second summary']);
    });

    it('counts system entries into meta.systemMessageCount', () => {
      const jsonl = [
        '{"type":"system","uuid":"s1"}',
        '{"type":"user","uuid":"u1","message":{"content":"Hello"}}',
        '{"type":"system","uuid":"s2"}',
        '{"type":"system","uuid":"s3"}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.meta.systemMessageCount).toBe(3);
    });

    it('detects errors into meta.hasErrors', () => {
      const jsonl = [
        '{"type":"user","uuid":"u1","message":{"content":"Hello"}}',
        '{"type":"assistant","uuid":"a1","error":"something_broke","message":{"content":[{"type":"text","text":"Error"}]}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.meta.hasErrors).toBe(true);
    });

    it('collects unique agentIds into meta.agentIds', () => {
      const jsonl = [
        '{"type":"user","uuid":"u1","agentId":"agent-a","message":{"content":"Hello"}}',
        '{"type":"assistant","uuid":"a1","agentId":"agent-b","message":{"content":[{"type":"text","text":"Hi"}]}}',
        '{"type":"user","uuid":"u2","agentId":"agent-a","message":{"content":"Again"}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.meta.agentIds).toEqual(['agent-a', 'agent-b']);
    });

    it('propagates entryType on turns', () => {
      const jsonl = [
        '{"type":"user","uuid":"u1","message":{"content":"Hello"}}',
        '{"type":"assistant","uuid":"a1","message":{"content":[{"type":"text","text":"Hi"}]}}',
      ].join('\n');

      const result = claudeCodeParser.parse(jsonl);

      expect(result.turns[0].entryType).toBe('user');
      expect(result.turns[1].entryType).toBe('assistant');
    });
  });
});

describe('parseContentBlock', () => {
  it('parses text block', () => {
    const block = parseContentBlock({ type: 'text', text: 'Hello' });
    expect(block).toEqual({ type: 'text', text: 'Hello' });
  });

  it('parses thinking block with signature', () => {
    const block = parseContentBlock({
      type: 'thinking',
      thinking: 'Let me think...',
      signature: 'abc123',
    });
    expect(block).toEqual({
      type: 'thinking',
      thinking: 'Let me think...',
      redacted: false,
      signature: 'abc123',
    });
  });

  it('parses thinking block without signature', () => {
    const block = parseContentBlock({
      type: 'thinking',
      thinking: 'Thinking',
    });
    expect(block).toEqual({
      type: 'thinking',
      thinking: 'Thinking',
      redacted: false,
    });
    // No signature key should be present
    expect('signature' in block!).toBe(false);
  });

  it('parses tool_use block', () => {
    const block = parseContentBlock({
      type: 'tool_use',
      id: 'tool-1',
      name: 'read_file',
      input: { path: '/test' },
    });
    expect(block).toEqual({
      type: 'tool_use',
      id: 'tool-1',
      name: 'read_file',
      input: { path: '/test' },
    });
  });

  it('parses string as text block', () => {
    const block = parseContentBlock('Hello world');
    expect(block).toEqual({ type: 'text', text: 'Hello world' });
  });

  it('returns null for null input', () => {
    expect(parseContentBlock(null)).toBeNull();
  });
});

describe('parseEntry', () => {
  it('parses user entry with string content', () => {
    const entry = parseEntry({
      type: 'user',
      uuid: 'u1',
      sessionId: 'sess-1',
      timestamp: '2026-01-22T10:00:00Z',
      message: { role: 'user', content: 'Hello' },
    });

    expect(entry.type).toBe('user');
    expect(entry.uuid).toBe('u1');
    expect(entry.parsedUserMessage).toBeDefined();
    expect(entry.parsedUserMessage!.content).toBe('Hello');
  });

  it('parses assistant entry with usage', () => {
    const entry = parseEntry({
      type: 'assistant',
      uuid: 'a1',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi' }],
        model: 'claude-opus-4-5-20251101',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    });

    expect(entry.parsedAssistantMessage).toBeDefined();
    expect(entry.parsedAssistantMessage!.model).toBe('claude-opus-4-5-20251101');
    expect(entry.parsedAssistantMessage!.stopReason).toBe('end_turn');
    expect(entry.parsedAssistantMessage!.usage?.input_tokens).toBe(100);
  });

  it('parses summary entry', () => {
    const entry = parseEntry({
      type: 'summary',
      uuid: 's1',
      summary: 'This is a summary',
    });

    expect(entry.type).toBe('summary');
    expect(entry.summary).toBe('This is a summary');
  });

  it('parses progress entry', () => {
    const entry = parseEntry({
      type: 'progress',
      uuid: 'p1',
      status: 'running',
    });

    expect(entry.type).toBe('progress');
    expect(entry.progressStatus).toBe('running');
  });

  it('parses sidechain and agentId', () => {
    const entry = parseEntry({
      type: 'user',
      uuid: 'u1',
      isSidechain: true,
      agentId: 'agent-abc',
      message: { content: 'Sub task' },
    });

    expect(entry.isSidechain).toBe(true);
    expect(entry.agentId).toBe('agent-abc');
  });

  it('parses thinking metadata', () => {
    const entry = parseEntry({
      type: 'user',
      uuid: 'u1',
      thinkingMetadata: { level: 'high', disabled: false, triggers: ['complex'] },
      message: { content: 'Hello' },
    });

    expect(entry.thinkingMetadata).toEqual({
      level: 'high',
      disabled: false,
      triggers: ['complex'],
    });
  });

  it('parses cache creation details in usage', () => {
    const entry = parseEntry({
      type: 'assistant',
      uuid: 'a1',
      message: {
        role: 'assistant',
        content: [],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation: {
            ephemeral_5m_input_tokens: 25,
            ephemeral_1h_input_tokens: 10,
          },
          server_tool_use: 5,
          service_tier: 'standard',
        },
      },
    });

    const usage = entry.parsedAssistantMessage!.usage!;
    expect(usage.cache_creation).toEqual({
      ephemeral_5m_input_tokens: 25,
      ephemeral_1h_input_tokens: 10,
    });
    expect(usage.server_tool_use).toBe(5);
    expect(usage.service_tier).toBe('standard');
  });
});

describe('entryToTurn', () => {
  it('converts user entry to turn', () => {
    const entry: Entry = {
      type: 'user',
      uuid: 'u1',
      parsedUserMessage: { role: 'user', content: 'Hello' },
    };

    const turn = entryToTurn(entry);

    expect(turn).not.toBeNull();
    expect(turn!.role).toBe('user');
    expect(turn!.content[0]).toEqual({ type: 'text', text: 'Hello' });
  });

  it('converts assistant entry to turn with usage', () => {
    const entry: Entry = {
      type: 'assistant',
      uuid: 'a1',
      parsedAssistantMessage: {
        role: 'assistant',
        model: 'claude-opus-4-5-20251101',
        content: [{ type: 'text', text: 'Hi' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const turn = entryToTurn(entry);

    expect(turn!.model).toBe('claude-opus-4-5-20251101');
    expect(turn!.usage?.input_tokens).toBe(100);
    expect(turn!.stopReason).toBe('end_turn');
  });

  it('returns null for non-user/assistant entries', () => {
    expect(entryToTurn({ type: 'system' })).toBeNull();
    expect(entryToTurn({ type: 'progress' })).toBeNull();
    expect(entryToTurn({ type: 'summary' })).toBeNull();
    expect(entryToTurn({ type: 'file-history-snapshot' })).toBeNull();
    expect(entryToTurn({ type: 'queue-operation' })).toBeNull();
  });

  it('propagates enriched fields from entry to turn', () => {
    const entry: Entry = {
      type: 'assistant',
      uuid: 'a1',
      isSidechain: true,
      agentId: 'agent-xyz',
      error: 'rate_limit',
      isApiErrorMessage: true,
      requestId: 'req-123',
      permissionMode: 'auto',
      thinkingMetadata: { level: 'high' },
      parsedAssistantMessage: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Error' }],
      },
    };

    const turn = entryToTurn(entry);

    expect(turn!.isSidechain).toBe(true);
    expect(turn!.agentId).toBe('agent-xyz');
    expect(turn!.error).toBe('rate_limit');
    expect(turn!.isApiErrorMessage).toBe(true);
    expect(turn!.requestId).toBe('req-123');
    expect(turn!.permissionMode).toBe('auto');
    expect(turn!.thinkingMetadata).toEqual({ level: 'high' });
  });
});

describe('extractMeta', () => {
  it('extracts summaries from summary entries', () => {
    const entries: Entry[] = [
      { type: 'summary', summary: 'First summary' },
      { type: 'user' },
      { type: 'summary', summary: 'Second summary' },
    ];

    const meta = extractMeta(entries);

    expect(meta.summaries).toEqual(['First summary', 'Second summary']);
  });

  it('counts system entries', () => {
    const entries: Entry[] = [
      { type: 'system' },
      { type: 'user' },
      { type: 'system' },
    ];

    const meta = extractMeta(entries);

    expect(meta.systemMessageCount).toBe(2);
  });

  it('detects errors', () => {
    const entries: Entry[] = [
      { type: 'user' },
      { type: 'assistant', error: 'rate_limit' },
    ];

    const meta = extractMeta(entries);

    expect(meta.hasErrors).toBe(true);
  });

  it('detects API error messages', () => {
    const entries: Entry[] = [
      { type: 'assistant', isApiErrorMessage: true },
    ];

    const meta = extractMeta(entries);

    expect(meta.hasErrors).toBe(true);
  });

  it('collects unique agent IDs', () => {
    const entries: Entry[] = [
      { type: 'user', agentId: 'agent-a' },
      { type: 'assistant', agentId: 'agent-b' },
      { type: 'user', agentId: 'agent-a' },
    ];

    const meta = extractMeta(entries);

    expect(meta.agentIds).toEqual(['agent-a', 'agent-b']);
  });

  it('returns empty object for entries with no metadata', () => {
    const entries: Entry[] = [
      { type: 'user' },
      { type: 'assistant' },
    ];

    const meta = extractMeta(entries);

    expect(meta.summaries).toBeUndefined();
    expect(meta.systemMessageCount).toBeUndefined();
    expect(meta.hasErrors).toBeUndefined();
    expect(meta.agentIds).toBeUndefined();
  });
});

describe('computeTotalUsage', () => {
  it('sums usage across turns', () => {
    const turns = [
      { id: 't1', role: 'assistant' as const, content: [], usage: { input_tokens: 100, output_tokens: 50 } },
      { id: 't2', role: 'assistant' as const, content: [], usage: { input_tokens: 200, output_tokens: 100 } },
    ];

    const total = computeTotalUsage(turns);

    expect(total.input_tokens).toBe(300);
    expect(total.output_tokens).toBe(150);
  });

  it('handles turns without usage', () => {
    const turns = [
      { id: 't1', role: 'user' as const, content: [] },
      { id: 't2', role: 'assistant' as const, content: [], usage: { input_tokens: 100 } },
    ];

    const total = computeTotalUsage(turns);

    expect(total.input_tokens).toBe(100);
  });

  it('includes cache tokens', () => {
    const turns = [
      {
        id: 't1',
        role: 'assistant' as const,
        content: [],
        usage: { cache_read_input_tokens: 50, cache_creation_input_tokens: 30 },
      },
    ];

    const total = computeTotalUsage(turns);

    expect(total.cache_read_input_tokens).toBe(50);
    expect(total.cache_creation_input_tokens).toBe(30);
  });
});

describe('parseUserMessage', () => {
  it('parses string content', () => {
    const msg = parseUserMessage({ role: 'user', content: 'Hello' }, 'user');
    expect(msg).toBeDefined();
    expect(msg!.content).toBe('Hello');
  });

  it('parses array content', () => {
    const msg = parseUserMessage({ role: 'user', content: [{ type: 'text', text: 'Hello' }] }, 'user');
    expect(msg).toBeDefined();
    expect(Array.isArray(msg!.content)).toBe(true);
  });

  it('returns undefined for non-user role', () => {
    expect(parseUserMessage({ role: 'assistant', content: 'Hello' })).toBeUndefined();
  });

  it('uses roleHint when message has no role', () => {
    const msg = parseUserMessage({ content: 'Hello' }, 'user');
    expect(msg).toBeDefined();
    expect(msg!.content).toBe('Hello');
  });
});

describe('parseAssistantMessage', () => {
  it('parses content and usage', () => {
    const msg = parseAssistantMessage({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi' }],
      model: 'claude-opus-4-5-20251101',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    }, 'assistant');

    expect(msg).toBeDefined();
    expect(msg!.model).toBe('claude-opus-4-5-20251101');
    expect(msg!.stopReason).toBe('end_turn');
    expect(msg!.usage?.input_tokens).toBe(10);
    expect(msg!.content).toHaveLength(1);
  });

  it('uses roleHint when message has no role', () => {
    const msg = parseAssistantMessage({
      content: [{ type: 'text', text: 'Hi' }],
      usage: { input_tokens: 10 },
    }, 'assistant');

    expect(msg).toBeDefined();
    expect(msg!.usage?.input_tokens).toBe(10);
  });

  it('returns undefined for non-assistant role', () => {
    expect(parseAssistantMessage({ role: 'user', content: [] })).toBeUndefined();
  });
});

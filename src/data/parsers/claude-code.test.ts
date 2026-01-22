/**
 * Tests for Claude Code parser
 */

import { describe, it, expect } from 'vitest';
import { claudeCodeParser } from './claude-code';

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
  });
});

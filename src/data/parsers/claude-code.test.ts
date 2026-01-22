/**
 * Tests for Claude Code parser
 */

import { describe, it, expect } from 'vitest';
import { claudeCodeParser } from './claude-code';

describe('claudeCodeParser', () => {
  describe('canParse', () => {
    it('returns true for valid Claude Code format', () => {
      const data = {
        uuid: 'test-uuid',
        messages: [
          {
            uuid: 'msg-1',
            type: 'human',
            message: {
              content: [{ type: 'text', text: 'Hello' }],
            },
          },
        ],
      };

      expect(claudeCodeParser.canParse(data)).toBe(true);
    });

    it('returns false for empty messages array', () => {
      const data = {
        uuid: 'test-uuid',
        messages: [],
      };

      expect(claudeCodeParser.canParse(data)).toBe(false);
    });

    it('returns false for non-object input', () => {
      expect(claudeCodeParser.canParse(null)).toBe(false);
      expect(claudeCodeParser.canParse('string')).toBe(false);
      expect(claudeCodeParser.canParse(123)).toBe(false);
    });

    it('returns false for missing messages property', () => {
      const data = { uuid: 'test-uuid' };
      expect(claudeCodeParser.canParse(data)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses a simple conversation', () => {
      const data = {
        uuid: 'conv-123',
        name: 'Test Conversation',
        created: 1705945200000,
        model: 'claude-3-opus',
        messages: [
          {
            uuid: 'msg-1',
            type: 'human',
            message: {
              content: [{ type: 'text', text: 'Hello Claude' }],
            },
          },
          {
            uuid: 'msg-2',
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Hello! How can I help?' }],
              model: 'claude-3-opus',
              usage: {
                input_tokens: 10,
                output_tokens: 8,
              },
            },
          },
        ],
      };

      const result = claudeCodeParser.parse(data);

      expect(result.meta.id).toBe('conv-123');
      expect(result.meta.title).toBe('Test Conversation');
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

    it('parses thinking blocks', () => {
      const data = {
        messages: [
          {
            uuid: 'msg-1',
            type: 'assistant',
            message: {
              content: [
                { type: 'thinking', thinking: 'Let me think about this...' },
                { type: 'text', text: 'Here is my answer.' },
              ],
            },
          },
        ],
      };

      const result = claudeCodeParser.parse(data);
      const content = result.turns[0].content;

      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({
        type: 'thinking',
        thinking: 'Let me think about this...',
        redacted: false,
      });
      expect(content[1]).toEqual({
        type: 'text',
        text: 'Here is my answer.',
      });
    });

    it('parses tool use and results', () => {
      const data = {
        messages: [
          {
            uuid: 'msg-1',
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  id: 'tool-1',
                  name: 'read_file',
                  input: { path: '/test.txt' },
                },
              ],
            },
          },
          {
            uuid: 'msg-2',
            type: 'human',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'tool-1',
                  content: 'File contents here',
                },
              ],
            },
          },
        ],
      };

      const result = claudeCodeParser.parse(data);

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
      const data = {
        messages: [
          {
            uuid: 'msg-1',
            type: 'assistant',
            message: {
              content: [],
              usage: { input_tokens: 100, output_tokens: 50 },
            },
          },
          {
            uuid: 'msg-2',
            type: 'assistant',
            message: {
              content: [],
              usage: { input_tokens: 150, output_tokens: 75 },
            },
          },
        ],
      };

      const result = claudeCodeParser.parse(data);

      expect(result.meta.total_usage?.input_tokens).toBe(250);
      expect(result.meta.total_usage?.output_tokens).toBe(125);
    });

    it('handles string content as text block', () => {
      const data = {
        messages: [
          {
            uuid: 'msg-1',
            type: 'human',
            message: {
              content: ['Simple string content'],
            },
          },
        ],
      };

      const result = claudeCodeParser.parse(data);

      expect(result.turns[0].content[0]).toEqual({
        type: 'text',
        text: 'Simple string content',
      });
    });
  });
});

/**
 * Tests for Parser Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parserRegistry, claudeCodeParser } from './index';
import type { TraceParser, Conversation } from '../types';

describe('ParserRegistry', () => {
  describe('built-in parsers', () => {
    it('has claude-code parser registered by default', () => {
      const sources = parserRegistry.getRegisteredSources();
      expect(sources).toContain('claude-code');
    });

    it('can retrieve the claude-code parser', () => {
      const parser = parserRegistry.getParser('claude-code');
      expect(parser).toBe(claudeCodeParser);
    });
  });

  describe('canParse', () => {
    it('returns true for valid JSONL content', () => {
      const content = '{"type":"user","uuid":"123","message":{"role":"user","content":"hello"}}';
      expect(parserRegistry.canParse(content)).toBe(true);
    });

    it('returns false for invalid content', () => {
      expect(parserRegistry.canParse('random garbage')).toBe(false);
      expect(parserRegistry.canParse('')).toBe(false);
      expect(parserRegistry.canParse(null)).toBe(false);
    });
  });

  describe('detectAndParse', () => {
    it('parses valid Claude Code JSONL and returns sourceId', () => {
      const content = [
        '{"type":"user","uuid":"1","message":{"role":"user","content":"hello"}}',
        '{"type":"assistant","uuid":"2","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}',
      ].join('\n');

      const result = parserRegistry.detectAndParse(content);
      expect(result.sourceId).toBe('claude-code');
      expect(result.conversation).toBeDefined();
      expect(result.conversation.turns).toHaveLength(2);
      expect(result.confidence).toBe(1.0);
    });

    it('throws for unparseable content', () => {
      expect(() => parserRegistry.detectAndParse('not valid')).toThrow(
        'No registered parser can handle this file format'
      );
    });
  });

  describe('parseWithSource', () => {
    it('parses content with specified source', () => {
      const content = '{"type":"user","uuid":"1","message":{"role":"user","content":"hello"}}';
      const conversation = parserRegistry.parseWithSource(content, 'claude-code');
      expect(conversation.turns).toHaveLength(1);
    });

    it('throws for unknown source', () => {
      expect(() => parserRegistry.parseWithSource('{}', 'unknown-source')).toThrow(
        'Unknown source: unknown-source'
      );
    });
  });

  describe('register and unregister', () => {
    it('can register a custom parser', () => {
      const mockParser: TraceParser = {
        canParse: (data) => typeof data === 'string' && data.startsWith('MOCK:'),
        parse: (data) => ({
          meta: { source: 'mock-source' },
          turns: [],
        }),
      };

      parserRegistry.register('mock-source', mockParser, 50);

      expect(parserRegistry.getRegisteredSources()).toContain('mock-source');
      expect(parserRegistry.canParse('MOCK:test')).toBe(true);

      // Clean up
      parserRegistry.unregister('mock-source');
      expect(parserRegistry.getRegisteredSources()).not.toContain('mock-source');
    });

    it('respects parser priority order', () => {
      // Create two parsers that both accept "DUAL:" prefix
      const lowPriorityParser: TraceParser = {
        canParse: (data) => typeof data === 'string' && data.startsWith('DUAL:'),
        parse: () => ({
          meta: { source: 'low-priority' },
          turns: [],
        }),
      };

      const highPriorityParser: TraceParser = {
        canParse: (data) => typeof data === 'string' && data.startsWith('DUAL:'),
        parse: () => ({
          meta: { source: 'high-priority' },
          turns: [],
        }),
      };

      // Register low first, then high
      parserRegistry.register('low-priority', lowPriorityParser, 10);
      parserRegistry.register('high-priority', highPriorityParser, 20);

      const result = parserRegistry.detectAndParse('DUAL:test');
      expect(result.sourceId).toBe('high-priority');

      // Clean up
      parserRegistry.unregister('low-priority');
      parserRegistry.unregister('high-priority');
    });

    it('replaces parser when registering with same sourceId', () => {
      const parser1: TraceParser = {
        canParse: () => false,
        parse: () => ({ meta: {}, turns: [] }),
      };
      const parser2: TraceParser = {
        canParse: () => false,
        parse: () => ({ meta: {}, turns: [] }),
      };

      parserRegistry.register('test-replace', parser1);
      parserRegistry.register('test-replace', parser2);

      const sources = parserRegistry.getRegisteredSources().filter(s => s === 'test-replace');
      expect(sources).toHaveLength(1);

      expect(parserRegistry.getParser('test-replace')).toBe(parser2);

      // Clean up
      parserRegistry.unregister('test-replace');
    });
  });
});

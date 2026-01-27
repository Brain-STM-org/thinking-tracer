/**
 * Tests for Cluster Strategies
 */

import { describe, it, expect } from 'vitest';
import { strategyRegistry, claudeCodeStrategy } from './index';
import type { Turn, Entry } from '../../../data/types';

describe('StrategyRegistry', () => {
  describe('built-in strategies', () => {
    it('has claude-code strategy registered by default', () => {
      const ids = strategyRegistry.getIds();
      expect(ids).toContain('claude-code');
    });

    it('returns claude-code strategy for claude-code source', () => {
      const strategy = strategyRegistry.get('claude-code');
      expect(strategy.id).toBe('claude-code');
    });

    it('returns default strategy for unknown source', () => {
      const strategy = strategyRegistry.get('unknown-source');
      expect(strategy.id).toBe('claude-code'); // Default is Claude Code
    });

    it('returns default strategy for undefined source', () => {
      const strategy = strategyRegistry.get(undefined);
      expect(strategy.id).toBe('claude-code');
    });
  });
});

describe('claudeCodeStrategy', () => {
  describe('shouldAbsorbIntoPrevious', () => {
    it('returns true for tool-result-only user turns', () => {
      const turn: Turn = {
        id: 'turn-1',
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'test-id', content: 'Result' },
        ],
      };
      expect(claudeCodeStrategy.shouldAbsorbIntoPrevious(turn)).toBe(true);
    });

    it('returns true for multiple tool-result user turns', () => {
      const turn: Turn = {
        id: 'turn-1',
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'id1', content: 'Result 1' },
          { type: 'tool_result', tool_use_id: 'id2', content: 'Result 2' },
        ],
      };
      expect(claudeCodeStrategy.shouldAbsorbIntoPrevious(turn)).toBe(true);
    });

    it('returns false for user turns with text content', () => {
      const turn: Turn = {
        id: 'turn-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
        ],
      };
      expect(claudeCodeStrategy.shouldAbsorbIntoPrevious(turn)).toBe(false);
    });

    it('returns false for mixed user turns', () => {
      const turn: Turn = {
        id: 'turn-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Check this' },
          { type: 'tool_result', tool_use_id: 'test-id', content: 'Result' },
        ],
      };
      expect(claudeCodeStrategy.shouldAbsorbIntoPrevious(turn)).toBe(false);
    });

    it('returns false for assistant turns', () => {
      const turn: Turn = {
        id: 'turn-1',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },
        ],
      };
      expect(claudeCodeStrategy.shouldAbsorbIntoPrevious(turn)).toBe(false);
    });

    it('returns false for empty user turns', () => {
      const turn: Turn = {
        id: 'turn-1',
        role: 'user',
        content: [],
      };
      expect(claudeCodeStrategy.shouldAbsorbIntoPrevious(turn)).toBe(false);
    });
  });

  describe('extractTimingData', () => {
    it('returns empty maps for undefined entries', () => {
      const result = claudeCodeStrategy.extractTimingData(undefined);
      expect(result.toolUseTimestamps.size).toBe(0);
      expect(result.toolResultTimestamps.size).toBe(0);
      expect(result.thinkingTimings).toHaveLength(0);
    });

    it('returns empty maps for empty entries', () => {
      const result = claudeCodeStrategy.extractTimingData([]);
      expect(result.toolUseTimestamps.size).toBe(0);
      expect(result.toolResultTimestamps.size).toBe(0);
      expect(result.thinkingTimings).toHaveLength(0);
    });

    it('extracts tool_use timestamps from assistant entries', () => {
      const entries: Entry[] = [
        {
          type: 'assistant',
          uuid: '1',
          timestamp: '2024-01-01T12:00:00Z',
          parsedAssistantMessage: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
            ],
          },
        },
      ];

      const result = claudeCodeStrategy.extractTimingData(entries);
      expect(result.toolUseTimestamps.has('tool-1')).toBe(true);
    });

    it('extracts tool_result timestamps from user entries', () => {
      const entries: Entry[] = [
        {
          type: 'user',
          uuid: '1',
          timestamp: '2024-01-01T12:00:05Z',
          parsedUserMessage: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'tool-1', content: 'File contents' },
            ],
          },
        },
      ];

      const result = claudeCodeStrategy.extractTimingData(entries);
      expect(result.toolResultTimestamps.has('tool-1')).toBe(true);
    });

    it('extracts thinking block timings', () => {
      const entries: Entry[] = [
        {
          type: 'assistant',
          uuid: '1',
          timestamp: '2024-01-01T12:00:00Z',
          parsedAssistantMessage: {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'Let me think about this...' },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: '2',
          timestamp: '2024-01-01T12:00:05Z',
          parsedAssistantMessage: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here is my response' },
            ],
          },
        },
      ];

      const result = claudeCodeStrategy.extractTimingData(entries);
      expect(result.thinkingTimings).toHaveLength(1);
      expect(result.thinkingTimings[0].text).toBe('Let me think about this...');
      expect(result.thinkingTimings[0].durationMs).toBe(5000); // 5 seconds
    });

    it('handles entries without timestamps', () => {
      const entries: Entry[] = [
        {
          type: 'assistant',
          uuid: '1',
          // No timestamp
          parsedAssistantMessage: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
            ],
          },
        },
      ];

      const result = claudeCodeStrategy.extractTimingData(entries);
      expect(result.toolUseTimestamps.size).toBe(0);
    });
  });
});

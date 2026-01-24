/**
 * Unit tests for cluster builder functions
 */

import { describe, it, expect } from 'vitest';
import {
  buildClusters,
  extractSearchableContent,
  calculateClusterMetrics,
  clusterContainsWord,
  findClustersWithWord,
  type TurnCluster,
  type SearchableClusterContent,
} from './cluster-builder';
import type { Conversation, Turn, ContentBlock } from '../../data/types';

// Helper to create a text content block
function textBlock(text: string): ContentBlock {
  return { type: 'text', text };
}

// Helper to create a thinking content block
function thinkingBlock(thinking: string): ContentBlock {
  return { type: 'thinking', thinking };
}

// Helper to create a tool_use content block
function toolUseBlock(name: string, input: Record<string, unknown>): ContentBlock {
  return { type: 'tool_use', id: `tool_${name}`, name, input };
}

// Helper to create a tool_result content block
function toolResultBlock(content: string, isError = false): ContentBlock {
  return { type: 'tool_result', tool_use_id: 'tool_1', content, is_error: isError };
}

// Helper to create a turn
let turnCounter = 0;
function createTurn(role: 'user' | 'assistant', content: ContentBlock[], usage?: Turn['usage']): Turn {
  return { id: `turn_${++turnCounter}`, role, content, usage };
}

// Helper to create a minimal conversation
function createConversation(turns: Turn[]): Conversation {
  return {
    meta: { title: 'Test Conversation' },
    turns,
  };
}

describe('buildClusters', () => {
  it('returns empty array for null conversation', () => {
    const clusters = buildClusters(null);
    expect(clusters).toEqual([]);
  });

  it('returns empty array for conversation with no turns', () => {
    const conversation = createConversation([]);
    const clusters = buildClusters(conversation);
    expect(clusters).toEqual([]);
  });

  it('creates a cluster from a user-assistant pair', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Hello')]),
      createTurn('assistant', [textBlock('Hi there')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].index).toBe(0);
    expect(clusters[0].userTurn?.content).toHaveLength(1);
    expect(clusters[0].assistantTurn?.content).toHaveLength(1);
    expect(clusters[0].userTurnIndex).toBe(0);
    expect(clusters[0].assistantTurnIndex).toBe(1);
  });

  it('creates multiple clusters for multiple exchanges', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('First question')]),
      createTurn('assistant', [textBlock('First answer')]),
      createTurn('user', [textBlock('Second question')]),
      createTurn('assistant', [textBlock('Second answer')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].index).toBe(0);
    expect(clusters[1].index).toBe(1);
  });

  it('merges consecutive user turns into single cluster', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Part 1')]),
      createTurn('user', [textBlock('Part 2')]),
      createTurn('assistant', [textBlock('Response')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].userTurn?.content).toHaveLength(2);
    expect(clusters[0].userTurnIndex).toBe(0); // First user turn index
  });

  it('merges consecutive assistant turns into single cluster', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Question')]),
      createTurn('assistant', [textBlock('Part 1')]),
      createTurn('assistant', [textBlock('Part 2')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].assistantTurn?.content).toHaveLength(2);
    expect(clusters[0].assistantTurnIndex).toBe(1); // First assistant turn index
  });

  it('handles orphan assistant turn at start', () => {
    const conversation = createConversation([
      createTurn('assistant', [textBlock('Greeting')]),
      createTurn('user', [textBlock('Hello')]),
      createTurn('assistant', [textBlock('Hi')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].userTurn).toBeUndefined();
    expect(clusters[0].assistantTurn?.content).toHaveLength(1);
    expect(clusters[1].userTurn?.content).toHaveLength(1);
  });

  it('counts thinking blocks correctly', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Question')]),
      createTurn('assistant', [
        thinkingBlock('Let me think...'),
        thinkingBlock('More thinking...'),
        textBlock('Answer'),
      ]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters[0].thinkingCount).toBe(2);
  });

  it('counts tool blocks correctly', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Do something')]),
      createTurn('assistant', [
        toolUseBlock('read_file', { path: '/test' }),
        toolUseBlock('write_file', { path: '/test', content: 'data' }),
        textBlock('Done'),
      ]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters[0].toolCount).toBe(2);
  });

  it('sets expanded to false by default', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Hello')]),
      createTurn('assistant', [textBlock('Hi')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters[0].expanded).toBe(false);
  });
});

describe('extractSearchableContent', () => {
  it('returns empty array for empty clusters', () => {
    const content = extractSearchableContent([]);
    expect(content).toEqual([]);
  });

  it('extracts user text correctly', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      userTurn: createTurn('user', [textBlock('Hello world')]),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].userText).toBe('Hello world');
  });

  it('joins multiple user text blocks with newlines', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      userTurn: createTurn('user', [textBlock('Line 1'), textBlock('Line 2')]),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].userText).toBe('Line 1\nLine 2');
  });

  it('extracts assistant text correctly', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [textBlock('Response text')]),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].assistantText).toBe('Response text');
  });

  it('extracts thinking blocks correctly', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [
        thinkingBlock('First thought'),
        thinkingBlock('Second thought'),
      ]),
      expanded: false,
      thinkingCount: 2,
      toolCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].thinkingBlocks).toHaveLength(2);
    expect(content[0].thinkingBlocks[0]).toBe('First thought');
    expect(content[0].thinkingBlocks[1]).toBe('Second thought');
  });

  it('extracts tool uses correctly', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [
        toolUseBlock('read_file', { path: '/test.txt' }),
      ]),
      expanded: false,
      thinkingCount: 0,
      toolCount: 1,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].toolUses).toHaveLength(1);
    expect(content[0].toolUses[0].name).toBe('read_file');
    expect(content[0].toolUses[0].input).toContain('/test.txt');
  });

  it('extracts tool results correctly', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [
        toolResultBlock('File contents here', false),
      ]),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].toolResults).toHaveLength(1);
    expect(content[0].toolResults[0].content).toBe('File contents here');
    expect(content[0].toolResults[0].isError).toBe(false);
  });

  it('identifies error tool results', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [
        toolResultBlock('Error: file not found', true),
      ]),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].toolResults[0].isError).toBe(true);
  });

  it('preserves cluster index', () => {
    const clusters: TurnCluster[] = [
      { index: 0, expanded: false, thinkingCount: 0, toolCount: 0 },
      { index: 1, expanded: false, thinkingCount: 0, toolCount: 0 },
      { index: 2, expanded: false, thinkingCount: 0, toolCount: 0 },
    ];

    const content = extractSearchableContent(clusters);

    expect(content[0].clusterIndex).toBe(0);
    expect(content[1].clusterIndex).toBe(1);
    expect(content[2].clusterIndex).toBe(2);
  });
});

describe('calculateClusterMetrics', () => {
  it('returns empty array for empty clusters', () => {
    const metrics = calculateClusterMetrics([]);
    expect(metrics).toEqual([]);
  });

  it('calculates content length from user turn', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      userTurn: createTurn('user', [textBlock('Hello')]), // 5 chars
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].contentLength).toBe(5);
  });

  it('calculates content length from assistant text', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [textBlock('Response')]), // 8 chars
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].contentLength).toBe(8);
  });

  it('includes thinking block length in content length', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [
        thinkingBlock('Thinking'), // 8 chars
        textBlock('Output'),       // 6 chars
      ]),
      expanded: false,
      thinkingCount: 1,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].contentLength).toBe(14);
  });

  it('extracts input tokens from user turn usage', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      userTurn: createTurn('user', [textBlock('Hello')], { input_tokens: 100 }),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].inputTokens).toBe(100);
  });

  it('extracts output tokens from assistant turn usage', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [textBlock('Hi')], { output_tokens: 50 }),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].outputTokens).toBe(50);
  });

  it('includes cache tokens in input tokens', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      assistantTurn: createTurn('assistant', [textBlock('Hi')], {
        cache_read_input_tokens: 30,
        cache_creation_input_tokens: 20,
      }),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].inputTokens).toBe(50);
  });

  it('calculates total tokens as sum of input and output', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      userTurn: createTurn('user', [textBlock('Q')], { input_tokens: 100 }),
      assistantTurn: createTurn('assistant', [textBlock('A')], { output_tokens: 50 }),
      expanded: false,
      thinkingCount: 0,
      toolCount: 0,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].totalTokens).toBe(150);
  });

  it('preserves thinking and tool counts', () => {
    const clusters: TurnCluster[] = [{
      index: 0,
      expanded: false,
      thinkingCount: 3,
      toolCount: 5,
    }];

    const metrics = calculateClusterMetrics(clusters);

    expect(metrics[0].thinkingCount).toBe(3);
    expect(metrics[0].toolCount).toBe(5);
  });
});

describe('clusterContainsWord', () => {
  const baseSearchable: SearchableClusterContent = {
    clusterIndex: 0,
    userText: '',
    assistantText: '',
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
  };

  it('finds word in user text', () => {
    const searchable = { ...baseSearchable, userText: 'Hello world' };
    expect(clusterContainsWord(searchable, 'hello')).toBe(true);
    expect(clusterContainsWord(searchable, 'world')).toBe(true);
  });

  it('finds word in assistant text', () => {
    const searchable = { ...baseSearchable, assistantText: 'The answer is 42' };
    expect(clusterContainsWord(searchable, 'answer')).toBe(true);
  });

  it('finds word in thinking blocks', () => {
    const searchable = { ...baseSearchable, thinkingBlocks: ['Let me analyze this'] };
    expect(clusterContainsWord(searchable, 'analyze')).toBe(true);
  });

  it('finds word in tool names', () => {
    const searchable = { ...baseSearchable, toolUses: [{ name: 'read_file', input: '{}' }] };
    expect(clusterContainsWord(searchable, 'read')).toBe(true);
  });

  it('finds word in tool input', () => {
    const searchable = { ...baseSearchable, toolUses: [{ name: 'tool', input: '{"path": "/test/file.txt"}' }] };
    expect(clusterContainsWord(searchable, 'file')).toBe(true);
  });

  it('finds word in tool results', () => {
    const searchable = { ...baseSearchable, toolResults: [{ content: 'Success: operation completed', isError: false }] };
    expect(clusterContainsWord(searchable, 'success')).toBe(true);
  });

  it('is case insensitive', () => {
    const searchable = { ...baseSearchable, userText: 'UPPERCASE text' };
    expect(clusterContainsWord(searchable, 'uppercase')).toBe(true);
    expect(clusterContainsWord(searchable, 'UPPERCASE')).toBe(true);
    expect(clusterContainsWord(searchable, 'UpperCase')).toBe(true);
  });

  it('returns false when word not found', () => {
    const searchable = { ...baseSearchable, userText: 'Hello world' };
    expect(clusterContainsWord(searchable, 'goodbye')).toBe(false);
  });
});

describe('findClustersWithWord', () => {
  it('returns empty array when no matches', () => {
    const content: SearchableClusterContent[] = [
      { clusterIndex: 0, userText: 'Hello', assistantText: '', thinkingBlocks: [], toolUses: [], toolResults: [] },
    ];

    const indices = findClustersWithWord(content, 'goodbye');

    expect(indices).toEqual([]);
  });

  it('returns indices of matching clusters', () => {
    const content: SearchableClusterContent[] = [
      { clusterIndex: 0, userText: 'Hello', assistantText: '', thinkingBlocks: [], toolUses: [], toolResults: [] },
      { clusterIndex: 1, userText: 'World', assistantText: '', thinkingBlocks: [], toolUses: [], toolResults: [] },
      { clusterIndex: 2, userText: 'Hello again', assistantText: '', thinkingBlocks: [], toolUses: [], toolResults: [] },
    ];

    const indices = findClustersWithWord(content, 'hello');

    expect(indices).toEqual([0, 2]);
  });

  it('returns all indices when all match', () => {
    const content: SearchableClusterContent[] = [
      { clusterIndex: 0, userText: 'test', assistantText: '', thinkingBlocks: [], toolUses: [], toolResults: [] },
      { clusterIndex: 1, userText: 'test', assistantText: '', thinkingBlocks: [], toolUses: [], toolResults: [] },
    ];

    const indices = findClustersWithWord(content, 'test');

    expect(indices).toEqual([0, 1]);
  });
});

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
  isToolResultOnly,
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

  it('folds tool-result-only user turns into the assistant content', () => {
    // Simulates: user prompt → assistant thinks + uses tool → tool result → assistant continues
    const conversation = createConversation([
      createTurn('user', [textBlock('Read my file')]),
      createTurn('assistant', [thinkingBlock('Let me read it'), toolUseBlock('Read', { path: '/f.txt' })]),
      createTurn('user', [toolResultBlock('file contents')]),           // tool result - should fold
      createTurn('assistant', [textBlock('Here is your file content')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].userTurn?.content).toHaveLength(1);
    // Assistant content: thinking + tool_use + tool_result + text
    expect(clusters[0].assistantTurn?.content).toHaveLength(4);
    expect(clusters[0].assistantTurn?.content[0].type).toBe('thinking');
    expect(clusters[0].assistantTurn?.content[1].type).toBe('tool_use');
    expect(clusters[0].assistantTurn?.content[2].type).toBe('tool_result');
    expect(clusters[0].assistantTurn?.content[3].type).toBe('text');
  });

  it('folds multiple tool-result rounds into the same cluster', () => {
    // Simulates: user → assistant tool_use → result → assistant tool_use → result → done
    const conversation = createConversation([
      createTurn('user', [textBlock('Do two things')]),
      createTurn('assistant', [toolUseBlock('Read', { path: '/a' })]),
      createTurn('user', [toolResultBlock('content of a')]),           // round 1 result
      createTurn('assistant', [toolUseBlock('Read', { path: '/b' })]),
      createTurn('user', [toolResultBlock('content of b')]),           // round 2 result
      createTurn('assistant', [textBlock('Done reading both')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    // tool_use + tool_result + tool_use + tool_result + text = 5 blocks in assistant
    expect(clusters[0].assistantTurn?.content).toHaveLength(5);
    expect(clusters[0].toolCount).toBe(2);
  });

  it('does not fold user turns that contain non-tool_result blocks', () => {
    // A real user follow-up message should start a new cluster
    const conversation = createConversation([
      createTurn('user', [textBlock('First question')]),
      createTurn('assistant', [toolUseBlock('Read', { path: '/f' })]),
      createTurn('user', [toolResultBlock('result')]),                 // tool result - folds
      createTurn('assistant', [textBlock('Got it')]),
      createTurn('user', [textBlock('Second question')]),              // real user message - new cluster
      createTurn('assistant', [textBlock('Second answer')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].assistantTurn?.content).toHaveLength(3); // tool_use + tool_result + text
    expect(clusters[1].userTurn?.content[0].type).toBe('text');
  });

  it('does not fold user turns with mixed content (text + tool_result)', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Question')]),
      createTurn('assistant', [toolUseBlock('Read', { path: '/f' })]),
      createTurn('user', [textBlock('Also here is context'), toolResultBlock('result')]), // mixed - new cluster
      createTurn('assistant', [textBlock('Noted')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(2);
  });

  it('folds tool results for orphan assistant turns', () => {
    // Assistant starts without user message, uses tools
    const conversation = createConversation([
      createTurn('assistant', [toolUseBlock('Glob', { pattern: '*' })]),
      createTurn('user', [toolResultBlock('file1\nfile2')]),           // tool result - folds
      createTurn('assistant', [textBlock('Found files')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].userTurn).toBeUndefined();
    expect(clusters[0].assistantTurn?.content).toHaveLength(3); // tool_use + tool_result + text
  });

  it('handles trailing tool-result-only user turn (no subsequent assistant)', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('Read file')]),
      createTurn('assistant', [toolUseBlock('Read', { path: '/f' })]),
      createTurn('user', [toolResultBlock('contents')]),               // trailing tool result
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].assistantTurn?.content).toHaveLength(2); // tool_use + tool_result
  });

  it('matches f.jsonl structure: one real user prompt with multi-step tool use', () => {
    // Mirrors the actual f.jsonl structure:
    // user text → assistant(thinking) → assistant(tool_use) →
    // user(tool_result) → assistant(thinking) → assistant(text) →
    // assistant(tool_use) → assistant(tool_use) → user(tool_result)
    const conversation = createConversation([
      createTurn('user', [textBlock('read AGENTS.md')]),
      createTurn('assistant', [thinkingBlock('thinking 1')]),
      createTurn('assistant', [toolUseBlock('Read', { file_path: 'AGENTS.md' })]),
      createTurn('user', [toolResultBlock('# AGENTS content...')]),
      createTurn('assistant', [thinkingBlock('thinking 2')]),
      createTurn('assistant', [textBlock('Let me explore')]),
      createTurn('assistant', [toolUseBlock('Glob', { pattern: '**/*' })]),
      createTurn('assistant', [toolUseBlock('WebFetch', { url: 'https://...' })]),
      createTurn('user', [toolResultBlock('file list...')]),
    ]);

    const clusters = buildClusters(conversation);

    // Should be ONE cluster, not three
    expect(clusters).toHaveLength(1);

    const cluster = clusters[0];
    expect(cluster.userTurn?.content).toHaveLength(1);
    expect(cluster.userTurn?.content[0].type).toBe('text');

    // All assistant + tool_result blocks merged:
    // thinking + tool_use + tool_result + thinking + text + tool_use + tool_use + tool_result
    expect(cluster.assistantTurn?.content).toHaveLength(8);
    expect(cluster.assistantTurn?.content.map(b => b.type)).toEqual([
      'thinking', 'tool_use', 'tool_result',
      'thinking', 'text', 'tool_use', 'tool_use', 'tool_result',
    ]);

    expect(cluster.thinkingCount).toBe(2);
    expect(cluster.toolCount).toBe(3);
  });
});

describe('isToolResultOnly', () => {
  it('returns true for user turn with only tool_result blocks', () => {
    const turn = createTurn('user', [toolResultBlock('result')]);
    expect(isToolResultOnly(turn)).toBe(true);
  });

  it('returns true for user turn with multiple tool_result blocks', () => {
    const turn = createTurn('user', [
      toolResultBlock('result 1'),
      toolResultBlock('result 2'),
    ]);
    expect(isToolResultOnly(turn)).toBe(true);
  });

  it('returns false for user turn with text content', () => {
    const turn = createTurn('user', [textBlock('Hello')]);
    expect(isToolResultOnly(turn)).toBe(false);
  });

  it('returns false for user turn with mixed content', () => {
    const turn = createTurn('user', [
      textBlock('Context'),
      toolResultBlock('result'),
    ]);
    expect(isToolResultOnly(turn)).toBe(false);
  });

  it('returns false for assistant turns', () => {
    const turn = createTurn('assistant', [toolResultBlock('result')]);
    expect(isToolResultOnly(turn)).toBe(false);
  });

  it('returns false for empty user turn', () => {
    const turn = createTurn('user', []);
    expect(isToolResultOnly(turn)).toBe(false);
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].thinkingBlocks).toHaveLength(2);
    expect(content[0].thinkingBlocks[0].text).toBe('First thought');
    expect(content[0].thinkingBlocks[1].text).toBe('Second thought');
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
    }];

    const content = extractSearchableContent(clusters);

    expect(content[0].toolResults[0].isError).toBe(true);
  });

  it('preserves cluster index', () => {
    const clusters: TurnCluster[] = [
      { index: 0, expanded: false, thinkingCount: 0, toolCount: 0, documentCount: 0 },
      { index: 1, expanded: false, thinkingCount: 0, toolCount: 0, documentCount: 0 },
      { index: 2, expanded: false, thinkingCount: 0, toolCount: 0, documentCount: 0 },
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
      documentCount: 0,
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
    thinkingBlocks: [].map(t => ({ text: t })),
    toolUses: [],
    toolResults: [],
    documents: [],
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
    const searchable = { ...baseSearchable, thinkingBlocks: ['Let me analyze this'].map(t => ({ text: t })) };
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
      { clusterIndex: 0, userText: 'Hello', assistantText: '', thinkingBlocks: [].map(t => ({ text: t })), toolUses: [], toolResults: [], documents: [] },
    ];

    const indices = findClustersWithWord(content, 'goodbye');

    expect(indices).toEqual([]);
  });

  it('returns indices of matching clusters', () => {
    const content: SearchableClusterContent[] = [
      { clusterIndex: 0, userText: 'Hello', assistantText: '', thinkingBlocks: [].map(t => ({ text: t })), toolUses: [], toolResults: [], documents: [] },
      { clusterIndex: 1, userText: 'World', assistantText: '', thinkingBlocks: [].map(t => ({ text: t })), toolUses: [], toolResults: [], documents: [] },
      { clusterIndex: 2, userText: 'Hello again', assistantText: '', thinkingBlocks: [].map(t => ({ text: t })), toolUses: [], toolResults: [], documents: [] },
    ];

    const indices = findClustersWithWord(content, 'hello');

    expect(indices).toEqual([0, 2]);
  });

  it('returns all indices when all match', () => {
    const content: SearchableClusterContent[] = [
      { clusterIndex: 0, userText: 'test', assistantText: '', thinkingBlocks: [].map(t => ({ text: t })), toolUses: [], toolResults: [], documents: [] },
      { clusterIndex: 1, userText: 'test', assistantText: '', thinkingBlocks: [].map(t => ({ text: t })), toolUses: [], toolResults: [], documents: [] },
    ];

    const indices = findClustersWithWord(content, 'test');

    expect(indices).toEqual([0, 1]);
  });
});

describe('cluster ordering', () => {
  it('cluster.index matches array position in buildClusters', () => {
    // Create a conversation with multiple exchanges
    const conversation = createConversation([
      createTurn('user', [textBlock('First')]),
      createTurn('assistant', [textBlock('Response 1')]),
      createTurn('user', [textBlock('Second')]),
      createTurn('assistant', [textBlock('Response 2')]),
      createTurn('user', [textBlock('Third')]),
      createTurn('assistant', [textBlock('Response 3')]),
      createTurn('user', [textBlock('Fourth')]),
      createTurn('assistant', [textBlock('Response 4')]),
      createTurn('user', [textBlock('Fifth')]),
      createTurn('assistant', [textBlock('Response 5')]),
    ]);

    const clusters = buildClusters(conversation);

    expect(clusters).toHaveLength(5);
    // Verify each cluster.index matches its array position
    clusters.forEach((cluster, arrayIndex) => {
      expect(cluster.index).toBe(arrayIndex);
    });
  });

  it('clusterIndex matches array position in extractSearchableContent', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('First')]),
      createTurn('assistant', [textBlock('Response 1')]),
      createTurn('user', [textBlock('Second')]),
      createTurn('assistant', [textBlock('Response 2')]),
      createTurn('user', [textBlock('Third')]),
      createTurn('assistant', [textBlock('Response 3')]),
    ]);

    const clusters = buildClusters(conversation);
    const searchable = extractSearchableContent(clusters);

    expect(searchable).toHaveLength(3);
    // Verify each clusterIndex matches its array position
    searchable.forEach((content, arrayIndex) => {
      expect(content.clusterIndex).toBe(arrayIndex);
    });
  });

  it('preserves order with complex conversation pattern', () => {
    // Test with merged turns, orphan assistant, and tool results
    const conversation = createConversation([
      createTurn('assistant', [textBlock('Greeting')]),  // orphan assistant -> cluster 0
      createTurn('user', [textBlock('Part 1')]),
      createTurn('user', [textBlock('Part 2')]),         // merged user turns
      createTurn('assistant', [toolUseBlock('Read', { path: '/f.txt' })]),
      createTurn('user', [toolResultBlock('file data')]),  // tool result - folds into assistant
      createTurn('assistant', [textBlock('Done')]),        // -> cluster 1
      createTurn('user', [textBlock('Next question')]),
      createTurn('assistant', [textBlock('Next answer')]), // -> cluster 2
    ]);

    const clusters = buildClusters(conversation);
    const searchable = extractSearchableContent(clusters);

    expect(clusters).toHaveLength(3);
    // Verify ordering preserved through all processing
    clusters.forEach((cluster, i) => {
      expect(cluster.index).toBe(i);
    });
    searchable.forEach((content, i) => {
      expect(content.clusterIndex).toBe(i);
    });

    // Verify content is in expected order
    expect(clusters[0].userTurn).toBeUndefined(); // orphan assistant
    expect(clusters[0].assistantTurn?.content[0]).toEqual(textBlock('Greeting'));
    expect(clusters[1].userTurn?.content).toHaveLength(2); // merged user
    expect(clusters[2].userTurn?.content[0]).toEqual(textBlock('Next question'));
  });

  it('maintains ordering when accessing by index', () => {
    const conversation = createConversation([
      createTurn('user', [textBlock('A')]),
      createTurn('assistant', [textBlock('1')]),
      createTurn('user', [textBlock('B')]),
      createTurn('assistant', [textBlock('2')]),
      createTurn('user', [textBlock('C')]),
      createTurn('assistant', [textBlock('3')]),
    ]);

    const clusters = buildClusters(conversation);
    const searchable = extractSearchableContent(clusters);

    // Access by index should give consistent results
    for (let i = 0; i < clusters.length; i++) {
      expect(clusters[i].index).toBe(i);
      expect(searchable[i].clusterIndex).toBe(i);
      // Content should match between cluster and searchable
      const userText = (clusters[i].userTurn?.content[0] as { text: string })?.text;
      expect(searchable[i].userText).toBe(userText);
    }
  });
});

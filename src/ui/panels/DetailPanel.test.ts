/**
 * Unit tests for DetailPanel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetailPanel, truncate, buildTurnText } from './DetailPanel';
import type { ViewerInterface, SearchableCluster, Selection } from '../types';

// Helper to create a mock viewer
function createMockViewer(overrides: Partial<ViewerInterface> = {}): ViewerInterface {
  return {
    getClusterCount: vi.fn().mockReturnValue(5),
    getClusterMetrics: vi.fn().mockReturnValue([]),
    getSearchableContent: vi.fn().mockReturnValue([]),
    getConversation: vi.fn().mockReturnValue(null),
    selectClusterByIndex: vi.fn(),
    toggleCluster: vi.fn(),
    focusOnCluster: vi.fn(),
    highlightClustersWithWord: vi.fn().mockReturnValue([]),
    unhighlightClustersByColor: vi.fn(),
    clearAllHighlights: vi.fn(),
    ...overrides,
  };
}

// Helper to create a mock cluster
function createMockCluster(overrides: Partial<SearchableCluster> = {}): SearchableCluster {
  return {
    clusterIndex: 0,
    userText: 'User message',
    assistantText: 'Assistant response',
    thinkingBlocks: ['Some thinking'],
    toolUses: [{ name: 'Read', input: '{"file_path": "/test.txt"}' }],
    toolResults: [{ content: 'File contents', isError: false }],
    ...overrides,
  };
}

describe('truncate', () => {
  it('returns text unchanged when shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns text unchanged when exactly maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates text longer than maxLength with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('handles maxLength of 0', () => {
    expect(truncate('hello', 0)).toBe('...');
  });
});

describe('buildTurnText', () => {
  it('builds text with all sections', () => {
    const cluster = createMockCluster();
    const text = buildTurnText(cluster, 1);

    expect(text).toContain('Turn 1');
    expect(text).toContain('USER:');
    expect(text).toContain('User message');
    expect(text).toContain('THINKING:');
    expect(text).toContain('Some thinking');
    expect(text).toContain('TOOL (Read):');
    expect(text).toContain('RESULT:');
    expect(text).toContain('File contents');
    expect(text).toContain('ASSISTANT:');
    expect(text).toContain('Assistant response');
  });

  it('skips empty user text', () => {
    const cluster = createMockCluster({ userText: '' });
    const text = buildTurnText(cluster, 1);

    expect(text).not.toContain('USER:');
  });

  it('skips empty thinking blocks', () => {
    const cluster = createMockCluster({ thinkingBlocks: [] });
    const text = buildTurnText(cluster, 1);

    expect(text).not.toContain('THINKING:');
  });

  it('skips empty tool uses', () => {
    const cluster = createMockCluster({ toolUses: [], toolResults: [] });
    const text = buildTurnText(cluster, 1);

    expect(text).not.toContain('TOOL (');
    expect(text).not.toContain('RESULT:');
  });

  it('skips empty assistant text', () => {
    const cluster = createMockCluster({ assistantText: '' });
    const text = buildTurnText(cluster, 1);

    expect(text).not.toContain('ASSISTANT:');
  });

  it('handles multiple thinking blocks', () => {
    const cluster = createMockCluster({
      thinkingBlocks: ['First thought', 'Second thought'],
    });
    const text = buildTurnText(cluster, 1);

    expect(text).toContain('First thought');
    expect(text).toContain('Second thought');
  });

  it('handles multiple tool uses with results', () => {
    const cluster = createMockCluster({
      toolUses: [
        { name: 'Read', input: '{"path": "a.txt"}' },
        { name: 'Write', input: '{"path": "b.txt"}' },
      ],
      toolResults: [
        { content: 'Result A', isError: false },
        { content: 'Result B', isError: false },
      ],
    });
    const text = buildTurnText(cluster, 1);

    expect(text).toContain('TOOL (Read):');
    expect(text).toContain('TOOL (Write):');
    expect(text).toContain('Result A');
    expect(text).toContain('Result B');
  });
});

describe('DetailPanel', () => {
  let container: HTMLElement;
  let viewer: ViewerInterface;
  let panel: DetailPanel;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    viewer = createMockViewer();
    panel = new DetailPanel({ container }, viewer);
  });

  afterEach(() => {
    panel.dispose();
    document.body.removeChild(container);
  });

  describe('update', () => {
    it('shows empty message when selection is null', () => {
      panel.update(null);
      expect(container.innerHTML).toContain('&lt;no selection&gt;');
    });

    it('renders type badge for selection', () => {
      const selection: Selection = {
        type: 'thinking',
        data: { thinking: 'Some thought' },
        turnIndex: 0,
      };
      panel.update(selection);
      expect(container.innerHTML).toContain('detail-type-badge');
      expect(container.innerHTML).toContain('thinking');
    });

    it('renders cluster details with buttons', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 1,
          toolCount: 2,
          assistantTurn: { content: [] },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('toggle-cluster-btn');
      expect(container.innerHTML).toContain('focus-cluster-btn');
      expect(container.innerHTML).toContain('copy-turn-btn');
      expect(container.innerHTML).toContain('prev-turn-btn');
      expect(container.innerHTML).toContain('next-turn-btn');
    });

    it('renders collapse button for child nodes', () => {
      const selection: Selection = {
        type: 'thinking',
        data: { thinking: 'Test' },
        turnIndex: 0,
        clusterIndex: 2,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('collapse-parent-btn');
      expect(container.innerHTML).toContain('Turn');
      expect(container.innerHTML).toContain('3'); // clusterIndex + 1
    });

    it('renders raw data toggle', () => {
      const selection: Selection = {
        type: 'user',
        data: { content: [] },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('toggle-raw-btn');
      expect(container.innerHTML).toContain('Show Raw Data');
    });

    it('does nothing when disposed', () => {
      panel.dispose();
      panel.update({ type: 'test', data: {}, turnIndex: 0 });
      // Container should remain empty (no crash)
      expect(container.innerHTML).toBe('');
    });
  });

  describe('clear', () => {
    it('clears content and shows empty message', () => {
      panel.update({ type: 'test', data: {}, turnIndex: 0 });
      panel.clear();
      expect(container.innerHTML).toContain('&lt;no selection&gt;');
    });
  });

  describe('button interactions', () => {
    it('calls toggleCluster when toggle button is clicked', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 2,
          thinkingCount: 0,
          toolCount: 0,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      const toggleBtn = document.getElementById('toggle-cluster-btn');
      toggleBtn?.click();

      expect(viewer.toggleCluster).toHaveBeenCalledWith(2);
    });

    it('calls focusOnCluster when focus button is clicked', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 1,
          thinkingCount: 0,
          toolCount: 0,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      const focusBtn = document.getElementById('focus-cluster-btn');
      focusBtn?.click();

      expect(viewer.focusOnCluster).toHaveBeenCalledWith(1);
    });

    it('calls selectClusterByIndex when prev button is clicked', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 2,
          thinkingCount: 0,
          toolCount: 0,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      const prevBtn = document.getElementById('prev-turn-btn');
      prevBtn?.click();

      expect(viewer.selectClusterByIndex).toHaveBeenCalledWith(1);
    });

    it('calls selectClusterByIndex when next button is clicked', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 2,
          thinkingCount: 0,
          toolCount: 0,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      const nextBtn = document.getElementById('next-turn-btn');
      nextBtn?.click();

      expect(viewer.selectClusterByIndex).toHaveBeenCalledWith(3);
    });

    it('does not go to prev when at first cluster', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 0,
          toolCount: 0,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      const prevBtn = document.getElementById('prev-turn-btn');
      prevBtn?.click();

      expect(viewer.selectClusterByIndex).not.toHaveBeenCalled();
    });

    it('does not go to next when at last cluster', () => {
      viewer = createMockViewer({ getClusterCount: vi.fn().mockReturnValue(3) });
      panel = new DetailPanel({ container }, viewer);

      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 2,
          thinkingCount: 0,
          toolCount: 0,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      const nextBtn = document.getElementById('next-turn-btn');
      nextBtn?.click();

      expect(viewer.selectClusterByIndex).not.toHaveBeenCalled();
    });

    it('calls toggleCluster when collapse button is clicked', () => {
      const selection: Selection = {
        type: 'thinking',
        data: { thinking: 'Test' },
        turnIndex: 0,
        clusterIndex: 3,
      };
      panel.update(selection);

      const collapseBtn = document.getElementById('collapse-parent-btn');
      collapseBtn?.click();

      expect(viewer.toggleCluster).toHaveBeenCalledWith(3);
    });

    it('toggles raw data visibility', () => {
      const selection: Selection = {
        type: 'user',
        data: { content: [] },
        turnIndex: 0,
      };
      panel.update(selection);

      const toggleBtn = document.getElementById('toggle-raw-btn');
      const rawContent = document.getElementById('raw-data-content');

      expect(rawContent?.style.display).toBe('none');

      toggleBtn?.click();
      expect(rawContent?.style.display).toBe('block');
      expect(toggleBtn?.textContent).toBe('Hide Raw Data');

      toggleBtn?.click();
      expect(rawContent?.style.display).toBe('none');
      expect(toggleBtn?.textContent).toBe('Show Raw Data');
    });
  });

  describe('type-specific content', () => {
    it('renders thinking block content', () => {
      const selection: Selection = {
        type: 'thinking',
        data: { thinking: 'Deep thought process here' },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Deep thought process here');
      expect(container.innerHTML).toContain('copy-btn');
    });

    it('renders tool_use content', () => {
      const selection: Selection = {
        type: 'tool_use',
        data: {
          name: 'Read',
          input: { file_path: '/test.txt' },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Read');
      expect(container.innerHTML).toContain('file_path');
      expect(container.innerHTML).toContain('/test.txt');
    });

    it('renders tool_result content', () => {
      const selection: Selection = {
        type: 'tool_result',
        data: {
          content: 'Tool output here',
          is_error: false,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Result');
      expect(container.innerHTML).toContain('Tool output here');
    });

    it('renders tool_result error indicator', () => {
      const selection: Selection = {
        type: 'tool_result',
        data: {
          content: 'Error message',
          is_error: true,
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Error');
    });

    it('renders user turn with text preview', () => {
      const selection: Selection = {
        type: 'user',
        data: {
          content: [{ type: 'text', text: 'User question here' }],
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('User question here');
      expect(container.innerHTML).toContain('1 text');
    });

    it('renders assistant turn with block summary', () => {
      const selection: Selection = {
        type: 'assistant',
        data: {
          content: [
            { type: 'text', text: 'Response' },
            { type: 'thinking', thinking: 'Thought' },
            { type: 'tool_use', name: 'Read' },
          ],
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('1 text');
      expect(container.innerHTML).toContain('1 thinking');
      expect(container.innerHTML).toContain('1 tool_use');
    });
  });

  describe('cluster details', () => {
    it('renders user message preview', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 0,
          toolCount: 0,
          userTurn: {
            content: [{ type: 'text', text: 'Hello, how are you?' }],
          },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('User');
      expect(container.innerHTML).toContain('Hello, how are you?');
    });

    it('renders assistant text preview', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 0,
          toolCount: 0,
          assistantTurn: {
            content: [{ type: 'text', text: 'I am doing well!' }],
          },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Assistant');
      expect(container.innerHTML).toContain('I am doing well!');
    });

    it('renders thinking block list', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 2,
          toolCount: 0,
          assistantTurn: {
            content: [
              { type: 'thinking', thinking: 'First thought' },
              { type: 'thinking', thinking: 'Second thought' },
            ],
          },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Thinking (2)');
      expect(container.innerHTML).toContain('First thought');
      expect(container.innerHTML).toContain('Second thought');
    });

    it('renders tool use list', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 0,
          toolCount: 2,
          assistantTurn: {
            content: [
              { type: 'tool_use', name: 'Read' },
              { type: 'tool_use', name: 'Write' },
            ],
          },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Tool Calls (2)');
      expect(container.innerHTML).toContain('Read');
      expect(container.innerHTML).toContain('Write');
    });

    it('renders tool result list', () => {
      const selection: Selection = {
        type: 'cluster',
        data: {
          expanded: false,
          index: 0,
          thinkingCount: 0,
          toolCount: 1,
          assistantTurn: {
            content: [
              { type: 'tool_result', content: 'Success output', is_error: false },
              { type: 'tool_result', content: 'Error output', is_error: true },
            ],
          },
        },
        turnIndex: 0,
      };
      panel.update(selection);

      expect(container.innerHTML).toContain('Tool Results (2)');
      expect(container.innerHTML).toContain('Success output');
      expect(container.innerHTML).toContain('Error output');
    });
  });
});

// Import afterEach from vitest
import { afterEach } from 'vitest';

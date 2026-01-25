/**
 * Unit tests for ConversationPanel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationPanel } from './ConversationPanel';
import type { ViewerInterface, SearchableCluster, ConversationData } from '../types';

// Helper to create a mock viewer
function createMockViewer(overrides: Partial<ViewerInterface> = {}): ViewerInterface {
  return {
    getClusterCount: vi.fn().mockReturnValue(2),
    getClusterMetrics: vi.fn().mockReturnValue([]),
    getSearchableContent: vi.fn().mockReturnValue(createMockClusters()),
    getConversation: vi.fn().mockReturnValue(createMockConversation()),
    selectClusterByIndex: vi.fn(),
    toggleCluster: vi.fn(),
    focusOnCluster: vi.fn(),
    highlightClustersWithWord: vi.fn().mockReturnValue([]),
    unhighlightClustersByColor: vi.fn(),
    clearAllHighlights: vi.fn(),
    ...overrides,
  };
}

// Helper to create mock searchable clusters
function createMockClusters(): SearchableCluster[] {
  return [
    {
      clusterIndex: 0,
      userText: 'Hello, how are you?',
      assistantText: 'I am doing well, thank you!',
      thinkingBlocks: ['Thinking about greeting...'],
      toolUses: [{ name: 'Read', input: '{"file": "test.txt"}' }],
      toolResults: [{ content: 'File contents here', isError: false }],
      documents: [],
    },
    {
      clusterIndex: 1,
      userText: 'Can you help me with code?',
      assistantText: 'Of course! What do you need help with?',
      thinkingBlocks: [],
      toolUses: [],
      toolResults: [],
      documents: [],
    },
  ];
}

// Helper to create mock conversation
function createMockConversation(): ConversationData {
  return {
    meta: {
      title: 'Test Conversation',
      model: 'claude-3',
    },
    turns: [{}, {}],
  };
}

describe('ConversationPanel', () => {
  let container: HTMLElement;
  let turnIndicator: HTMLElement;
  let filtersContainer: HTMLElement;
  let viewer: ViewerInterface;
  let panel: ConversationPanel;

  beforeEach(() => {
    // Mock scrollIntoView for JSDOM
    Element.prototype.scrollIntoView = vi.fn();

    container = document.createElement('div');
    turnIndicator = document.createElement('div');
    filtersContainer = document.createElement('div');
    filtersContainer.innerHTML = `
      <button class="conv-filter active" data-filter="user">User</button>
      <button class="conv-filter active" data-filter="output">Output</button>
      <button class="conv-filter" data-filter="thinking">Thinking</button>
      <button class="conv-filter" data-filter="tools">Tools</button>
    `;
    document.body.appendChild(container);
    document.body.appendChild(turnIndicator);
    document.body.appendChild(filtersContainer);
    viewer = createMockViewer();
    panel = new ConversationPanel(
      { container, turnIndicator, filtersContainer },
      viewer
    );
  });

  afterEach(() => {
    panel.dispose();
    document.body.removeChild(container);
    document.body.removeChild(turnIndicator);
    document.body.removeChild(filtersContainer);
  });

  describe('render', () => {
    it('renders conversation turns', () => {
      panel.render();
      const turns = container.querySelectorAll('.conv-turn');
      expect(turns.length).toBe(2);
    });

    it('shows "No conversation loaded" when no conversation', () => {
      viewer = createMockViewer({
        getConversation: vi.fn().mockReturnValue(null),
      });
      panel = new ConversationPanel({ container, turnIndicator, filtersContainer }, viewer);
      panel.render();
      expect(container.innerHTML).toContain('No conversation loaded');
    });

    it('renders user messages', () => {
      panel.render();
      const userBlocks = container.querySelectorAll('.conv-user');
      expect(userBlocks.length).toBe(2);
      expect(container.innerHTML).toContain('Hello, how are you?');
    });

    it('renders assistant text', () => {
      panel.render();
      const textBlocks = container.querySelectorAll('.conv-text');
      expect(textBlocks.length).toBe(2);
      expect(container.innerHTML).toContain('I am doing well, thank you!');
    });

    it('renders thinking blocks', () => {
      panel.render();
      const thinkingBlocks = container.querySelectorAll('.conv-thinking');
      expect(thinkingBlocks.length).toBe(1);
      expect(container.innerHTML).toContain('Thinking about greeting');
    });

    it('renders tool calls', () => {
      panel.render();
      const toolBlocks = container.querySelectorAll('.conv-tool.tool-use');
      expect(toolBlocks.length).toBe(1);
      expect(container.innerHTML).toContain('Read');
    });

    it('renders tool results', () => {
      panel.render();
      const resultBlocks = container.querySelectorAll('.conv-tool.tool-result');
      expect(resultBlocks.length).toBe(1);
      expect(container.innerHTML).toContain('File contents here');
    });

    it('updates turn indicator', () => {
      panel.render();
      expect(turnIndicator.textContent).toBe('2 turns');
    });

    it('does nothing when disposed', () => {
      panel.dispose();
      panel.render();
      expect(container.innerHTML).toBe('');
    });

    it('shows character count for long text', () => {
      viewer = createMockViewer({
        getSearchableContent: vi.fn().mockReturnValue([{
          clusterIndex: 0,
          userText: 'A'.repeat(300),
          assistantText: '',
          thinkingBlocks: [],
          toolUses: [],
          toolResults: [],
          documents: [],
        }]),
      });
      panel = new ConversationPanel({ container, turnIndicator, filtersContainer }, viewer);
      panel.render();
      expect(container.innerHTML).toContain('300');
      expect(container.innerHTML).toContain('chars');
    });
  });

  describe('filter', () => {
    it('shows all turns when filter is null', () => {
      panel.render();
      panel.filter(null);
      const turns = container.querySelectorAll('.conv-turn');
      turns.forEach((turn) => {
        expect((turn as HTMLElement).style.display).toBe('');
      });
    });

    it('hides non-matching turns', () => {
      panel.render();
      panel.filter([0]);
      const turns = container.querySelectorAll('.conv-turn');
      expect((turns[0] as HTMLElement).style.display).toBe('');
      expect((turns[1] as HTMLElement).style.display).toBe('none');
    });

    it('shows only matching turns', () => {
      panel.render();
      panel.filter([1]);
      const turns = container.querySelectorAll('.conv-turn');
      expect((turns[0] as HTMLElement).style.display).toBe('none');
      expect((turns[1] as HTMLElement).style.display).toBe('');
    });
  });

  describe('filter state', () => {
    it('returns current filter state', () => {
      const state = panel.getFilterState();
      expect(state.user).toBe(true);
      expect(state.output).toBe(true);
      expect(state.thinking).toBe(false);
      expect(state.tools).toBe(false);
    });

    it('sets filter state', () => {
      panel.setFilterState({ thinking: true });
      const state = panel.getFilterState();
      expect(state.thinking).toBe(true);
    });

    it('applies filters when state changes', () => {
      panel.render();
      panel.setFilterState({ user: false });
      const userBlocks = container.querySelectorAll('.conv-user');
      userBlocks.forEach((block) => {
        expect((block as HTMLElement).style.display).toBe('none');
      });
    });
  });

  describe('content visibility filters', () => {
    it('hides user content when filter is off', () => {
      panel.render();
      panel.setFilterState({ user: false });
      const userBlocks = container.querySelectorAll('.conv-user');
      userBlocks.forEach((block) => {
        expect((block as HTMLElement).style.display).toBe('none');
      });
    });

    it('hides output content when filter is off', () => {
      panel.render();
      panel.setFilterState({ output: false });
      const textBlocks = container.querySelectorAll('.conv-text');
      textBlocks.forEach((block) => {
        expect((block as HTMLElement).style.display).toBe('none');
      });
    });

    it('shows thinking content when filter is on', () => {
      panel.render();
      panel.setFilterState({ thinking: true });
      const thinkingBlocks = container.querySelectorAll('.conv-thinking');
      thinkingBlocks.forEach((block) => {
        expect((block as HTMLElement).style.display).toBe('');
      });
    });

    it('shows tools content when filter is on', () => {
      panel.render();
      panel.setFilterState({ tools: true });
      const toolBlocks = container.querySelectorAll('.conv-tool');
      toolBlocks.forEach((block) => {
        expect((block as HTMLElement).style.display).toBe('');
      });
    });
  });

  describe('filter toggle buttons', () => {
    it('toggles filter when button is clicked', () => {
      panel.render();
      const thinkingBtn = filtersContainer.querySelector('[data-filter="thinking"]') as HTMLElement;
      thinkingBtn.click();
      expect(panel.getFilterState().thinking).toBe(true);
    });

    it('updates button active state', () => {
      panel.render();
      const thinkingBtn = filtersContainer.querySelector('[data-filter="thinking"]') as HTMLElement;
      thinkingBtn.click();
      expect(thinkingBtn.classList.contains('active')).toBe(true);
    });
  });

  describe('collapsible sections', () => {
    it('toggles expanded class on header click', () => {
      panel.render();
      const header = container.querySelector('.conv-user-header') as HTMLElement;
      const parent = header.parentElement!;

      expect(parent.classList.contains('expanded')).toBe(true);
      header.click();
      expect(parent.classList.contains('expanded')).toBe(false);
      header.click();
      expect(parent.classList.contains('expanded')).toBe(true);
    });
  });

  describe('turn click handling', () => {
    it('calls selectClusterByIndex when turn is clicked', () => {
      panel.render();
      const turn = container.querySelector('.conv-turn') as HTMLElement;
      turn.click();
      expect(viewer.selectClusterByIndex).toHaveBeenCalledWith(0);
    });

    it('adds focused class to clicked turn', () => {
      panel.render();
      const turn = container.querySelector('.conv-turn') as HTMLElement;
      turn.click();
      expect(turn.classList.contains('focused')).toBe(true);
    });

    it('removes focused class from other turns', () => {
      panel.render();
      const turns = container.querySelectorAll('.conv-turn');
      (turns[0] as HTMLElement).click();
      (turns[1] as HTMLElement).click();
      expect((turns[0] as HTMLElement).classList.contains('focused')).toBe(false);
      expect((turns[1] as HTMLElement).classList.contains('focused')).toBe(true);
    });
  });

  describe('scrollToCluster', () => {
    it('adds focused class to target turn', () => {
      panel.render();
      panel.scrollToCluster(1);
      const turns = container.querySelectorAll('.conv-turn');
      expect((turns[1] as HTMLElement).classList.contains('focused')).toBe(true);
    });

    it('removes focused class from other turns', () => {
      panel.render();
      (container.querySelector('.conv-turn') as HTMLElement).classList.add('focused');
      panel.scrollToCluster(1);
      const turns = container.querySelectorAll('.conv-turn');
      expect((turns[0] as HTMLElement).classList.contains('focused')).toBe(false);
    });

    it('does not scroll if selection came from scroll', () => {
      panel.render();
      panel.markSelectionFromScroll();
      panel.scrollToCluster(1);
      // The selectionFromScroll flag should have been reset
      const turns = container.querySelectorAll('.conv-turn');
      // Turn should not have focused class because scroll was skipped
      expect((turns[1] as HTMLElement).classList.contains('focused')).toBe(false);
    });
  });

  describe('expand buttons', () => {
    it('removes needs-truncation class when clicked', () => {
      panel.render();
      const wrap = container.querySelector('.conv-content-wrap') as HTMLElement;
      wrap.classList.add('needs-truncation');
      const btn = wrap.querySelector('.conv-expand-btn') as HTMLElement;
      btn.click();
      expect(wrap.classList.contains('needs-truncation')).toBe(false);
      expect(wrap.classList.contains('full')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('marks panel as disposed', () => {
      panel.dispose();
      panel.render();
      // Should not render anything when disposed
      expect(container.innerHTML).toBe('');
    });
  });
});

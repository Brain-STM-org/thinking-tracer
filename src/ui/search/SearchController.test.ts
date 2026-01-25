/**
 * Tests for SearchController
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchController, type SearchableViewer, type FilterablePanel } from './SearchController';
import type { SearchableCluster } from '../types';

// Mock search module
vi.mock('../../search', () => ({
  isValidRegex: (pattern: string) => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  },
  highlightSnippet: (text: string, _query: string, _regex: boolean) => text,
  performSearch: vi.fn(() => []),
  getMatchingClusters: vi.fn((results) => results.map((r: { clusterIndex: number }) => r.clusterIndex)),
  getNextResultIndex: vi.fn((current, total) => total > 0 ? (current + 1) % total : -1),
  getPrevResultIndex: vi.fn((current, total) => total > 0 ? (current - 1 + total) % total : -1),
  formatResultCount: vi.fn((current, total, hasQuery) => hasQuery ? `${current + 1}/${total}` : ''),
}));

// Import mocked functions for assertions
import { performSearch, getMatchingClusters } from '../../search';

function createMockViewer(): SearchableViewer {
  return {
    getClusterCount: vi.fn(() => 5),
    getSearchableContent: vi.fn(() => [
      {
        clusterIndex: 0,
        userText: 'Hello world',
        assistantText: 'Hi there',
        thinkingBlocks: [],
        toolUses: [],
        toolResults: [],
        documents: [],
      },
      {
        clusterIndex: 1,
        userText: 'Search test',
        assistantText: 'Found it',
        thinkingBlocks: ['thinking about search'],
        toolUses: [],
        toolResults: [],
        documents: [],
      },
    ] as SearchableCluster[]),
    selectClusterByIndex: vi.fn(),
    setSearchFilter: vi.fn(),
    highlightCluster: vi.fn(),
    unhighlightCluster: vi.fn(),
  };
}

function createMockConversationPanel(): FilterablePanel {
  return {
    filter: vi.fn(),
  };
}

function createMockElements() {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'search-input';

  const resultsCount = document.createElement('span');
  const resultsList = document.createElement('div');
  const prevBtn = document.createElement('button');
  const nextBtn = document.createElement('button');
  const clearBtn = document.createElement('button');
  const regexToggle = document.createElement('button');

  // Create filter checkboxes container
  const filtersContainer = document.createElement('div');
  const userFilter = document.createElement('input');
  userFilter.type = 'checkbox';
  userFilter.checked = true;
  userFilter.dataset.type = 'user';
  userFilter.className = 'search-filter';
  const userLabel = document.createElement('label');
  userLabel.className = 'search-filter';
  userLabel.appendChild(userFilter);
  filtersContainer.appendChild(userLabel);

  const assistantFilter = document.createElement('input');
  assistantFilter.type = 'checkbox';
  assistantFilter.checked = true;
  assistantFilter.dataset.type = 'assistant';
  assistantFilter.className = 'search-filter';
  const assistantLabel = document.createElement('label');
  assistantLabel.className = 'search-filter';
  assistantLabel.appendChild(assistantFilter);
  filtersContainer.appendChild(assistantLabel);

  return {
    input,
    resultsCount,
    resultsList,
    prevBtn,
    nextBtn,
    clearBtn,
    regexToggle,
    filtersContainer,
  };
}

describe('SearchController', () => {
  let controller: SearchController;
  let viewer: SearchableViewer;
  let conversationPanel: FilterablePanel;
  let elements: ReturnType<typeof createMockElements>;

  beforeEach(() => {
    vi.useFakeTimers();
    viewer = createMockViewer();
    conversationPanel = createMockConversationPanel();
    elements = createMockElements();

    // Mock scrollIntoView which isn't available in jsdom
    Element.prototype.scrollIntoView = vi.fn();

    // Reset mocks
    vi.mocked(performSearch).mockReturnValue([]);
    vi.mocked(getMatchingClusters).mockReturnValue([]);
  });

  afterEach(() => {
    controller?.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('construction', () => {
    it('creates controller with required options', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      expect(controller).toBeDefined();
    });

    it('creates controller with all options', () => {
      const onSearchChange = vi.fn();
      const isSidebarVisible = vi.fn(() => true);

      controller = new SearchController({
        elements,
        viewer,
        conversationPanel,
        onSearchChange,
        isSidebarVisible,
      });

      expect(controller).toBeDefined();
    });
  });

  describe('search input', () => {
    it('executes search after debounce delay', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));

      // Search shouldn't run immediately
      expect(performSearch).not.toHaveBeenCalled();

      // Advance past debounce delay
      vi.advanceTimersByTime(250);

      expect(performSearch).toHaveBeenCalled();
    });

    it('gets searchable content from viewer', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'hello';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(viewer.getSearchableContent).toHaveBeenCalled();
    });

    it('applies search filter to viewer on results', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'hello', matchStart: 0, matchEnd: 5 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([0]);

      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'hello';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(viewer.setSearchFilter).toHaveBeenCalledWith([0]);
    });

    it('clears filter when no results', () => {
      vi.mocked(performSearch).mockReturnValue([]);

      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'nonexistent';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(viewer.setSearchFilter).toHaveBeenCalledWith(null);
    });

    it('filters conversation panel on results', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 1, type: 'assistant', text: 'found', matchStart: 0, matchEnd: 5 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([1]);

      controller = new SearchController({
        elements,
        viewer,
        conversationPanel,
      });

      elements.input.value = 'found';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(conversationPanel.filter).toHaveBeenCalledWith([1]);
    });
  });

  describe('highlighting', () => {
    it('highlights matching clusters', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'hello', matchStart: 0, matchEnd: 5 },
        { clusterIndex: 1, type: 'assistant', text: 'hello', matchStart: 0, matchEnd: 5 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([0, 1]);

      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'hello';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(viewer.highlightCluster).toHaveBeenCalledWith(0, expect.any(Number));
      expect(viewer.highlightCluster).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it('clears previous highlights before new search', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'first', matchStart: 0, matchEnd: 5 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([0]);

      controller = new SearchController({
        elements,
        viewer,
      });

      // First search
      elements.input.value = 'first';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      // Second search
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 1, type: 'user', text: 'second', matchStart: 0, matchEnd: 6 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([1]);

      elements.input.value = 'second';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      // Should unhighlight cluster 0 from first search
      expect(viewer.unhighlightCluster).toHaveBeenCalledWith(0);
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'result 1', matchStart: 0, matchEnd: 5 },
        { clusterIndex: 1, type: 'user', text: 'result 2', matchStart: 0, matchEnd: 5 },
        { clusterIndex: 2, type: 'user', text: 'result 3', matchStart: 0, matchEnd: 5 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([0, 1, 2]);
    });

    it('selects first result on search', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'result';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(viewer.selectClusterByIndex).toHaveBeenCalledWith(0);
    });

    it('navigates to next result on button click', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'result';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      elements.nextBtn.click();

      expect(viewer.selectClusterByIndex).toHaveBeenLastCalledWith(1);
    });

    it('navigates to previous result on button click', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'result';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      // Go to result 1 first
      elements.nextBtn.click();

      // Then go back
      elements.prevBtn.click();

      expect(viewer.selectClusterByIndex).toHaveBeenLastCalledWith(0);
    });

    it('navigates on Enter key', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'result';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(viewer.selectClusterByIndex).toHaveBeenLastCalledWith(1);
    });

    it('navigates backward on Shift+Enter', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'result';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      // First go forward
      elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // Then back with Shift+Enter
      elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));

      expect(viewer.selectClusterByIndex).toHaveBeenLastCalledWith(0);
    });
  });

  describe('clear', () => {
    it('clears search on button click', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'test', matchStart: 0, matchEnd: 4 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([0]);

      controller = new SearchController({
        elements,
        viewer,
        conversationPanel,
      });

      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      elements.clearBtn.click();

      expect(elements.input.value).toBe('');
      expect(viewer.setSearchFilter).toHaveBeenLastCalledWith(null);
      expect(conversationPanel.filter).toHaveBeenLastCalledWith(null);
      expect(viewer.unhighlightCluster).toHaveBeenCalledWith(0);
    });

    it('clears on Escape key', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'test';
      elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(elements.input.value).toBe('');
    });
  });

  describe('regex mode', () => {
    it('toggles regex mode on button click', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      expect(elements.regexToggle.classList.contains('active')).toBe(false);

      elements.regexToggle.click();

      expect(elements.regexToggle.classList.contains('active')).toBe(true);
      expect(elements.input.placeholder).toContain('Regex');
    });

    it('adds error class for invalid regex', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      // Enable regex mode
      elements.regexToggle.click();

      // Enter invalid regex
      elements.input.value = '[invalid';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(elements.input.classList.contains('regex-error')).toBe(true);
    });
  });

  describe('keyboard shortcuts', () => {
    it('focuses search on / key when sidebar visible', () => {
      const isSidebarVisible = vi.fn(() => true);

      controller = new SearchController({
        elements,
        viewer,
        isSidebarVisible,
      });

      const focusSpy = vi.spyOn(elements.input, 'focus');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));

      expect(focusSpy).toHaveBeenCalled();
    });

    it('does not focus search when sidebar hidden', () => {
      const isSidebarVisible = vi.fn(() => false);

      controller = new SearchController({
        elements,
        viewer,
        isSidebarVisible,
      });

      const focusSpy = vi.spyOn(elements.input, 'focus');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));

      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('ignores / key when in input field', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      const focusSpy = vi.spyOn(elements.input, 'focus');

      // Simulate event originating from an input
      const event = new KeyboardEvent('keydown', { key: '/' });
      Object.defineProperty(event, 'target', { value: document.createElement('input') });
      window.dispatchEvent(event);

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('calls onSearchChange with results', () => {
      const onSearchChange = vi.fn();
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'test', matchStart: 0, matchEnd: 4 },
      ]);

      controller = new SearchController({
        elements,
        viewer,
        onSearchChange,
      });

      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(onSearchChange).toHaveBeenCalledWith(true, 'test');
    });

    it('calls onSearchChange with no results', () => {
      const onSearchChange = vi.fn();
      vi.mocked(performSearch).mockReturnValue([]);

      controller = new SearchController({
        elements,
        viewer,
        onSearchChange,
      });

      elements.input.value = 'nothing';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(onSearchChange).toHaveBeenCalledWith(false, 'nothing');
    });
  });

  describe('state', () => {
    it('returns current state', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'test', matchStart: 0, matchEnd: 4 },
      ]);

      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      const state = controller.getState();

      expect(state.query).toBe('test');
      expect(state.regexMode).toBe(false);
      expect(state.resultCount).toBe(1);
    });

    it('hasResults returns correct value', () => {
      vi.mocked(performSearch).mockReturnValue([]);

      controller = new SearchController({
        elements,
        viewer,
      });

      expect(controller.hasResults()).toBe(false);

      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'test', matchStart: 0, matchEnd: 4 },
      ]);

      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(controller.hasResults()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('removes event listeners on dispose', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      const removeListenerSpy = vi.spyOn(elements.input, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('clears debounce timer on dispose', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      // Start a search that's debouncing
      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));

      controller.dispose();

      // Advance time - search should not execute
      vi.advanceTimersByTime(500);

      expect(performSearch).not.toHaveBeenCalled();
    });

    it('clears highlights on dispose', () => {
      vi.mocked(performSearch).mockReturnValue([
        { clusterIndex: 0, type: 'user', text: 'test', matchStart: 0, matchEnd: 4 },
      ]);
      vi.mocked(getMatchingClusters).mockReturnValue([0]);

      controller = new SearchController({
        elements,
        viewer,
      });

      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      controller.dispose();

      expect(viewer.unhighlightCluster).toHaveBeenCalledWith(0);
    });

    it('ignores operations after dispose', () => {
      controller = new SearchController({
        elements,
        viewer,
      });

      controller.dispose();

      // This should not throw or cause issues
      elements.input.value = 'test';
      elements.input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);

      expect(performSearch).not.toHaveBeenCalled();
    });
  });
});

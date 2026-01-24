/**
 * Unit tests for WordFrequencyPanel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WordFrequencyPanel,
  extractWords,
  getWordFrequencies,
  hexToCSS,
  getHighlightColor,
} from './WordFrequencyPanel';
import type { ViewerInterface, SearchableCluster } from '../types';

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
    highlightClustersWithWord: vi.fn().mockReturnValue([0, 1, 2]),
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
      userText: 'Hello world, this is a test message',
      assistantText: 'Hello! I can help you with testing',
      thinkingBlocks: ['Thinking about the test scenario'],
      toolUses: [],
      toolResults: [],
    },
    {
      clusterIndex: 1,
      userText: 'Another message about testing',
      assistantText: 'Testing is important for quality',
      thinkingBlocks: ['More thinking about quality'],
      toolUses: [],
      toolResults: [],
    },
  ];
}

describe('extractWords', () => {
  it('extracts words from text and counts them', () => {
    const words = extractWords('hello world hello');
    expect(words.get('hello')).toBe(2);
    expect(words.get('world')).toBe(1);
  });

  it('converts text to lowercase', () => {
    const words = extractWords('Hello WORLD Hello');
    expect(words.get('hello')).toBe(2);
    expect(words.get('world')).toBe(1);
  });

  it('filters out stop words', () => {
    const words = extractWords('the quick brown fox jumps over the lazy dog');
    expect(words.has('the')).toBe(false);
    expect(words.has('over')).toBe(false);
    expect(words.get('quick')).toBe(1);
    expect(words.get('brown')).toBe(1);
    expect(words.get('jumps')).toBe(1);
    expect(words.get('lazy')).toBe(1);
  });

  it('filters out words with 2 or fewer characters', () => {
    const words = extractWords('a an it is hello world');
    expect(words.has('an')).toBe(false);
    expect(words.has('it')).toBe(false);
    expect(words.has('is')).toBe(false);
    expect(words.get('hello')).toBe(1);
    expect(words.get('world')).toBe(1);
  });

  it('removes non-alphabetic characters', () => {
    const words = extractWords('hello123 world! test@example.com');
    expect(words.get('hello')).toBe(1);
    expect(words.get('world')).toBe(1);
    expect(words.get('test')).toBe(1);
    expect(words.get('example')).toBe(1);
    expect(words.get('com')).toBe(1);
  });

  it('handles empty string', () => {
    const words = extractWords('');
    expect(words.size).toBe(0);
  });

  it('handles string with only stop words', () => {
    const words = extractWords('the a an and or but in on at to');
    expect(words.size).toBe(0);
  });
});

describe('getWordFrequencies', () => {
  it('returns top 10 words sorted by count', () => {
    const clusters: SearchableCluster[] = [{
      clusterIndex: 0,
      userText: 'test test test apple apple banana',
      assistantText: '',
      thinkingBlocks: [],
      toolUses: [],
      toolResults: [],
    }];

    const frequencies = getWordFrequencies(clusters, 'all');
    expect(frequencies.length).toBeLessThanOrEqual(10);
    expect(frequencies[0].word).toBe('test');
    expect(frequencies[0].count).toBe(3);
    expect(frequencies[1].word).toBe('apple');
    expect(frequencies[1].count).toBe(2);
    expect(frequencies[2].word).toBe('banana');
    expect(frequencies[2].count).toBe(1);
  });

  it('filters by user source', () => {
    const clusters: SearchableCluster[] = [{
      clusterIndex: 0,
      userText: 'userword userword',
      assistantText: 'assistantword',
      thinkingBlocks: ['thinkingword'],
      toolUses: [],
      toolResults: [],
    }];

    const frequencies = getWordFrequencies(clusters, 'user');
    expect(frequencies.find(f => f.word === 'userword')).toBeDefined();
    expect(frequencies.find(f => f.word === 'assistantword')).toBeUndefined();
    expect(frequencies.find(f => f.word === 'thinkingword')).toBeUndefined();
  });

  it('filters by assistant source', () => {
    const clusters: SearchableCluster[] = [{
      clusterIndex: 0,
      userText: 'userword',
      assistantText: 'assistantword assistantword',
      thinkingBlocks: ['thinkingword'],
      toolUses: [],
      toolResults: [],
    }];

    const frequencies = getWordFrequencies(clusters, 'assistant');
    expect(frequencies.find(f => f.word === 'assistantword')).toBeDefined();
    expect(frequencies.find(f => f.word === 'userword')).toBeUndefined();
    expect(frequencies.find(f => f.word === 'thinkingword')).toBeUndefined();
  });

  it('filters by thinking source', () => {
    const clusters: SearchableCluster[] = [{
      clusterIndex: 0,
      userText: 'userword',
      assistantText: 'assistantword',
      thinkingBlocks: ['thinkingword thinkingword'],
      toolUses: [],
      toolResults: [],
    }];

    const frequencies = getWordFrequencies(clusters, 'thinking');
    expect(frequencies.find(f => f.word === 'thinkingword')).toBeDefined();
    expect(frequencies.find(f => f.word === 'userword')).toBeUndefined();
    expect(frequencies.find(f => f.word === 'assistantword')).toBeUndefined();
  });

  it('includes all sources when source is all', () => {
    const clusters: SearchableCluster[] = [{
      clusterIndex: 0,
      userText: 'userword',
      assistantText: 'assistantword',
      thinkingBlocks: ['thinkingword'],
      toolUses: [],
      toolResults: [],
    }];

    const frequencies = getWordFrequencies(clusters, 'all');
    expect(frequencies.find(f => f.word === 'userword')).toBeDefined();
    expect(frequencies.find(f => f.word === 'assistantword')).toBeDefined();
    expect(frequencies.find(f => f.word === 'thinkingword')).toBeDefined();
  });

  it('returns empty array when no words found', () => {
    const frequencies = getWordFrequencies([], 'all');
    expect(frequencies).toEqual([]);
  });

  it('aggregates words across multiple clusters', () => {
    const clusters: SearchableCluster[] = [
      {
        clusterIndex: 0,
        userText: 'testword testword',
        assistantText: '',
        thinkingBlocks: [],
        toolUses: [],
        toolResults: [],
      },
      {
        clusterIndex: 1,
        userText: 'testword',
        assistantText: '',
        thinkingBlocks: [],
        toolUses: [],
        toolResults: [],
      },
    ];

    const frequencies = getWordFrequencies(clusters, 'all');
    expect(frequencies[0].word).toBe('testword');
    expect(frequencies[0].count).toBe(3);
  });
});

describe('hexToCSS', () => {
  it('converts hex number to CSS color string', () => {
    expect(hexToCSS(0xff0000)).toBe('#ff0000');
    expect(hexToCSS(0x00ff00)).toBe('#00ff00');
    expect(hexToCSS(0x0000ff)).toBe('#0000ff');
  });

  it('pads short hex values', () => {
    expect(hexToCSS(0x000001)).toBe('#000001');
    expect(hexToCSS(0x000000)).toBe('#000000');
  });

  it('handles full color values', () => {
    expect(hexToCSS(0xe6194b)).toBe('#e6194b');
    expect(hexToCSS(0x3cb44b)).toBe('#3cb44b');
  });
});

describe('getHighlightColor', () => {
  it('returns colors from the palette', () => {
    // First color is red
    expect(getHighlightColor(0)).toBe(0xe6194b);
    // Second is green
    expect(getHighlightColor(1)).toBe(0x3cb44b);
  });

  it('wraps around for indices beyond palette size', () => {
    // 10 colors in palette, so index 10 should wrap to 0
    expect(getHighlightColor(10)).toBe(getHighlightColor(0));
    expect(getHighlightColor(11)).toBe(getHighlightColor(1));
  });
});

describe('WordFrequencyPanel', () => {
  let container: HTMLElement;
  let sourceSelect: HTMLSelectElement;
  let viewer: ViewerInterface;
  let panel: WordFrequencyPanel;

  beforeEach(() => {
    container = document.createElement('div');
    sourceSelect = document.createElement('select');
    sourceSelect.innerHTML = `
      <option value="all">All</option>
      <option value="user">User</option>
      <option value="assistant">Assistant</option>
      <option value="thinking">Thinking</option>
    `;
    document.body.appendChild(container);
    document.body.appendChild(sourceSelect);
    viewer = createMockViewer({
      getSearchableContent: vi.fn().mockReturnValue(createMockClusters()),
    });
    panel = new WordFrequencyPanel({ container, sourceSelect }, viewer);
  });

  afterEach(() => {
    panel.dispose();
    document.body.removeChild(container);
    document.body.removeChild(sourceSelect);
  });

  describe('render', () => {
    it('renders word frequency rows', () => {
      panel.render();
      expect(container.querySelectorAll('.word-freq-row').length).toBeGreaterThan(0);
    });

    it('shows "No words found" when content is empty', () => {
      viewer = createMockViewer({
        getSearchableContent: vi.fn().mockReturnValue([]),
      });
      panel = new WordFrequencyPanel({ container, sourceSelect }, viewer);
      panel.render();
      expect(container.innerHTML).toContain('No words found');
    });

    it('renders word labels', () => {
      panel.render();
      expect(container.querySelector('.word-freq-label')).not.toBeNull();
    });

    it('renders count values', () => {
      panel.render();
      expect(container.querySelector('.word-freq-count')).not.toBeNull();
    });

    it('renders color indicators', () => {
      panel.render();
      expect(container.querySelector('.word-freq-color')).not.toBeNull();
    });

    it('renders bar charts', () => {
      panel.render();
      expect(container.querySelector('.word-freq-bar')).not.toBeNull();
    });

    it('clears highlights on re-render', () => {
      panel.render();
      panel.render();
      expect(viewer.clearAllHighlights).toHaveBeenCalled();
    });

    it('does nothing when disposed', () => {
      panel.dispose();
      panel.render();
      // Container should be empty
      expect(container.innerHTML).toBe('');
    });
  });

  describe('source selector', () => {
    it('re-renders when source changes', () => {
      panel.render();

      sourceSelect.value = 'user';
      sourceSelect.dispatchEvent(new Event('change'));

      // Should have re-rendered (clearAllHighlights called again)
      expect(viewer.clearAllHighlights).toHaveBeenCalledTimes(2);
    });
  });

  describe('word highlighting', () => {
    it('highlights word when clicked', () => {
      panel.render();
      const row = container.querySelector('.word-freq-row') as HTMLElement;
      row?.click();

      expect(viewer.highlightClustersWithWord).toHaveBeenCalled();
    });

    it('adds active class when word is highlighted', () => {
      panel.render();
      const row = container.querySelector('.word-freq-row') as HTMLElement;
      row?.click();

      expect(row?.classList.contains('active')).toBe(true);
    });

    it('unhighlights word when clicked again', () => {
      panel.render();
      const row = container.querySelector('.word-freq-row') as HTMLElement;

      // First click - highlight
      row?.click();
      expect(row?.classList.contains('active')).toBe(true);

      // Second click - unhighlight
      row?.click();
      expect(viewer.unhighlightClustersByColor).toHaveBeenCalled();
      expect(row?.classList.contains('active')).toBe(false);
    });

    it('does not highlight if no clusters match', () => {
      viewer = createMockViewer({
        getSearchableContent: vi.fn().mockReturnValue(createMockClusters()),
        highlightClustersWithWord: vi.fn().mockReturnValue([]), // No matches
      });
      panel = new WordFrequencyPanel({ container, sourceSelect }, viewer);
      panel.render();

      const row = container.querySelector('.word-freq-row') as HTMLElement;
      row?.click();

      // Should not be active because no clusters matched
      expect(row?.classList.contains('active')).toBe(false);
    });
  });

  describe('clearHighlights', () => {
    it('clears all highlights from viewer', () => {
      panel.clearHighlights();
      expect(viewer.clearAllHighlights).toHaveBeenCalled();
    });

    it('removes active class from all rows', () => {
      panel.render();
      const row = container.querySelector('.word-freq-row') as HTMLElement;
      row?.click(); // Highlight

      panel.clearHighlights();

      expect(row?.classList.contains('active')).toBe(false);
    });
  });

  describe('dispose', () => {
    it('removes event listener from source select', () => {
      const removeEventListenerSpy = vi.spyOn(sourceSelect, 'removeEventListener');
      panel.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('clears highlights on dispose', () => {
      panel.dispose();
      expect(viewer.clearAllHighlights).toHaveBeenCalled();
    });
  });
});

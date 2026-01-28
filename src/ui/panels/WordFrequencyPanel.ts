/**
 * Word Frequency Panel - displays top words with highlighting
 */

import { escapeHtml } from '../../export';
import { t } from '../../i18n';
import type { ViewerInterface, SearchableCluster } from '../types';

/**
 * DOM elements required by WordFrequencyPanel
 */
export interface WordFrequencyPanelElements {
  container: HTMLElement;
  sourceSelect?: HTMLSelectElement | null;
}

/**
 * Word frequency source options
 */
export type WordFrequencySource = 'all' | 'user' | 'assistant' | 'thinking';

// Color palette for word highlighting (10 distinct colors)
const WORD_HIGHLIGHT_COLORS = [
  0xe6194b, // red
  0x3cb44b, // green
  0xffe119, // yellow
  0x4363d8, // blue
  0xf58231, // orange
  0x911eb4, // purple
  0x42d4f4, // cyan
  0xf032e6, // magenta
  0xbfef45, // lime
  0xfabed4, // pink
];

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
  'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
  'if', 'else', 'while', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'once', 'any', 'your',
  'my', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them', 'myself', 'yourself',
  'himself', 'herself', 'itself', 'ourselves', 'themselves', 'am', 'being', 'having',
  'doing', 'because', 'until', 'against', 'up', 'down', 'out', 'off', 'over', 'under',
  'let', 'make', 'like', 'get', 'got', 'go', 'going', 'know', 'see', 'think', 'want',
  'use', 'using', 'file', 'files', 'code', 'one', 'two', 'first', 'new', 'way',
]);

/**
 * Extract words from text and count frequencies
 */
export function extractWords(text: string): Map<string, number> {
  const words = new Map<string, number>();

  // Split on non-word characters, filter, and count
  const tokens = text.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));

  for (const word of tokens) {
    words.set(word, (words.get(word) || 0) + 1);
  }

  return words;
}

/**
 * Get word frequencies from searchable content
 */
export function getWordFrequencies(
  searchableContent: SearchableCluster[],
  source: WordFrequencySource
): Array<{ word: string; count: number }> {
  const allWords = new Map<string, number>();

  for (const cluster of searchableContent) {
    const textsToAnalyze: string[] = [];

    if (source === 'all' || source === 'user') {
      if (cluster.userText) textsToAnalyze.push(cluster.userText);
    }

    if (source === 'all' || source === 'assistant') {
      if (cluster.assistantText) textsToAnalyze.push(cluster.assistantText);
    }

    if (source === 'all' || source === 'thinking') {
      textsToAnalyze.push(...cluster.thinkingBlocks.map(t => t.text));
    }

    // Extract and merge word counts
    for (const text of textsToAnalyze) {
      const words = extractWords(text);
      for (const [word, count] of words) {
        allWords.set(word, (allWords.get(word) || 0) + count);
      }
    }
  }

  // Sort by count and return top 10
  return Array.from(allWords.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Convert hex color to CSS string
 */
export function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/**
 * Get highlight color for a given index
 */
export function getHighlightColor(index: number): number {
  return WORD_HIGHLIGHT_COLORS[index % WORD_HIGHLIGHT_COLORS.length];
}

/**
 * WordFrequencyPanel manages the word frequency chart in the sidebar
 */
export class WordFrequencyPanel {
  private viewer: ViewerInterface;
  private container: HTMLElement;
  private sourceSelect: HTMLSelectElement | null;
  private highlightedWords = new Map<string, number>(); // word -> color
  private disposed = false;

  // Bound event handler for cleanup
  private handleSourceChange: () => void;

  constructor(elements: WordFrequencyPanelElements, viewer: ViewerInterface) {
    this.viewer = viewer;
    this.container = elements.container;
    this.sourceSelect = elements.sourceSelect ?? null;

    // Bind event handlers
    this.handleSourceChange = this.render.bind(this);

    // Wire up source selector
    this.sourceSelect?.addEventListener('change', this.handleSourceChange);
  }

  /**
   * Render the word frequency chart
   */
  public render(): void {
    if (this.disposed) return;

    // Clear highlights when re-rendering (source changed)
    this.clearHighlights();

    const source = (this.sourceSelect?.value || 'all') as WordFrequencySource;
    const searchableContent = this.viewer.getSearchableContent();
    const frequencies = getWordFrequencies(searchableContent, source);

    if (frequencies.length === 0) {
      this.container.innerHTML = `<div style="color: #666; font-size: 11px; text-align: center; padding: 20px;">${escapeHtml(t('sidebar.noWordsFound'))}</div>`;
      return;
    }

    const maxCount = frequencies[0].count;

    const html = frequencies.map(({ word, count }, index) => {
      const percentage = (count / maxCount) * 100;
      const color = getHighlightColor(index);
      const colorCSS = hexToCSS(color);
      const isActive = this.highlightedWords.has(word);

      return `
        <div class="word-freq-row ${isActive ? 'active' : ''}" data-word="${escapeHtml(word)}" data-color-index="${index}">
          <span class="word-freq-color" style="background: ${colorCSS}"></span>
          <span class="word-freq-label" title="${escapeHtml(word)}">${escapeHtml(word)}</span>
          <div class="word-freq-bar-container">
            <div class="word-freq-bar" style="width: ${percentage}%; background: ${colorCSS}"></div>
          </div>
          <span class="word-freq-count">${count}</span>
        </div>
      `;
    }).join('');

    this.container.innerHTML = html;

    // Wire up click handlers
    this.container.querySelectorAll('.word-freq-row').forEach((row) => {
      row.addEventListener('click', () => {
        const word = (row as HTMLElement).dataset.word;
        const colorIndex = parseInt((row as HTMLElement).dataset.colorIndex || '0', 10);
        if (word) {
          this.toggleWordHighlight(word, colorIndex);
        }
      });
    });
  }

  /**
   * Toggle word highlight on/off
   */
  public toggleWordHighlight(word: string, colorIndex: number): void {
    const color = getHighlightColor(colorIndex);

    if (this.highlightedWords.has(word)) {
      // Unhighlight
      this.viewer.unhighlightClustersByColor(this.highlightedWords.get(word)!);
      this.highlightedWords.delete(word);
    } else {
      // Highlight
      const matchedClusters = this.viewer.highlightClustersWithWord(word, color);
      if (matchedClusters.length > 0) {
        this.highlightedWords.set(word, color);
      }
    }

    // Update UI to reflect active state
    this.updateActiveStates();
  }

  /**
   * Clear all word highlights
   */
  public clearHighlights(): void {
    this.viewer.clearAllHighlights();
    this.highlightedWords.clear();
    this.updateActiveStates();
  }

  /**
   * Update active states on word frequency rows
   */
  private updateActiveStates(): void {
    this.container.querySelectorAll('.word-freq-row').forEach((row) => {
      const word = (row as HTMLElement).dataset.word;
      if (word && this.highlightedWords.has(word)) {
        row.classList.add('active');
      } else {
        row.classList.remove('active');
      }
    });
  }

  /**
   * Clean up event listeners
   */
  public dispose(): void {
    this.disposed = true;
    this.sourceSelect?.removeEventListener('change', this.handleSourceChange);
    this.clearHighlights();
  }
}

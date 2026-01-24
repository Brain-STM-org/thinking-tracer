/**
 * SearchController
 *
 * Handles all search functionality including:
 * - Search input and filtering
 * - Results display and navigation
 * - Regex mode toggle
 * - Keyboard shortcuts
 * - Cluster highlighting
 */

import {
  isValidRegex,
  highlightSnippet,
  performSearch,
  getMatchingClusters,
  getNextResultIndex,
  getPrevResultIndex,
  formatResultCount,
  type SearchResult,
  type SearchContentType,
} from '../../search';
import { DEFAULT_TIMING_CONFIG, DEFAULT_THEME_CONFIG } from '../../config';
import type { SearchableCluster } from '../types';

/**
 * Extended viewer interface for search operations
 */
export interface SearchableViewer {
  getClusterCount(): number;
  getSearchableContent(): SearchableCluster[];
  selectClusterByIndex(index: number): void;
  setSearchFilter(clusterIndices: number[] | null): void;
  highlightCluster(clusterIndex: number, color: number): void;
  unhighlightCluster(clusterIndex: number): void;
}

/**
 * Interface for conversation panel filtering
 */
export interface FilterablePanel {
  filter(clusterIndices: number[] | null): void;
}

/**
 * DOM elements required by SearchController
 */
export interface SearchControllerElements {
  /** Search input field */
  input: HTMLInputElement;
  /** Results count display */
  resultsCount?: HTMLElement | null;
  /** Results list container */
  resultsList?: HTMLElement | null;
  /** Previous result button */
  prevBtn?: HTMLElement | null;
  /** Next result button */
  nextBtn?: HTMLElement | null;
  /** Clear search button */
  clearBtn?: HTMLElement | null;
  /** Regex mode toggle button */
  regexToggle?: HTMLElement | null;
  /** Filter checkboxes container (or document to query) */
  filtersContainer?: HTMLElement | Document;
}

/**
 * SearchController options
 */
export interface SearchControllerOptions {
  elements: SearchControllerElements;
  viewer: SearchableViewer;
  conversationPanel?: FilterablePanel | null;
  /** Callback when search state changes */
  onSearchChange?: (hasResults: boolean, query: string) => void;
  /** Check if sidebar is visible (for keyboard shortcut) */
  isSidebarVisible?: () => boolean;
}

export class SearchController {
  private elements: SearchControllerElements;
  private viewer: SearchableViewer;
  private conversationPanel: FilterablePanel | null;
  private onSearchChange?: (hasResults: boolean, query: string) => void;
  private isSidebarVisible: () => boolean;

  // State
  private searchResults: SearchResult[] = [];
  private currentSearchIndex = -1;
  private regexMode = false;
  private highlightedClusters: number[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  // Config values
  private readonly searchHighlightColor = DEFAULT_THEME_CONFIG.highlight.searchColor;
  private readonly debounceDelay = DEFAULT_TIMING_CONFIG.debounce.search;

  // Bound event handlers for cleanup
  private boundHandleInput: () => void;
  private boundHandleInputKeydown: (e: KeyboardEvent) => void;
  private boundHandlePrev: () => void;
  private boundHandleNext: () => void;
  private boundHandleClear: () => void;
  private boundHandleRegexToggle: () => void;
  private boundHandleFilterChange: () => void;
  private boundHandleGlobalKeydown: (e: KeyboardEvent) => void;

  constructor(options: SearchControllerOptions) {
    this.elements = options.elements;
    this.viewer = options.viewer;
    this.conversationPanel = options.conversationPanel ?? null;
    this.onSearchChange = options.onSearchChange;
    this.isSidebarVisible = options.isSidebarVisible ?? (() => true);

    // Bind handlers
    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleInputKeydown = this.handleInputKeydown.bind(this);
    this.boundHandlePrev = this.navigatePrev.bind(this);
    this.boundHandleNext = this.navigateNext.bind(this);
    this.boundHandleClear = this.clear.bind(this);
    this.boundHandleRegexToggle = this.toggleRegexMode.bind(this);
    this.boundHandleFilterChange = this.handleInput.bind(this);
    this.boundHandleGlobalKeydown = this.handleGlobalKeydown.bind(this);

    this.attachListeners();
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    const { input, prevBtn, nextBtn, clearBtn, regexToggle, filtersContainer } = this.elements;

    // Input listeners
    input.addEventListener('input', this.boundHandleInput);
    input.addEventListener('keydown', this.boundHandleInputKeydown);

    // Button listeners
    prevBtn?.addEventListener('click', this.boundHandlePrev);
    nextBtn?.addEventListener('click', this.boundHandleNext);
    clearBtn?.addEventListener('click', this.boundHandleClear);
    regexToggle?.addEventListener('click', this.boundHandleRegexToggle);

    // Filter checkbox listeners
    const container = filtersContainer ?? document;
    container.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', this.boundHandleFilterChange);
    });

    // Global keyboard shortcut
    window.addEventListener('keydown', this.boundHandleGlobalKeydown);
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    const { input, prevBtn, nextBtn, clearBtn, regexToggle, filtersContainer } = this.elements;

    input.removeEventListener('input', this.boundHandleInput);
    input.removeEventListener('keydown', this.boundHandleInputKeydown);

    prevBtn?.removeEventListener('click', this.boundHandlePrev);
    nextBtn?.removeEventListener('click', this.boundHandleNext);
    clearBtn?.removeEventListener('click', this.boundHandleClear);
    regexToggle?.removeEventListener('click', this.boundHandleRegexToggle);

    const container = filtersContainer ?? document;
    container.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
      checkbox.removeEventListener('change', this.boundHandleFilterChange);
    });

    window.removeEventListener('keydown', this.boundHandleGlobalKeydown);
  }

  /**
   * Handle search input (debounced)
   */
  private handleInput(): void {
    if (this.disposed) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.executeSearch();
    }, this.debounceDelay);
  }

  /**
   * Execute the actual search
   */
  private executeSearch(): void {
    if (this.disposed) return;

    const query = this.elements.input.value;

    // Update regex error styling
    if (this.regexMode && query && !isValidRegex(query)) {
      this.elements.input.classList.add('regex-error');
    } else {
      this.elements.input.classList.remove('regex-error');
    }

    // Run search
    const clusters = this.viewer.getSearchableContent();
    const filters = this.getFilters();
    this.searchResults = performSearch(clusters, query, { useRegex: this.regexMode, filters });
    this.currentSearchIndex = this.searchResults.length > 0 ? 0 : -1;

    // Clear previous highlights
    this.clearHighlights();

    // Apply filter and highlights
    if (this.searchResults.length > 0) {
      const matchingClusters = getMatchingClusters(this.searchResults);
      this.viewer.setSearchFilter(matchingClusters);
      this.conversationPanel?.filter(matchingClusters);

      // Highlight matching clusters
      for (const clusterIndex of matchingClusters) {
        this.viewer.highlightCluster(clusterIndex, this.searchHighlightColor);
        this.highlightedClusters.push(clusterIndex);
      }
    } else {
      this.viewer.setSearchFilter(null);
      this.conversationPanel?.filter(null);
    }

    // Render results
    this.renderResults();

    // Navigate to first result
    if (this.searchResults.length > 0) {
      this.navigateToResult(0);
    } else {
      this.updateUI();
    }

    // Notify callback
    this.onSearchChange?.(this.searchResults.length > 0, query);
  }

  /**
   * Get enabled search filters from checkboxes
   */
  private getFilters(): Set<SearchContentType> {
    const filters = new Set<SearchContentType>();
    const container = this.elements.filtersContainer ?? document;

    container.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      if (input.checked && input.dataset.type) {
        filters.add(input.dataset.type as SearchContentType);
      }
    });

    return filters;
  }

  /**
   * Clear search highlights from viewer
   */
  private clearHighlights(): void {
    for (const clusterIndex of this.highlightedClusters) {
      this.viewer.unhighlightCluster(clusterIndex);
    }
    this.highlightedClusters = [];
  }

  /**
   * Handle keyboard events on the input
   */
  private handleInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        this.navigatePrev();
      } else {
        this.navigateNext();
      }
    } else if (e.key === 'Escape') {
      this.clear();
      this.elements.input.blur();
    }
  }

  /**
   * Handle global keyboard shortcuts
   */
  private handleGlobalKeydown(e: KeyboardEvent): void {
    // Don't trigger if in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // / - Focus search (when sidebar visible)
    if (e.key === '/' && this.isSidebarVisible()) {
      e.preventDefault();
      this.elements.input.focus();
      this.elements.input.select();
    }
  }

  /**
   * Render search results list
   */
  private renderResults(): void {
    const { resultsList } = this.elements;
    if (!resultsList) return;

    if (this.searchResults.length === 0) {
      resultsList.classList.remove('has-results');
      resultsList.innerHTML = '';
      return;
    }

    resultsList.classList.add('has-results');

    const query = this.elements.input.value;
    const clusterCount = this.viewer.getClusterCount();

    const html = this.searchResults.map((result, index) => {
      const isActive = index === this.currentSearchIndex;
      const typeLabel = result.type.replace('_', ' ');

      return `
        <div class="search-result-item ${result.type} ${isActive ? 'active' : ''}" data-index="${index}">
          <div class="search-result-meta">
            <span class="search-result-type ${result.type}">${typeLabel}</span>
            <span class="search-result-turn">Turn ${result.clusterIndex + 1}/${clusterCount}</span>
          </div>
          <div class="search-result-snippet">${highlightSnippet(result.text, query, this.regexMode)}</div>
        </div>
      `;
    }).join('');

    resultsList.innerHTML = html;

    // Wire up click handlers using event delegation
    resultsList.onclick = (e) => {
      const item = (e.target as HTMLElement).closest('.search-result-item');
      if (item) {
        const index = parseInt((item as HTMLElement).dataset.index || '0', 10);
        this.navigateToResult(index);
      }
    };

    // Scroll active item into view
    const activeItem = resultsList.querySelector('.search-result-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Update UI elements (count, button states, active item)
   */
  private updateUI(): void {
    const { resultsCount, prevBtn, nextBtn, resultsList } = this.elements;

    // Update count
    const query = this.elements.input.value;
    if (resultsCount) {
      resultsCount.textContent = formatResultCount(this.currentSearchIndex, this.searchResults.length, !!query);
    }

    // Update button states
    const hasResults = this.searchResults.length > 0;
    if (prevBtn) (prevBtn as HTMLButtonElement).disabled = !hasResults;
    if (nextBtn) (nextBtn as HTMLButtonElement).disabled = !hasResults;

    // Update active item in list
    if (resultsList) {
      resultsList.querySelectorAll('.search-result-item').forEach((item, index) => {
        if (index === this.currentSearchIndex) {
          item.classList.add('active');
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.classList.remove('active');
        }
      });
    }
  }

  /**
   * Navigate to a specific result
   */
  private navigateToResult(index: number): void {
    if (index < 0 || index >= this.searchResults.length) return;

    this.currentSearchIndex = index;
    const result = this.searchResults[index];

    // Select the cluster in the viewer
    this.viewer.selectClusterByIndex(result.clusterIndex);

    this.updateUI();
  }

  /**
   * Navigate to next result
   */
  public navigateNext(): void {
    const nextIndex = getNextResultIndex(this.currentSearchIndex, this.searchResults.length);
    if (nextIndex >= 0) this.navigateToResult(nextIndex);
  }

  /**
   * Navigate to previous result
   */
  public navigatePrev(): void {
    const prevIndex = getPrevResultIndex(this.currentSearchIndex, this.searchResults.length);
    if (prevIndex >= 0) this.navigateToResult(prevIndex);
  }

  /**
   * Toggle regex mode
   */
  private toggleRegexMode(): void {
    this.regexMode = !this.regexMode;
    this.elements.regexToggle?.classList.toggle('active', this.regexMode);

    // Update placeholder
    this.elements.input.placeholder = this.regexMode ? 'Regex search... (/)' : 'Search... (/)';

    // Re-run search
    this.handleInput();
  }

  /**
   * Clear search
   */
  public clear(): void {
    this.elements.input.value = '';
    this.elements.input.classList.remove('regex-error');
    this.searchResults = [];
    this.currentSearchIndex = -1;

    // Clear highlights
    this.clearHighlights();

    // Clear filters
    this.viewer.setSearchFilter(null);
    this.conversationPanel?.filter(null);

    this.renderResults();
    this.updateUI();

    this.onSearchChange?.(false, '');
  }

  /**
   * Get current search state
   */
  public getState(): { query: string; regexMode: boolean; resultCount: number } {
    return {
      query: this.elements.input.value,
      regexMode: this.regexMode,
      resultCount: this.searchResults.length,
    };
  }

  /**
   * Check if there are active search results
   */
  public hasResults(): boolean {
    return this.searchResults.length > 0;
  }

  /**
   * Dispose of the controller and clean up listeners
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clear highlights
    this.clearHighlights();

    // Remove all listeners
    this.detachListeners();
  }
}

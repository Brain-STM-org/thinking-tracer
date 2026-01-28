/**
 * RecentTracesManager - manages recent traces display and interactions
 */

import {
  saveRecentTrace,
  getRecentTraces,
  deleteRecentTrace,
  clearRecentTraces,
  updateTraceCustomName,
  updateTraceUIState,
  formatSize,
  formatRelativeTime,
  type RecentTrace,
  type TraceUIState,
} from '../../utils/recent-traces';
import { escapeHtml } from '../../export';
import { t } from '../../i18n';

/**
 * Example trace definition (hardcoded, not stored)
 */
export interface ExampleTrace {
  id: string;
  name: string;
  description: string;
  url: string;
  filename: string;
  turnCount: number;
  clusterCount: number;
  size: number;
}

/**
 * Built-in example traces
 */
const EXAMPLE_TRACES: ExampleTrace[] = [
  {
    id: 'example-thinking-tracer',
    name: 'Thinking Tracer',
    description: 'See how this app was built with Claude',
    url: 'samples/sample-trace.jsonl.zstd',
    filename: 'sample-trace.jsonl.zstd',
    turnCount: 3653,
    clusterCount: 120,
    size: 1531184,
  },
  {
    id: 'example-vegan-mapo-tofu',
    name: 'Vegan Mapo Tofu',
    description: 'Recipe development conversation',
    url: 'samples/vegan-mapo-tofu.jsonl',
    filename: 'vegan-mapo-tofu.jsonl',
    turnCount: 149,
    clusterCount: 5,
    size: 480012,
  },
];

/**
 * Callback for when a recent trace is selected
 */
export type RecentTraceSelectCallback = (trace: RecentTrace) => Promise<void>;

/**
 * Callback for when an example trace is selected
 */
export type ExampleTraceSelectCallback = (example: ExampleTrace) => Promise<void>;

/**
 * Options for RecentTracesManager
 */
export interface RecentTracesManagerOptions {
  /** Container for the recent traces section */
  container: HTMLElement | null;
  /** List element for trace items */
  listElement: HTMLElement | null;
  /** Clear all button */
  clearBtn: HTMLElement | null;
  /** Callback when a trace is selected */
  onSelect: RecentTraceSelectCallback;
  /** Callback when an example trace is selected */
  onSelectExample?: ExampleTraceSelectCallback;
}

/**
 * RecentTracesManager handles the recent traces UI
 */
export class RecentTracesManager {
  private container: HTMLElement | null;
  private listElement: HTMLElement | null;
  private clearBtn: HTMLElement | null;
  private onSelect: RecentTraceSelectCallback;
  private onSelectExample: ExampleTraceSelectCallback | null;
  private traces: RecentTrace[] = [];
  private disposed = false;

  // Bound event handlers for cleanup
  private boundHandleClearClick: () => void;

  constructor(options: RecentTracesManagerOptions) {
    this.container = options.container;
    this.listElement = options.listElement;
    this.clearBtn = options.clearBtn;
    this.onSelect = options.onSelect;
    this.onSelectExample = options.onSelectExample || null;

    // Bind handlers
    this.boundHandleClearClick = this.handleClearClick.bind(this);

    this.attachListeners();
  }

  /**
   * Attach main event listeners
   */
  private attachListeners(): void {
    this.clearBtn?.addEventListener('click', this.boundHandleClearClick);
  }

  /**
   * Remove main event listeners
   */
  private detachListeners(): void {
    this.clearBtn?.removeEventListener('click', this.boundHandleClearClick);
  }

  /**
   * Handle clear button click
   */
  private async handleClearClick(): Promise<void> {
    if (this.disposed) return;
    if (confirm(t('misc.clearConfirm'))) {
      await this.clearAll();
    }
  }

  /**
   * Refresh the recent traces list from storage
   */
  public async refresh(): Promise<void> {
    if (this.disposed || !this.container || !this.listElement) return;

    try {
      this.traces = await getRecentTraces();

      // Always show container - we have examples even if no user traces
      this.container.classList.remove('hidden');
      this.render();
    } catch (err) {
      console.warn('Failed to load recent traces:', err);
      // Still show examples on error
      this.traces = [];
      this.container.classList.remove('hidden');
      this.render();
    }
  }

  /**
   * Render the traces list
   */
  private render(): void {
    if (!this.listElement) return;

    let html = '';

    // Render user traces if any
    if (this.traces.length > 0) {
      html += this.traces.map((trace) => this.renderItem(trace)).join('');
    }

    // Render example traces section
    html += this.renderExamples();

    this.listElement.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Render example traces section
   */
  private renderExamples(): string {
    let html = '<div class="example-traces-section">';
    html += `<div class="example-traces-header">${escapeHtml(t('landing.exampleTraces'))}</div>`;
    html += EXAMPLE_TRACES.map((example) => this.renderExampleItem(example)).join('');
    html += '</div>';
    return html;
  }

  /**
   * Render a single example trace item
   */
  private renderExampleItem(example: ExampleTrace): string {
    return `
      <div class="recent-item example-item" data-example-id="${example.id}">
        <div class="recent-item-icon">📘</div>
        <div class="recent-item-info">
          <div class="recent-item-title example">${escapeHtml(example.name)}</div>
          <div class="recent-item-path">${escapeHtml(example.description)}</div>
          <div class="recent-item-meta">
            ${t('recent.turns', { count: example.turnCount })} · ${t('recent.clusters', { count: example.clusterCount })} · ${formatSize(example.size)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render a single trace item
   */
  private renderItem(trace: RecentTrace): string {
    const displayName = trace.customName || trace.title;
    const hasCustomName = !!trace.customName;

    // Shorten path for display, show full in tooltip
    const shortPath = trace.filename.length > 50
      ? '...' + trace.filename.slice(-47)
      : trace.filename;

    return `
      <div class="recent-item" data-id="${trace.id}">
        <div class="recent-item-icon">📄</div>
        <div class="recent-item-info">
          <div class="recent-item-title ${hasCustomName ? 'custom' : ''}">${escapeHtml(displayName)}</div>
          <div class="recent-item-path" title="${escapeHtml(trace.filename)}">${escapeHtml(shortPath)}</div>
          <div class="recent-item-meta">
            ${t('recent.turns', { count: trace.turnCount })} · ${formatSize(trace.size)} · ${formatRelativeTime(trace.lastOpened)}
          </div>
        </div>
        <button class="recent-item-delete" title="${escapeHtml(t('misc.removeFromHistory'))}">&times;</button>
      </div>
    `;
  }

  /**
   * Attach event listeners to trace items
   */
  private attachEventListeners(): void {
    if (!this.listElement) return;

    // Attach listeners to user traces
    this.listElement.querySelectorAll('.recent-item:not(.example-item)').forEach((item, index) => {
      const trace = this.traces[index];
      if (!trace) return;

      item.addEventListener('click', (e) => {
        // Don't trigger if clicking delete button
        if ((e.target as HTMLElement).closest('.recent-item-delete')) return;
        this.onSelect(trace);
      });

      const deleteBtn = item.querySelector('.recent-item-delete');
      deleteBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteTrace(trace.id);
      });
    });

    // Attach listeners to example traces
    this.listElement.querySelectorAll('.example-item').forEach((item) => {
      const exampleId = (item as HTMLElement).dataset.exampleId;
      const example = EXAMPLE_TRACES.find(e => e.id === exampleId);
      if (!example) return;

      item.addEventListener('click', () => {
        if (this.onSelectExample) {
          this.onSelectExample(example);
        }
      });
    });
  }

  /**
   * Delete a trace and refresh the list
   */
  private async deleteTrace(traceId: string): Promise<void> {
    try {
      await deleteRecentTrace(traceId);
      await this.refresh();
    } catch (err) {
      console.warn('Failed to delete trace:', err);
    }
  }

  /**
   * Clear all traces
   */
  public async clearAll(): Promise<void> {
    try {
      await clearRecentTraces();
      await this.refresh();
    } catch (err) {
      console.warn('Failed to clear traces:', err);
    }
  }

  /**
   * Save a trace to recent history
   */
  public async saveTrace(
    filename: string,
    title: string,
    turnCount: number,
    content: string
  ): Promise<void> {
    try {
      await saveRecentTrace(filename, title, turnCount, content);
    } catch (err) {
      console.warn('Failed to save to recent traces:', err);
    }
  }

  /**
   * Update a trace's last opened time
   */
  public async touchTrace(trace: RecentTrace): Promise<void> {
    try {
      await saveRecentTrace(trace.filename, trace.title, trace.turnCount, trace.content);
    } catch (err) {
      console.warn('Failed to update recent trace:', err);
    }
  }

  /**
   * Update a trace's custom name
   */
  public async updateCustomName(traceId: string, customName: string): Promise<void> {
    try {
      await updateTraceCustomName(traceId, customName);
      await this.refresh();
    } catch (err) {
      console.warn('Failed to save custom name:', err);
    }
  }

  /**
   * Update a trace's UI state
   */
  public async updateUIState(traceId: string, uiState: TraceUIState): Promise<void> {
    try {
      await updateTraceUIState(traceId, uiState);
    } catch (err) {
      console.warn('Failed to save UI state:', err);
    }
  }

  /**
   * Get the number of stored traces
   */
  public getTraceCount(): number {
    return this.traces.length;
  }

  /**
   * Check if there are any traces
   */
  public hasTraces(): boolean {
    return this.traces.length > 0;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.disposed = true;
    this.detachListeners();
  }
}

// Re-export types for convenience
export type { RecentTrace, TraceUIState };

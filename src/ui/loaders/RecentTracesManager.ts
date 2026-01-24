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

/**
 * Callback for when a recent trace is selected
 */
export type RecentTraceSelectCallback = (trace: RecentTrace) => Promise<void>;

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
}

/**
 * RecentTracesManager handles the recent traces UI
 */
export class RecentTracesManager {
  private container: HTMLElement | null;
  private listElement: HTMLElement | null;
  private clearBtn: HTMLElement | null;
  private onSelect: RecentTraceSelectCallback;
  private traces: RecentTrace[] = [];
  private disposed = false;

  // Bound event handlers for cleanup
  private boundHandleClearClick: () => void;

  constructor(options: RecentTracesManagerOptions) {
    this.container = options.container;
    this.listElement = options.listElement;
    this.clearBtn = options.clearBtn;
    this.onSelect = options.onSelect;

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
    if (confirm('Clear all recent traces?')) {
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

      if (this.traces.length === 0) {
        this.container.classList.add('hidden');
        return;
      }

      this.container.classList.remove('hidden');
      this.render();
    } catch (err) {
      console.warn('Failed to load recent traces:', err);
      this.container.classList.add('hidden');
    }
  }

  /**
   * Render the traces list
   */
  private render(): void {
    if (!this.listElement) return;

    this.listElement.innerHTML = this.traces.map((trace) => this.renderItem(trace)).join('');
    this.attachEventListeners();
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
            ${trace.turnCount} turns · ${formatSize(trace.size)} · ${formatRelativeTime(trace.lastOpened)}
          </div>
        </div>
        <button class="recent-item-delete" title="Remove from history">&times;</button>
      </div>
    `;
  }

  /**
   * Attach event listeners to trace items
   */
  private attachEventListeners(): void {
    if (!this.listElement) return;

    this.listElement.querySelectorAll('.recent-item').forEach((item, index) => {
      const trace = this.traces[index];

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

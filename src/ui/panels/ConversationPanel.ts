/**
 * Conversation Panel - displays the conversation in a scrollable view
 */

import { escapeHtml, renderMarkdown } from '../../export';
import type { ViewerInterface } from '../types';

/**
 * DOM elements required by ConversationPanel
 */
export interface ConversationPanelElements {
  container: HTMLElement;
  turnIndicator?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

/**
 * Filter state for conversation content visibility
 */
export interface ConversationFilterState {
  user: boolean;
  output: boolean;
  thinking: boolean;
  tools: boolean;
}

/**
 * ConversationPanel manages the conversation view in the split pane
 */
export class ConversationPanel {
  private viewer: ViewerInterface;
  private container: HTMLElement;
  private turnIndicator: HTMLElement | null;
  private filtersContainer: HTMLElement | null;
  private disposed = false;

  // Scroll sync state
  private isScrollingProgrammatically = false;
  private selectionFromScroll = false;
  private scrollLockTimeout: ReturnType<typeof setTimeout> | null = null;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  // Filter state (default: user and output visible)
  private filterState: ConversationFilterState = {
    user: true,
    output: true,
    thinking: false,
    tools: false,
  };

  // Bound event handlers for cleanup
  private boundHandleScroll: () => void;
  private boundFilterHandlers: Map<Element, () => void> = new Map();
  private scrollListenerAttached = false;

  constructor(elements: ConversationPanelElements, viewer: ViewerInterface) {
    this.viewer = viewer;
    this.container = elements.container;
    this.turnIndicator = elements.turnIndicator ?? null;
    this.filtersContainer = elements.filtersContainer ?? null;

    // Bind event handlers
    this.boundHandleScroll = this.onScroll.bind(this);

    // Wire up filter toggles
    this.setupFilterToggles();
  }

  /**
   * Render the conversation
   */
  public render(): void {
    if (this.disposed) return;

    const conversation = this.viewer.getConversation();
    if (!conversation) {
      this.container.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">No conversation loaded</div>';
      return;
    }

    const clusterCount = this.viewer.getClusterCount();
    const searchableContent = this.viewer.getSearchableContent();

    let html = '';

    for (let i = 0; i < searchableContent.length; i++) {
      const cluster = searchableContent[i];

      html += `<div class="conv-turn" data-cluster-index="${i}">`;

      // Badges row (sidechain, agent, stop reason, error)
      const badges: string[] = [];
      if (cluster.isSidechain) badges.push('<span class="conv-badge sidechain">sidechain</span>');
      if (cluster.agentId) badges.push(`<span class="conv-badge agent">${escapeHtml(cluster.agentId)}</span>`);
      if (cluster.stopReason && cluster.stopReason !== 'end_turn') {
        badges.push(`<span class="conv-badge stop-reason">${escapeHtml(cluster.stopReason)}</span>`);
      }
      if (badges.length > 0) {
        html += `<div class="conv-badges">${badges.join('')}</div>`;
      }

      // Error banner
      if (cluster.hasError) {
        const errorText = cluster.error ? escapeHtml(cluster.error) : 'Error occurred';
        html += `<div class="conv-error-banner">${errorText}</div>`;
      }

      // User message
      if (cluster.userText) {
        const len = cluster.userText.length;
        const charCount = len > 200 ? `<span style="color: #666; font-weight: normal;">(${len.toLocaleString()} chars)</span>` : '';
        html += `<div class="conv-user expanded">
<div class="conv-user-header"><span class="arrow">▶</span><span>User</span>${charCount}</div>
<div class="conv-user-content"><div class="conv-content-wrap markdown-content">${renderMarkdown(cluster.userText)}<button class="conv-expand-btn">More</button></div></div>
</div>`;
      }

      // Assistant section
      html += `<div class="conv-assistant">`;

      // Thinking blocks (default collapsed)
      for (let t = 0; t < cluster.thinkingBlocks.length; t++) {
        const thinking = cluster.thinkingBlocks[t];
        html += `<div class="conv-thinking" data-thinking-index="${t}">
<div class="conv-thinking-header"><span class="arrow">▶</span><span>Thinking</span><span style="color: #666; font-weight: normal;">(${thinking.length.toLocaleString()} chars)</span></div>
<div class="conv-thinking-content"><div class="conv-content-wrap markdown-content">${renderMarkdown(thinking)}<button class="conv-expand-btn">More</button></div></div>
</div>`;
      }

      // Tool calls and results (interleaved, default collapsed)
      for (let t = 0; t < cluster.toolUses.length; t++) {
        const toolUse = cluster.toolUses[t];
        html += `<div class="conv-tool tool-use" data-tool-index="${t}">
<div class="conv-tool-header"><span class="arrow">▶</span><span class="conv-tool-name">${escapeHtml(toolUse.name)}</span></div>
<div class="conv-tool-content"><div class="conv-content-wrap">${escapeHtml(toolUse.input)}<button class="conv-expand-btn">More</button></div></div>
</div>`;

        // Matching tool result (if exists)
        if (t < cluster.toolResults.length) {
          const toolResult = cluster.toolResults[t];
          const isError = toolResult.isError;
          html += `<div class="conv-tool tool-result ${isError ? '' : 'success'}" data-result-index="${t}">
<div class="conv-tool-header"><span class="arrow">▶</span><span>${isError ? '✗ Error' : '✓ Result'}</span></div>
<div class="conv-tool-content"><div class="conv-content-wrap">${escapeHtml(toolResult.content)}<button class="conv-expand-btn">More</button></div></div>
</div>`;
        }
      }

      // Assistant text output
      if (cluster.assistantText) {
        const len = cluster.assistantText.length;
        const charCount = len > 200 ? `<span style="color: #666; font-weight: normal;">(${len.toLocaleString()} chars)</span>` : '';
        html += `<div class="conv-text expanded">
<div class="conv-text-header"><span class="arrow">▶</span><span>Output</span>${charCount}</div>
<div class="conv-text-content"><div class="conv-content-wrap markdown-content">${renderMarkdown(cluster.assistantText)}<button class="conv-expand-btn">More</button></div></div>
</div>`;
      }

      html += `</div>`; // close .conv-assistant
      html += `</div>`; // close .conv-turn
    }

    this.container.innerHTML = html;

    // Wire up collapsible sections
    this.setupCollapsibleSections();

    // Check which content wraps need truncation
    this.setupTruncation();

    // Wire up "More" buttons
    this.setupExpandButtons();

    // Wire up turn click handlers
    this.setupTurnClickHandlers();

    // Setup scroll sync
    this.setupScrollSync();

    // Update turn indicator
    if (this.turnIndicator) {
      this.turnIndicator.textContent = `${clusterCount} turns`;
    }

    // Apply visibility filters
    this.applyFilters();
  }

  /**
   * Filter conversation to show only specific clusters
   * Pass null to show all clusters
   */
  public filter(clusterIndices: number[] | null): void {
    const turns = this.container.querySelectorAll('.conv-turn');

    if (clusterIndices === null) {
      // Show all turns
      turns.forEach((turn) => {
        (turn as HTMLElement).style.display = '';
      });
    } else {
      // Show only matching turns
      const matchSet = new Set(clusterIndices);
      turns.forEach((turn) => {
        const idx = parseInt((turn as HTMLElement).dataset.clusterIndex || '0', 10);
        (turn as HTMLElement).style.display = matchSet.has(idx) ? '' : 'none';
      });
    }
  }

  /**
   * Scroll conversation to a specific cluster
   */
  public scrollToCluster(clusterIndex: number): void {
    // If selection came from conversation scroll, don't scroll back
    if (this.selectionFromScroll) {
      this.selectionFromScroll = false;
      return;
    }

    const turn = this.container.querySelector(`.conv-turn[data-cluster-index="${clusterIndex}"]`);
    if (turn) {
      // Lock scroll sync to prevent feedback loop
      this.isScrollingProgrammatically = true;

      // Clear any existing timeout
      if (this.scrollLockTimeout) clearTimeout(this.scrollLockTimeout);

      // Remove previous focus
      this.container.querySelectorAll('.conv-turn.focused').forEach((t) => t.classList.remove('focused'));
      // Add focus to current
      turn.classList.add('focused');
      // Smooth scroll into view
      turn.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Unlock after scroll animation completes
      this.scrollLockTimeout = setTimeout(() => {
        this.isScrollingProgrammatically = false;
      }, 600);
    }
  }

  /**
   * Get the current filter state
   */
  public getFilterState(): ConversationFilterState {
    return { ...this.filterState };
  }

  /**
   * Set filter state
   */
  public setFilterState(state: Partial<ConversationFilterState>): void {
    Object.assign(this.filterState, state);
    this.applyFilters();
    this.updateFilterButtons();
  }

  /**
   * Notify panel that a selection came from scrolling (to prevent scroll-back)
   */
  public markSelectionFromScroll(): void {
    this.selectionFromScroll = true;
  }

  /**
   * Clean up event listeners
   */
  public dispose(): void {
    this.disposed = true;

    // Remove scroll listener
    this.container.removeEventListener('scroll', this.boundHandleScroll);

    // Remove filter handlers
    for (const [btn, handler] of this.boundFilterHandlers) {
      btn.removeEventListener('click', handler);
    }
    this.boundFilterHandlers.clear();

    // Clear timeouts
    if (this.scrollLockTimeout) clearTimeout(this.scrollLockTimeout);
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
  }

  /**
   * Apply conversation filters to hide/show elements
   */
  private applyFilters(): void {
    // Apply visibility based on filter state
    this.container.querySelectorAll('.conv-user').forEach((el) => {
      (el as HTMLElement).style.display = this.filterState.user ? '' : 'none';
    });
    this.container.querySelectorAll('.conv-text').forEach((el) => {
      (el as HTMLElement).style.display = this.filterState.output ? '' : 'none';
    });
    this.container.querySelectorAll('.conv-thinking').forEach((el) => {
      (el as HTMLElement).style.display = this.filterState.thinking ? '' : 'none';
    });
    this.container.querySelectorAll('.conv-tool').forEach((el) => {
      (el as HTMLElement).style.display = this.filterState.tools ? '' : 'none';
    });
  }

  /**
   * Update filter button active states
   */
  private updateFilterButtons(): void {
    if (!this.filtersContainer) return;

    this.filtersContainer.querySelectorAll('.conv-filter').forEach((btn) => {
      const filter = (btn as HTMLElement).dataset.filter as keyof ConversationFilterState;
      if (filter) {
        btn.classList.toggle('active', this.filterState[filter]);
      }
    });
  }

  /**
   * Setup filter toggle buttons
   */
  private setupFilterToggles(): void {
    if (!this.filtersContainer) return;

    this.filtersContainer.querySelectorAll('.conv-filter').forEach((btn) => {
      const handler = () => {
        const filter = (btn as HTMLElement).dataset.filter as keyof ConversationFilterState;
        if (!filter) return;

        // Toggle filter state
        this.filterState[filter] = !this.filterState[filter];

        // Update button active state
        btn.classList.toggle('active', this.filterState[filter]);

        // Apply filters
        this.applyFilters();
      };

      btn.addEventListener('click', handler);
      this.boundFilterHandlers.set(btn, handler);
    });
  }

  /**
   * Setup collapsible section headers
   */
  private setupCollapsibleSections(): void {
    this.container.querySelectorAll('.conv-thinking-header, .conv-tool-header, .conv-user-header, .conv-text-header').forEach((header) => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = header.parentElement;
        parent?.classList.toggle('expanded');
      });
    });
  }

  /**
   * Setup content truncation
   */
  private setupTruncation(): void {
    this.container.querySelectorAll('.conv-content-wrap').forEach((wrap) => {
      const el = wrap as HTMLElement;
      // Temporarily apply max-height to measure overflow
      el.style.maxHeight = '120px';
      el.style.overflow = 'hidden';
      const needsTruncation = el.scrollHeight > el.clientHeight + 10;
      el.style.maxHeight = '';
      el.style.overflow = '';

      if (needsTruncation) {
        el.classList.add('needs-truncation');
      }
    });
  }

  /**
   * Setup "More" buttons for truncated content
   */
  private setupExpandButtons(): void {
    this.container.querySelectorAll('.conv-expand-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = btn.parentElement;
        wrap?.classList.remove('needs-truncation');
        wrap?.classList.add('full');
      });
    });
  }

  /**
   * Setup turn click handlers to select in 3D
   */
  private setupTurnClickHandlers(): void {
    this.container.querySelectorAll('.conv-turn').forEach((turn) => {
      turn.addEventListener('click', () => {
        const clusterIndex = parseInt((turn as HTMLElement).dataset.clusterIndex || '0', 10);

        // Lock scroll sync briefly since we're already at this turn
        this.isScrollingProgrammatically = true;
        if (this.scrollLockTimeout) clearTimeout(this.scrollLockTimeout);

        // Highlight this turn
        this.container.querySelectorAll('.conv-turn.focused').forEach((t) => t.classList.remove('focused'));
        turn.classList.add('focused');

        // Select in 3D (this will try to scroll back to us, but we're locked)
        this.viewer.selectClusterByIndex(clusterIndex);

        // Unlock after a short delay
        this.scrollLockTimeout = setTimeout(() => {
          this.isScrollingProgrammatically = false;
        }, 300);
      });
    });
  }

  /**
   * Setup scroll sync - scrolling conversation selects 3D node
   */
  private setupScrollSync(): void {
    // Only attach once since container is reused across renders
    if (this.scrollListenerAttached) return;
    this.scrollListenerAttached = true;
    this.container.addEventListener('scroll', this.boundHandleScroll);
  }

  /**
   * Handle scroll events for sync
   */
  private onScroll(): void {
    // Skip if we're programmatically scrolling (from 3D selection)
    if (this.isScrollingProgrammatically) {
      return;
    }

    // Debounce scroll handling
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      // Double-check we're not in programmatic scroll
      if (this.isScrollingProgrammatically) return;

      const turns = this.container.querySelectorAll('.conv-turn');
      const containerRect = this.container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 3; // Focus on upper third

      let closestTurn: Element | null = null;
      let closestDistance = Infinity;

      turns.forEach((turn) => {
        const rect = turn.getBoundingClientRect();
        const turnCenter = rect.top + rect.height / 2;
        const distance = Math.abs(turnCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestTurn = turn;
        }
      });

      if (closestTurn) {
        const clusterIndex = parseInt((closestTurn as HTMLElement).dataset.clusterIndex || '0', 10);
        // Mark that this selection came from conversation scroll - don't scroll back
        this.selectionFromScroll = true;
        this.viewer.selectClusterByIndex(clusterIndex);

        // Update focus highlight without scrolling
        this.container.querySelectorAll('.conv-turn.focused').forEach((t) => t.classList.remove('focused'));
        (closestTurn as Element).classList.add('focused');
      }
    }, 150);
  }
}

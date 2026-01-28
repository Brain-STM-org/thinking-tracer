/**
 * Conversation Panel - displays the conversation in a scrollable view
 */

import { escapeHtml, renderMarkdown } from '../../export';
import { getUIText } from '../../config';
import { t } from '../../i18n';
import type { ViewerInterface } from '../types';

/**
 * Format a duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return t('time.ms', { value: ms });
  } else if (ms < 60000) {
    const secs = ms / 1000;
    return t('time.seconds', { value: secs.toFixed(1) });
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return t('time.minutes', { minutes: mins, seconds: secs });
  }
}

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
  documents: boolean;
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
    documents: true,
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
      this.container.innerHTML = `<div style="color: #666; text-align: center; padding: 40px;">${escapeHtml(t('conversation.noConversation'))}</div>`;
      return;
    }

    const clusterCount = this.viewer.getClusterCount();
    const searchableContent = this.viewer.getSearchableContent();
    const sourceId = conversation.meta.source;

    let html = '';

    for (let i = 0; i < searchableContent.length; i++) {
      const cluster = searchableContent[i];

      html += `<div class="conv-turn" data-cluster-index="${cluster.clusterIndex}">`;

      // Badges row (sidechain, agent, stop reason, error)
      const badges: string[] = [];
      if (cluster.isSidechain) badges.push(`<span class="conv-badge sidechain">${escapeHtml(getUIText(sourceId, 'sidechainBadge'))}</span>`);
      if (cluster.agentId) badges.push(`<span class="conv-badge agent">${escapeHtml(cluster.agentId)}</span>`);
      if (cluster.stopReason && cluster.stopReason !== 'end_turn') {
        badges.push(`<span class="conv-badge stop-reason">${escapeHtml(cluster.stopReason)}</span>`);
      }
      if (badges.length > 0) {
        html += `<div class="conv-badges">${badges.join('')}</div>`;
      }

      // Error banner
      if (cluster.hasError) {
        const errorText = cluster.error ? escapeHtml(cluster.error) : escapeHtml(t('misc.errorOccurred'));
        html += `<div class="conv-error-banner">${errorText}</div>`;
      }

      // User message
      if (cluster.userText) {
        const len = cluster.userText.length;
        const charCount = len > 200 ? `<span style="color: #666; font-weight: normal;">(${t('conversation.chars', { count: len.toLocaleString() })})</span>` : '';
        html += `<div class="conv-user expanded">
<div class="conv-user-header"><span class="arrow">▶</span><span>${escapeHtml(t('conversation.userLabel'))}</span>${charCount}</div>
<div class="conv-user-content"><div class="conv-content-wrap markdown-content">${renderMarkdown(cluster.userText)}<button class="conv-expand-btn">${escapeHtml(t('conversation.more'))}</button></div></div>
</div>`;
      }

      // Assistant section
      html += `<div class="conv-assistant">`;

      // Thinking blocks (default collapsed)
      for (let ti = 0; ti < cluster.thinkingBlocks.length; ti++) {
        const thinking = cluster.thinkingBlocks[ti];
        const thinkingText = thinking.text;
        const durationStr = thinking.durationMs ? ` · ${formatDuration(thinking.durationMs)}` : '';
        html += `<div class="conv-thinking" data-thinking-index="${ti}">
<div class="conv-thinking-header"><span class="arrow">▶</span><span>${escapeHtml(t('conversation.thinkingLabel'))}</span><span style="color: #666; font-weight: normal;">(${t('conversation.chars', { count: thinkingText.length.toLocaleString() })}${durationStr})</span></div>
<div class="conv-thinking-content"><div class="conv-content-wrap markdown-content">${renderMarkdown(thinkingText)}<button class="conv-expand-btn">${escapeHtml(t('conversation.more'))}</button></div></div>
</div>`;
      }

      // Tool calls and results (interleaved, default collapsed)
      for (let ti = 0; ti < cluster.toolUses.length; ti++) {
        const toolUse = cluster.toolUses[ti];
        html += `<div class="conv-tool tool-use" data-tool-index="${ti}">
<div class="conv-tool-header"><span class="arrow">▶</span><span class="conv-tool-name">${escapeHtml(toolUse.name)}</span></div>
<div class="conv-tool-content"><div class="conv-content-wrap">${escapeHtml(toolUse.input)}<button class="conv-expand-btn">${escapeHtml(t('conversation.more'))}</button></div></div>
</div>`;

        // Matching tool result (if exists)
        if (ti < cluster.toolResults.length) {
          const toolResult = cluster.toolResults[ti];
          const isError = toolResult.isError;
          const durationStr = toolResult.durationMs ? `<span style="color: #666; font-weight: normal; margin-left: 8px;">${formatDuration(toolResult.durationMs)}</span>` : '';
          html += `<div class="conv-tool tool-result ${isError ? '' : 'success'}" data-result-index="${ti}">
<div class="conv-tool-header"><span class="arrow">▶</span><span>${isError ? escapeHtml(t('conversation.resultError')) : escapeHtml(t('conversation.resultSuccess'))}</span>${durationStr}</div>
<div class="conv-tool-content"><div class="conv-content-wrap">${escapeHtml(toolResult.content)}<button class="conv-expand-btn">${escapeHtml(t('conversation.more'))}</button></div></div>
</div>`;
        }
      }

      // Documents (images, PDFs, etc.)
      for (let di = 0; di < cluster.documents.length; di++) {
        const doc = cluster.documents[di];
        const sizeStr = doc.size ? ` (${(doc.size / 1024).toFixed(1)} KB)` : '';
        const sourceLabel = doc.sourceType === 'url' ? t('document.sourceUrl') : doc.sourceType === 'file' ? t('document.sourceFile') : t('document.sourceBase64');
        // Determine display name based on media type
        let docLabel = t('document.label');
        const isImage = doc.mediaType.startsWith('image/');
        const isPdf = doc.mediaType === 'application/pdf';
        if (isImage) {
          docLabel = t('document.image');
        } else if (isPdf) {
          docLabel = t('document.pdf');
        } else if (doc.mediaType.startsWith('text/')) {
          docLabel = t('document.textFile');
        }
        const titleStr = doc.title ? ` "${escapeHtml(doc.title)}"` : '';

        // Build content for expansion
        let contentHtml = '';
        if (doc.data && isImage) {
          // Render image from base64
          contentHtml = `<img src="data:${doc.mediaType};base64,${doc.data}" alt="${escapeHtml(docLabel)}" style="max-width: 100%; max-height: 400px; border-radius: 4px;">`;
        } else if (doc.url && isImage) {
          // Render image from URL
          contentHtml = `<img src="${escapeHtml(doc.url)}" alt="${escapeHtml(docLabel)}" style="max-width: 100%; max-height: 400px; border-radius: 4px;">`;
        } else if (doc.url) {
          // Show link for other URL-based documents
          contentHtml = `<a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener" style="color: #f1c40f;">${escapeHtml(t('document.open', { type: docLabel }))}</a>`;
        } else if (doc.fileId) {
          // File API reference
          contentHtml = `<span style="color: #888;">${escapeHtml(t('document.fileId'))} ${escapeHtml(doc.fileId)}</span>`;
        } else if (doc.data && isPdf) {
          // PDF - show as embedded or download link
          contentHtml = `<a href="data:${doc.mediaType};base64,${doc.data}" download="document.pdf" style="color: #f1c40f;">${escapeHtml(t('document.downloadPdf'))}</a>`;
        } else if (doc.data) {
          // Other base64 data - show download link
          contentHtml = `<span style="color: #888;">${escapeHtml(t('document.base64Data', { size: ((doc.size || 0) / 1024).toFixed(1) }))}</span>`;
        } else {
          contentHtml = `<span style="color: #888;">${escapeHtml(t('document.noPreview'))}</span>`;
        }

        html += `<div class="conv-document" data-document-index="${di}">
<div class="conv-document-header"><span class="arrow">▶</span><span>${escapeHtml(docLabel)}</span><span style="color: #888; font-weight: normal; margin-left: 8px;">${escapeHtml(doc.mediaType)}${titleStr} · ${escapeHtml(sourceLabel)}${sizeStr}</span></div>
<div class="conv-document-content">${contentHtml}</div>
</div>`;
      }

      // Summary line with total thinking and tool time
      const totalThinkingMs = cluster.thinkingBlocks.reduce((sum, tb) => sum + (tb.durationMs || 0), 0);
      const totalToolMs = cluster.toolResults.reduce((sum, r) => sum + (r.durationMs || 0), 0);
      const totalChars = cluster.thinkingBlocks.reduce((sum, tb) => sum + tb.text.length, 0);
      if (cluster.thinkingBlocks.length > 0 || cluster.toolResults.length > 0) {
        const parts: string[] = [];
        if (cluster.thinkingBlocks.length > 0) {
          const thinkingStr = totalThinkingMs > 0
            ? t('conversation.thinkingSummary', { count: cluster.thinkingBlocks.length, chars: totalChars.toLocaleString(), duration: formatDuration(totalThinkingMs) })
            : t('conversation.thinkingSummaryNoTime', { count: cluster.thinkingBlocks.length, chars: totalChars.toLocaleString() });
          parts.push(thinkingStr);
        }
        if (cluster.toolResults.length > 0) {
          const toolStr = totalToolMs > 0
            ? t('conversation.toolsSummary', { count: cluster.toolResults.length, duration: formatDuration(totalToolMs) })
            : t('conversation.toolsSummaryNoTime', { count: cluster.toolResults.length });
          parts.push(toolStr);
        }
        html += `<div class="conv-summary" style="color: #888; font-size: 11px; margin-bottom: 8px; padding-left: 4px;">${escapeHtml(parts.join(' · '))}</div>`;
      }

      // Assistant text output
      if (cluster.assistantText) {
        const len = cluster.assistantText.length;
        const charCount = len > 200 ? `<span style="color: #666; font-weight: normal;">(${t('conversation.chars', { count: len.toLocaleString() })})</span>` : '';
        html += `<div class="conv-text expanded">
<div class="conv-text-header"><span class="arrow">▶</span><span>${escapeHtml(t('conversation.outputLabel'))}</span>${charCount}</div>
<div class="conv-text-content"><div class="conv-content-wrap markdown-content">${renderMarkdown(cluster.assistantText)}<button class="conv-expand-btn">${escapeHtml(t('conversation.more'))}</button></div></div>
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
      this.turnIndicator.textContent = t('conversation.turns', { count: clusterCount });
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
    this.container.querySelectorAll('.conv-document').forEach((el) => {
      (el as HTMLElement).style.display = this.filterState.documents ? '' : 'none';
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
    this.container.querySelectorAll('.conv-thinking-header, .conv-tool-header, .conv-user-header, .conv-text-header, .conv-document-header').forEach((header) => {
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

/**
 * Detail Panel - displays information about the selected node
 */

import { escapeHtml } from '../../export';
import { getUIText } from '../../config';
import { t } from '../../i18n';
import type { ViewerInterface, Selection, SearchableCluster } from '../types';

/**
 * DOM elements required by DetailPanel
 */
export interface DetailPanelElements {
  container: HTMLElement;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Build text content for a turn (for clipboard)
 */
export function buildTurnText(cluster: SearchableCluster, turnNumber: number): string {
  let text = `Turn ${turnNumber}\n${'='.repeat(40)}\n\n`;

  if (cluster.userText) {
    text += `USER:\n${cluster.userText}\n\n`;
  }

  if (cluster.thinkingBlocks.length > 0) {
    for (const thinking of cluster.thinkingBlocks) {
      text += `THINKING:\n${thinking.text}\n\n`;
    }
  }

  for (let i = 0; i < cluster.toolUses.length; i++) {
    const tool = cluster.toolUses[i];
    text += `TOOL (${tool.name}):\n${tool.input}\n\n`;
    if (cluster.toolResults[i]) {
      text += `RESULT:\n${cluster.toolResults[i].content}\n\n`;
    }
  }

  if (cluster.assistantText) {
    text += `ASSISTANT:\n${cluster.assistantText}\n`;
  }

  return text;
}

/**
 * DetailPanel displays information about the currently selected node
 */
export class DetailPanel {
  private viewer: ViewerInterface;
  private container: HTMLElement;
  private copyableContent: Record<string, string> = {};
  private disposed = false;
  private activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(elements: DetailPanelElements, viewer: ViewerInterface) {
    this.viewer = viewer;
    this.container = elements.container;
  }

  /**
   * Schedule a timeout and track it for cleanup
   */
  private scheduleTimeout(callback: () => void, delay: number): void {
    const timeoutId = setTimeout(() => {
      this.activeTimeouts.delete(timeoutId);
      if (!this.disposed) {
        callback();
      }
    }, delay);
    this.activeTimeouts.add(timeoutId);
  }

  /**
   * Clear all active timeouts
   */
  private clearTimeouts(): void {
    for (const timeoutId of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
  }

  /**
   * Update the panel with a new selection
   */
  public update(selection: Selection | null): void {
    if (this.disposed) return;

    // Clear any pending timeouts from previous render
    this.clearTimeouts();

    if (!selection) {
      this.container.innerHTML = `<div class="detail-empty">${escapeHtml(t('sidebar.noSelection'))}</div>`;
      return;
    }

    this.container.innerHTML = this.render(selection);
    this.wireUpEvents(selection);
  }

  /**
   * Clear the panel
   */
  public clear(): void {
    this.container.innerHTML = `<div class="detail-empty">${escapeHtml(t('sidebar.noSelection'))}</div>`;
    this.copyableContent = {};
  }

  /**
   * Clean up
   */
  public dispose(): void {
    this.disposed = true;
    this.clearTimeouts();
    this.copyableContent = {};
  }

  /**
   * Render detail panel content for a selection
   */
  private render(selection: Selection): string {
    const { type, data } = selection;

    // Reset copyable content
    this.copyableContent = {};

    let content = `<div class="detail-section">
    <div class="detail-section-label"><span>${escapeHtml(t('sidebar.type'))}</span></div>
    <div class="detail-section-content">
      <span class="detail-type-badge ${type}">${type.replace('_', ' ')}</span>
    </div>
  </div>`;

    // Add expand/collapse button for clusters
    if (type === 'cluster') {
      content += this.renderClusterDetails(data);
    } else if (selection.clusterIndex !== undefined) {
      // Child node of a cluster - show turn number and collapse option
      content += `<div class="detail-section">
      <div class="detail-section-label">${escapeHtml(t('sidebar.turn'))}</div>
      <div class="detail-section-content"><strong>${selection.clusterIndex + 1}</strong> ${escapeHtml(t('misc.of'))} ${this.viewer.getClusterCount()}</div>
    </div>`;
      content += `<div class="detail-section">
      <div class="detail-section-label">${escapeHtml(t('sidebar.actions'))}</div>
      <div class="detail-section-content">
        <button id="collapse-parent-btn" class="detail-action-btn" data-cluster-index="${selection.clusterIndex}">
          ${escapeHtml(t('sidebar.collapseTurn'))}
        </button>
      </div>
    </div>`;
    }

    // Type-specific content
    content += this.renderTypeSpecificContent(type, data);

    // Add raw data toggle
    const rawJson = JSON.stringify(data, null, 2);
    this.copyableContent['raw-data'] = rawJson;
    content += `<div class="detail-section">
    <div class="detail-section-label">
      <button id="toggle-raw-btn" class="raw-toggle-btn">${escapeHtml(t('sidebar.showRawData'))}</button>
      <button class="copy-btn" data-copy-id="raw-data" style="margin-left: 8px;">${escapeHtml(t('sidebar.copy'))}</button>
    </div>
    <div id="raw-data-content" class="detail-section-content code raw-data" style="display: none;">${escapeHtml(truncate(rawJson, 10000))}</div>
  </div>`;

    return content;
  }

  /**
   * Render cluster-specific details
   */
  private renderClusterDetails(data: unknown): string {
    const cluster = data as {
      expanded: boolean;
      index: number;
      thinkingCount: number;
      toolCount: number;
      isSidechain?: boolean;
      agentId?: string;
      hasError?: boolean;
      stopReason?: string;
      userTurn?: { content: Array<{ type: string; text?: string }>; thinkingMetadata?: { level?: string; disabled?: boolean; triggers?: string[] } };
      assistantTurn?: {
        content: Array<{
          type: string;
          text?: string;
          thinking?: string;
          name?: string;
          content?: string;
          is_error?: boolean;
        }>;
        error?: string;
        stopReason?: string;
      };
    };

    let content = `<div class="detail-section">
      <div class="detail-section-label">${escapeHtml(t('sidebar.turn'))}</div>
      <div class="detail-section-content"><strong>${cluster.index + 1}</strong> ${escapeHtml(t('misc.of'))} ${this.viewer.getClusterCount()}</div>
    </div>`;

    content += `<div class="detail-section">
      <div class="detail-section-label">${escapeHtml(t('sidebar.actions'))}</div>
      <div class="detail-section-content detail-actions">
        <button id="toggle-cluster-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="${cluster.expanded ? escapeHtml(t('detail.collapseToSingle')) : escapeHtml(t('detail.expandAll'))}">
          ${cluster.expanded ? escapeHtml(t('sidebar.collapse')) : escapeHtml(t('sidebar.expand'))}
        </button>
        <button id="focus-cluster-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="${escapeHtml(t('detail.centerCamera'))}">
          ${escapeHtml(t('sidebar.focus'))}
        </button>
        <button id="copy-turn-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="${escapeHtml(t('detail.copyContent'))}">
          ${escapeHtml(t('sidebar.copy'))}
        </button>
        <button id="prev-turn-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="${escapeHtml(t('detail.prevTurn'))}" ${cluster.index === 0 ? 'disabled' : ''}>
          ${escapeHtml(t('sidebar.prevTurn'))}
        </button>
        <button id="next-turn-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="${escapeHtml(t('detail.nextTurn'))}" ${cluster.index >= this.viewer.getClusterCount() - 1 ? 'disabled' : ''}>
          ${escapeHtml(t('sidebar.nextTurn'))}
        </button>
      </div>
    </div>`;

    // Metadata: error, sidechain, agent, stop reason, thinking
    if (cluster.hasError) {
      const errorText = cluster.assistantTurn?.error || t('misc.errorOccurred');
      content += `<div class="detail-section">
        <div class="detail-section-label">${escapeHtml(t('sidebar.error'))}</div>
        <div class="detail-section-content" style="color: #e74c3c;">${escapeHtml(errorText)}</div>
      </div>`;
    }

    if (cluster.isSidechain) {
      const sourceId = this.viewer.getConversation()?.meta.source;
      content += `<div class="detail-section">
        <div class="detail-section-label">${escapeHtml(getUIText(sourceId, 'sidechainLabel'))}</div>
        <div class="detail-section-content">${escapeHtml(getUIText(sourceId, 'sidechainDescription'))}</div>
      </div>`;
    }

    if (cluster.agentId) {
      content += `<div class="detail-section">
        <div class="detail-section-label">${escapeHtml(t('sidebar.agent'))}</div>
        <div class="detail-section-content">${escapeHtml(cluster.agentId)}</div>
      </div>`;
    }

    if (cluster.stopReason && cluster.stopReason !== 'end_turn') {
      content += `<div class="detail-section">
        <div class="detail-section-label">${escapeHtml(t('sidebar.stopReason'))}</div>
        <div class="detail-section-content">${escapeHtml(cluster.stopReason)}</div>
      </div>`;
    }

    if (cluster.userTurn?.thinkingMetadata) {
      const tm = cluster.userTurn.thinkingMetadata;
      const parts: string[] = [];
      if (tm.level) parts.push(`Level: ${tm.level}`);
      if (tm.disabled) parts.push('Disabled');
      if (tm.triggers?.length) parts.push(`Triggers: ${tm.triggers.join(', ')}`);
      if (parts.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">${escapeHtml(t('sidebar.thinkingConfig'))}</div>
          <div class="detail-section-content">${escapeHtml(parts.join(' | '))}</div>
        </div>`;
      }
    }

    // User message preview
    if (cluster.userTurn) {
      const userText = cluster.userTurn.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text || '')
        .join('\n');
      if (userText) {
        content += `<div class="detail-section">
          <div class="detail-section-label">${escapeHtml(t('sidebar.user'))}</div>
          <div class="detail-section-content">${escapeHtml(truncate(userText, 200))}</div>
        </div>`;
      }
    }

    // Assistant text preview
    if (cluster.assistantTurn) {
      const assistantText = cluster.assistantTurn.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text || '')
        .join('\n');
      if (assistantText) {
        content += `<div class="detail-section">
          <div class="detail-section-label">${escapeHtml(t('sidebar.assistant'))}</div>
          <div class="detail-section-content">${escapeHtml(truncate(assistantText, 200))}</div>
        </div>`;
      }

      // List thinking blocks
      const thinkingBlocks = cluster.assistantTurn.content.filter((b) => b.type === 'thinking');
      if (thinkingBlocks.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">${escapeHtml(t('sidebar.thinkingBlocks', { count: thinkingBlocks.length }))}</div>
          <div class="detail-section-content cluster-list">`;
        for (const block of thinkingBlocks) {
          const preview = truncate(block.thinking || '', 100);
          content += `<div class="cluster-list-item thinking">${escapeHtml(preview)}</div>`;
        }
        content += `</div></div>`;
      }

      // List tool calls
      const toolUses = cluster.assistantTurn.content.filter((b) => b.type === 'tool_use');
      if (toolUses.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">${escapeHtml(t('sidebar.toolCalls', { count: toolUses.length }))}</div>
          <div class="detail-section-content cluster-list">`;
        for (const block of toolUses) {
          content += `<div class="cluster-list-item tool_use">${escapeHtml(block.name || 'unknown')}</div>`;
        }
        content += `</div></div>`;
      }

      // List tool results
      const toolResults = cluster.assistantTurn.content.filter((b) => b.type === 'tool_result');
      if (toolResults.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">${escapeHtml(t('sidebar.toolResults', { count: toolResults.length }))}</div>
          <div class="detail-section-content cluster-list">`;
        for (const block of toolResults) {
          const status = block.is_error ? 'error' : 'success';
          const preview = truncate(String(block.content || ''), 80);
          content += `<div class="cluster-list-item tool_result ${status}">${escapeHtml(preview)}</div>`;
        }
        content += `</div></div>`;
      }
    }

    return content;
  }

  /**
   * Render type-specific content
   */
  private renderTypeSpecificContent(type: string, data: unknown): string {
    let content = '';

    if (type === 'user' || type === 'assistant') {
      const turn = data as {
        content: Array<{ type: string; text?: string; thinking?: string; name?: string }>;
      };

      // Show content block summary
      const blockTypes = turn.content.reduce(
        (acc, b) => {
          acc[b.type] = (acc[b.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const blockSummary = Object.entries(blockTypes)
        .map(([t, count]) => `${count} ${t}`)
        .join(', ');

      if (blockSummary) {
        content += `<div class="detail-section">
        <div class="detail-section-label">${escapeHtml(t('sidebar.contains'))}</div>
        <div class="detail-section-content">${escapeHtml(blockSummary)}</div>
      </div>`;
      }

      // Show text content if any
      const textBlocks = turn.content.filter((b) => b.type === 'text');
      if (textBlocks.length > 0) {
        const text = textBlocks.map((b) => b.text || '').join('\n\n');
        this.copyableContent['text'] = text;
        content += `<div class="detail-section">
        <div class="detail-section-label"><span>${escapeHtml(t('sidebar.text'))}</span><button class="copy-btn" data-copy-id="text">${escapeHtml(t('sidebar.copy'))}</button></div>
        <div class="detail-section-content">${escapeHtml(truncate(text, 1000))}</div>
      </div>`;
      }

      // Show thinking preview if any
      const thinkingBlocks = turn.content.filter((b) => b.type === 'thinking');
      if (thinkingBlocks.length > 0) {
        const thinking = thinkingBlocks.map((b) => b.thinking || '').join('\n\n');
        this.copyableContent['thinking'] = thinking;
        content += `<div class="detail-section">
        <div class="detail-section-label"><span>${escapeHtml(t('sidebar.thinking'))}</span><button class="copy-btn" data-copy-id="thinking">${escapeHtml(t('sidebar.copy'))}</button></div>
        <div class="detail-section-content code">${escapeHtml(truncate(thinking, 500))}</div>
      </div>`;
      }

      // Show tool calls if any
      const toolBlocks = turn.content.filter((b) => b.type === 'tool_use');
      if (toolBlocks.length > 0) {
        content += `<div class="detail-section">
        <div class="detail-section-label">Tools Used</div>
        <div class="detail-section-content">${toolBlocks.map((b) => escapeHtml(b.name || 'unknown')).join(', ')}</div>
      </div>`;
      }
    } else if (type === 'thinking') {
      const block = data as { thinking?: string };
      if (block.thinking) {
        this.copyableContent['thinking-block'] = block.thinking;
        content += `<div class="detail-section">
        <div class="detail-section-label"><span>${escapeHtml(t('sidebar.thinking'))}</span><button class="copy-btn" data-copy-id="thinking-block">${escapeHtml(t('sidebar.copy'))}</button></div>
        <div class="detail-section-content code">${escapeHtml(truncate(block.thinking, 2000))}</div>
      </div>`;
      }
    } else if (type === 'tool_use') {
      const block = data as { name?: string; input?: Record<string, unknown> };
      content += `<div class="detail-section">
      <div class="detail-section-label"><span>${escapeHtml(t('search.tool'))}</span></div>
      <div class="detail-section-content"><strong>${escapeHtml(block.name || 'unknown')}</strong></div>
    </div>`;
      if (block.input) {
        const inputJson = JSON.stringify(block.input, null, 2);
        this.copyableContent['tool-input'] = inputJson;
        content += `<div class="detail-section">
        <div class="detail-section-label"><span>${escapeHtml(t('sidebar.toolInput'))}</span><button class="copy-btn" data-copy-id="tool-input">${escapeHtml(t('sidebar.copy'))}</button></div>
        <div class="detail-section-content code">${escapeHtml(truncate(inputJson, 1500))}</div>
      </div>`;
      }
    } else if (type === 'tool_result') {
      const block = data as { content?: string; is_error?: boolean };
      const resultContent = String(block.content || '');
      this.copyableContent['tool-result'] = resultContent;
      content += `<div class="detail-section">
      <div class="detail-section-label"><span>${escapeHtml(block.is_error ? t('sidebar.toolResultError') : t('sidebar.toolResult'))}</span><button class="copy-btn" data-copy-id="tool-result">${escapeHtml(t('sidebar.copy'))}</button></div>
      <div class="detail-section-content code">${escapeHtml(truncate(resultContent, 2000))}</div>
    </div>`;
    }

    return content;
  }

  /**
   * Wire up event handlers for buttons
   */
  private wireUpEvents(_selection: Selection): void {
    // Wire up cluster toggle button
    const toggleBtn = document.getElementById('toggle-cluster-btn');
    toggleBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(toggleBtn.dataset.clusterIndex || '0', 10);
      this.viewer.toggleCluster(clusterIndex);
    });

    // Wire up focus button
    const focusBtn = document.getElementById('focus-cluster-btn');
    focusBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(focusBtn.dataset.clusterIndex || '0', 10);
      this.viewer.focusOnCluster(clusterIndex);
    });

    // Wire up copy turn button
    const copyTurnBtn = document.getElementById('copy-turn-btn');
    copyTurnBtn?.addEventListener('click', async () => {
      const clusterIndex = parseInt(copyTurnBtn.dataset.clusterIndex || '0', 10);
      const searchable = this.viewer.getSearchableContent();
      const cluster = searchable[clusterIndex];
      if (!cluster) return;

      const text = buildTurnText(cluster, clusterIndex + 1);

      try {
        await navigator.clipboard.writeText(text);
        copyTurnBtn.textContent = t('sidebar.copied');
        this.scheduleTimeout(() => {
          copyTurnBtn.textContent = t('sidebar.copy');
        }, 1500);
      } catch {
        console.error('Failed to copy');
      }
    });

    // Wire up prev/next turn buttons
    const prevBtn = document.getElementById('prev-turn-btn');
    prevBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(prevBtn.dataset.clusterIndex || '0', 10);
      if (clusterIndex > 0) {
        this.viewer.selectClusterByIndex(clusterIndex - 1);
      }
    });

    const nextBtn = document.getElementById('next-turn-btn');
    nextBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(nextBtn.dataset.clusterIndex || '0', 10);
      if (clusterIndex < this.viewer.getClusterCount() - 1) {
        this.viewer.selectClusterByIndex(clusterIndex + 1);
      }
    });

    // Wire up collapse parent button
    const collapseBtn = document.getElementById('collapse-parent-btn');
    collapseBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(collapseBtn.dataset.clusterIndex || '0', 10);
      this.viewer.toggleCluster(clusterIndex);
    });

    // Wire up raw data toggle
    const rawToggleBtn = document.getElementById('toggle-raw-btn');
    const rawDataContent = document.getElementById('raw-data-content');
    rawToggleBtn?.addEventListener('click', () => {
      if (rawDataContent) {
        const isHidden = rawDataContent.style.display === 'none';
        rawDataContent.style.display = isHidden ? 'block' : 'none';
        rawToggleBtn.textContent = isHidden ? t('sidebar.hideRawData') : t('sidebar.showRawData');
      }
    });

    // Wire up copy buttons
    this.container.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const copyId = (btn as HTMLElement).dataset.copyId;
        if (!copyId || !this.copyableContent[copyId]) return;

        try {
          await navigator.clipboard.writeText(this.copyableContent[copyId]);
          btn.textContent = t('sidebar.copied');
          btn.classList.add('copied');
          this.scheduleTimeout(() => {
            btn.textContent = t('sidebar.copy');
            btn.classList.remove('copied');
          }, 1500);
        } catch (err) {
          console.error('Failed to copy:', err);
          btn.textContent = t('sidebar.failed');
          this.scheduleTimeout(() => {
            btn.textContent = t('sidebar.copy');
          }, 1500);
        }
      });
    });
  }
}

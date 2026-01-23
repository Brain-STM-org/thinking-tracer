/**
 * Standalone viewer entry point
 */

import { Viewer } from './core/Viewer';
import { initFileDrop } from './utils/file-drop';
import {
  saveRecentTrace,
  getRecentTraces,
  deleteRecentTrace,
  clearRecentTraces,
  formatSize,
  formatRelativeTime,
  type RecentTrace,
} from './utils/recent-traces';

// Get DOM elements
const container = document.getElementById('canvas-container');
const dropOverlay = document.getElementById('drop-overlay');
const statsEl = document.getElementById('stats');
const infoPanel = document.getElementById('info-panel');
const fileSelectBtn = document.getElementById('file-select-btn');
const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
const legend = document.getElementById('legend');
const detailPanel = document.getElementById('detail-panel');
const detailPanelContent = document.getElementById('detail-panel-content');
const detailPanelClose = document.getElementById('detail-panel-close');
const recentTracesEl = document.getElementById('recent-traces');
const recentListEl = document.getElementById('recent-list');
const recentClearBtn = document.getElementById('recent-clear-btn');

if (!container) {
  throw new Error('Container element not found');
}

// Create viewer
const viewer = new Viewer({
  container,
  background: 0x1a1a2e,
});

// Setup stats display
viewer.onStats((stats) => {
  if (statsEl) {
    statsEl.innerHTML = [
      `Turns: ${stats.turns}`,
      `Thinking: ${stats.thinkingBlocks}`,
      `Tools: ${stats.toolCalls}`,
      `Tokens: ${stats.totalTokens.toLocaleString()}`,
    ].join(' | ');
  }
});

/**
 * Load a conversation file
 */
async function loadFile(content: string, filename: string, skipSave = false): Promise<void> {
  try {
    viewer.loadJSON(content);

    const conversation = viewer.getConversation();
    const title = conversation?.meta.title || filename;
    const turnCount = conversation?.turns.length || 0;

    // Save to recent traces (unless loading from recent)
    if (!skipSave) {
      try {
        await saveRecentTrace(filename, title, turnCount, content);
        await refreshRecentTraces();
      } catch (err) {
        console.warn('Failed to save to recent traces:', err);
      }
    }

    // Hide initial overlay and update info
    if (dropOverlay) {
      dropOverlay.classList.remove('visible');
    }
    if (infoPanel) {
      infoPanel.innerHTML = `
        <h1>${escapeHtml(title)}</h1>
        <p>Click or use arrow keys to navigate<br>Esc to deselect, drag to orbit</p>
        <button id="back-btn">← Open Another</button>
      `;

      // Wire up back button
      const backBtn = document.getElementById('back-btn');
      backBtn?.addEventListener('click', showFileSelector);
    }

    // Show legend
    if (legend) {
      legend.classList.add('visible');
    }

    // Hide detail panel when loading new file
    if (detailPanel) {
      detailPanel.classList.remove('visible');
    }

    console.log(`Loaded: ${filename}`);
  } catch (error) {
    console.error('Failed to load conversation:', error);
    alert(`Failed to load file: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Load a trace from recent history
 */
async function loadRecentTrace(trace: RecentTrace): Promise<void> {
  // Update last opened time by re-saving
  try {
    await saveRecentTrace(trace.filename, trace.title, trace.turnCount, trace.content);
  } catch (err) {
    console.warn('Failed to update recent trace:', err);
  }

  await loadFile(trace.content, trace.filename, true);
}

/**
 * Refresh the recent traces list
 */
async function refreshRecentTraces(): Promise<void> {
  if (!recentTracesEl || !recentListEl) return;

  try {
    const traces = await getRecentTraces();

    if (traces.length === 0) {
      recentTracesEl.classList.add('hidden');
      return;
    }

    recentTracesEl.classList.remove('hidden');
    recentListEl.innerHTML = traces.map(renderRecentItem).join('');

    // Attach event listeners
    recentListEl.querySelectorAll('.recent-item').forEach((item, index) => {
      const trace = traces[index];

      item.addEventListener('click', (e) => {
        // Don't trigger if clicking delete button
        if ((e.target as HTMLElement).closest('.recent-item-delete')) return;
        loadRecentTrace(trace);
      });

      const deleteBtn = item.querySelector('.recent-item-delete');
      deleteBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteRecentTrace(trace.id);
        await refreshRecentTraces();
      });
    });
  } catch (err) {
    console.warn('Failed to load recent traces:', err);
    recentTracesEl.classList.add('hidden');
  }
}

/**
 * Render a recent trace item
 */
function renderRecentItem(trace: RecentTrace): string {
  return `
    <div class="recent-item" data-id="${trace.id}">
      <div class="recent-item-icon">📄</div>
      <div class="recent-item-info">
        <div class="recent-item-title">${escapeHtml(trace.title)}</div>
        <div class="recent-item-meta">
          ${trace.turnCount} turns · ${formatSize(trace.size)} · ${formatRelativeTime(trace.lastOpened)}
        </div>
      </div>
      <button class="recent-item-delete" title="Remove from history">&times;</button>
    </div>
  `;
}

// Setup file drop
initFileDrop({
  target: document.body,
  overlay: dropOverlay ?? undefined,
  accept: ['.json', '.jsonl'],
  onDrop: (content, filename) => loadFile(content, filename),
  onError: (error) => {
    console.error('File drop error:', error);
    alert(error.message);
  },
});

// Setup file select button
if (fileSelectBtn && fileInput) {
  fileSelectBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      await loadFile(content, file.name);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert(`Failed to read file: ${error instanceof Error ? error.message : error}`);
    }

    // Reset input so the same file can be selected again
    fileInput.value = '';
  });
}

// Setup clear all recent traces button
if (recentClearBtn) {
  recentClearBtn.addEventListener('click', async () => {
    if (confirm('Clear all recent traces?')) {
      await clearRecentTraces();
      await refreshRecentTraces();
    }
  });
}

/**
 * Show the file selector overlay
 */
async function showFileSelector(): Promise<void> {
  // Refresh recent traces list
  await refreshRecentTraces();

  // Show drop overlay
  if (dropOverlay) {
    dropOverlay.classList.add('visible');
  }

  // Hide legend
  if (legend) {
    legend.classList.remove('visible');
  }

  // Hide detail panel and clear selection
  if (detailPanel) {
    detailPanel.classList.remove('visible');
  }
  viewer.clearSelection();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup detail panel close button
if (detailPanelClose && detailPanel) {
  detailPanelClose.addEventListener('click', () => {
    detailPanel.classList.remove('visible');
    viewer.clearSelection();
  });
}

// Setup selection handler
viewer.onSelect((selection) => {
  if (!selection) {
    if (detailPanel) {
      detailPanel.classList.remove('visible');
    }
    return;
  }

  if (detailPanel && detailPanelContent) {
    detailPanel.classList.add('visible');
    detailPanelContent.innerHTML = renderDetail(selection);
  }
});

/**
 * Render detail panel content for a selection
 */
function renderDetail(selection: { type: string; data: unknown; turnIndex: number }): string {
  const { type, data } = selection;

  let content = `<div class="detail-section">
    <div class="detail-section-label">Type</div>
    <div class="detail-section-content">
      <span class="detail-type-badge ${type}">${type.replace('_', ' ')}</span>
    </div>
  </div>`;

  // Type-specific content
  if (type === 'user' || type === 'assistant') {
    const turn = data as { content: Array<{ type: string; text?: string; thinking?: string }> };
    const textBlocks = turn.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      const text = textBlocks.map(b => b.text || '').join('\n\n');
      content += `<div class="detail-section">
        <div class="detail-section-label">Content</div>
        <div class="detail-section-content">${escapeHtml(truncate(text, 1000))}</div>
      </div>`;
    }
  } else if (type === 'thinking') {
    const block = data as { thinking?: string };
    if (block.thinking) {
      content += `<div class="detail-section">
        <div class="detail-section-label">Thinking</div>
        <div class="detail-section-content code">${escapeHtml(truncate(block.thinking, 2000))}</div>
      </div>`;
    }
  } else if (type === 'tool_use') {
    const block = data as { name?: string; input?: Record<string, unknown> };
    content += `<div class="detail-section">
      <div class="detail-section-label">Tool</div>
      <div class="detail-section-content"><strong>${escapeHtml(block.name || 'unknown')}</strong></div>
    </div>`;
    if (block.input) {
      content += `<div class="detail-section">
        <div class="detail-section-label">Input</div>
        <div class="detail-section-content code">${escapeHtml(truncate(JSON.stringify(block.input, null, 2), 1500))}</div>
      </div>`;
    }
  } else if (type === 'tool_result') {
    const block = data as { content?: string; is_error?: boolean };
    content += `<div class="detail-section">
      <div class="detail-section-label">Result${block.is_error ? ' (Error)' : ''}</div>
      <div class="detail-section-content code">${escapeHtml(truncate(String(block.content || ''), 2000))}</div>
    </div>`;
  }

  content += `<div class="detail-section">
    <div class="detail-section-label">Turn Index</div>
    <div class="detail-section-content">${selection.turnIndex}</div>
  </div>`;

  return content;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Load recent traces on startup
refreshRecentTraces();

// Log ready state
console.log('Thinking Trace Viewer ready');
console.log('Drop a Claude Code conversation file to visualize');

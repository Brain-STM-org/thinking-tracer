/**
 * Standalone viewer entry point
 */

import { Viewer } from './core/Viewer';
import { initFileDrop } from './utils/file-drop';

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
function loadFile(content: string, filename: string): void {
  try {
    viewer.loadJSON(content);

    // Hide initial overlay and update info
    if (dropOverlay) {
      dropOverlay.classList.remove('visible');
    }
    if (infoPanel) {
      const conversation = viewer.getConversation();
      const title = conversation?.meta.title || filename;
      infoPanel.innerHTML = `
        <h1>${escapeHtml(title)}</h1>
        <p>Click nodes to inspect<br>Drag to orbit, scroll to zoom</p>
      `;
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

// Setup file drop
initFileDrop({
  target: document.body,
  overlay: dropOverlay ?? undefined,
  accept: ['.json', '.jsonl'],
  onDrop: loadFile,
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
      loadFile(content, file.name);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert(`Failed to read file: ${error instanceof Error ? error.message : error}`);
    }

    // Reset input so the same file can be selected again
    fileInput.value = '';
  });
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

// Log ready state
console.log('Thinking Trace Viewer ready');
console.log('Drop a Claude Code conversation file to visualize');

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
        <p>Use mouse to orbit, scroll to zoom<br>Right-click to pan</p>
      `;
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

// Log ready state
console.log('Thinking Trace Viewer ready');
console.log('Drop a Claude Code conversation file to visualize');

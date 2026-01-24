/**
 * Standalone viewer entry point
 */

import { marked } from 'marked';
import { Viewer } from './core/Viewer';
import { initFileDrop, decompressGzip, decompressZstdFile, decompressZstdBuffer, FileWatcher } from './utils/file-drop';
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
} from './utils/recent-traces';

// Get DOM elements
const container = document.getElementById('canvas-container');
const dropOverlay = document.getElementById('drop-overlay');
const statsEl = document.getElementById('stats');
const toolbar = document.getElementById('toolbar');
const toolbarTitle = document.getElementById('toolbar-title');
const toolbarMeta = document.getElementById('toolbar-meta');
const toolbarBack = document.getElementById('toolbar-back');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarResize = document.getElementById('sidebar-resize');
const fileSelectBtn = document.getElementById('file-select-btn');
const trySampleBtn = document.getElementById('try-sample-btn');
const canvasControls = document.getElementById('canvas-controls');
const watchToggle = document.getElementById('watch-toggle');
const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
const legend = document.getElementById('legend');
const legendHeader = document.getElementById('legend-header');
const detailPanelContent = document.getElementById('detail-panel-content');
const recentTracesEl = document.getElementById('recent-traces');
const recentListEl = document.getElementById('recent-list');
const recentClearBtn = document.getElementById('recent-clear-btn');
const metricsStack = document.getElementById('metrics-stack');
const chartRange = document.getElementById('chart-range');
const chartTooltip = document.getElementById('chart-tooltip');
const splitHandle = document.getElementById('split-handle');
const canvasPane = document.getElementById('canvas-pane');
const conversationPane = document.getElementById('conversation-pane');
const contentArea = document.getElementById('content-area');
const conversationContent = document.getElementById('conversation-content');
const conversationTurnIndicator = document.getElementById('conversation-turn-indicator');
const conversationFilters = document.getElementById('conversation-filters');
const wordFreqChart = document.getElementById('word-freq-chart');
const wordFreqSource = document.getElementById('word-freq-source') as HTMLSelectElement | null;
const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
const searchRegexToggle = document.getElementById('search-regex-toggle');
const searchResultsCount = document.getElementById('search-results-count');
const searchResultsList = document.getElementById('search-results-list');
const searchPrevBtn = document.getElementById('search-prev');
const searchNextBtn = document.getElementById('search-next');
const searchClearBtn = document.getElementById('search-clear');
const exportBtn = document.getElementById('export-btn');
const exportDropdown = document.querySelector('.export-dropdown');
const exportMenu = document.querySelector('.export-menu');
const expandToggle = document.getElementById('expand-toggle');

// Track expanded state
let allExpanded = false;

// Chart state
let currentFocusIndex = 0;
type MetricKey = 'totalTokens' | 'outputTokens' | 'inputTokens' | 'thinkingCount' | 'toolCount' | 'contentLength';

// View mode: '3d' | 'split' | 'conversation'
let viewMode: '3d' | 'split' | 'conversation' = 'split';

// Sidebar visibility
let sidebarVisible = true;

// Current trace info for name editing
let currentTraceId: string | null = null;

// Track if this is a freshly loaded trace (vs restored from recent)
let isNewTrace = false;

// Saved camera state for "home" view (user's last saved position)
let savedCameraState: { position: [number, number, number]; target: [number, number, number] } | null = null;

/**
 * Get current UI state for persistence
 */
function getCurrentUIState(): TraceUIState {
  const cameraState = viewer.getCameraState();

  // Calculate split ratio if in split mode
  let splitRatio: number | undefined;
  if (viewMode === 'split' && canvasPane && contentArea) {
    const canvasWidth = canvasPane.offsetWidth;
    const contentWidth = contentArea.offsetWidth;
    if (contentWidth > 0) {
      splitRatio = canvasWidth / contentWidth;
    }
  }

  return {
    cameraPosition: cameraState.position,
    cameraTarget: cameraState.target,
    viewMode,
    sidebarVisible,
    splitRatio,
    selectedCluster: currentFocusIndex,
  };
}

/**
 * Save current UI state to storage
 */
async function saveCurrentUIState(): Promise<void> {
  if (!currentTraceId) return;

  try {
    const uiState = getCurrentUIState();
    await updateTraceUIState(currentTraceId, uiState);
  } catch (err) {
    console.warn('Failed to save UI state:', err);
  }
}

/**
 * Restore UI state from a trace
 */
function restoreUIState(uiState: TraceUIState): void {
  // Restore camera position and save as "home" state
  if (uiState.cameraPosition && uiState.cameraTarget) {
    viewer.setCameraState(uiState.cameraPosition, uiState.cameraTarget);
    savedCameraState = {
      position: uiState.cameraPosition,
      target: uiState.cameraTarget,
    };
  }

  // Restore view mode
  if (uiState.viewMode) {
    viewMode = uiState.viewMode;
  }

  // Restore sidebar visibility
  if (uiState.sidebarVisible !== undefined) {
    sidebarVisible = uiState.sidebarVisible;
  }

  // Restore split ratio
  if (uiState.splitRatio !== undefined && canvasPane && contentArea) {
    const contentWidth = contentArea.offsetWidth;
    if (contentWidth > 0) {
      const canvasWidth = uiState.splitRatio * contentWidth;
      canvasPane.style.flex = 'none';
      canvasPane.style.width = `${canvasWidth}px`;
    }
  }

  // Restore selected cluster
  if (uiState.selectedCluster !== undefined) {
    currentFocusIndex = uiState.selectedCluster;
  }
}

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
 * Generate a simple hash for content identification (matches recent-traces.ts)
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 10000); i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${hash.toString(16)}-${content.length}`;
}

/**
 * Load a conversation file
 */
async function loadFile(content: string, filename: string, skipSave = false, customName?: string): Promise<void> {
  try {
    viewer.loadJSON(content);

    const conversation = viewer.getConversation();
    const originalTitle = conversation?.meta.title || filename;
    const turnCount = conversation?.turns.length || 0;

    // Track current trace for name editing
    currentTraceId = hashContent(content);

    // Use custom name if provided, otherwise use original title
    const displayName = customName || originalTitle;

    // Save to recent traces (unless loading from recent)
    if (!skipSave) {
      // Mark as new trace - will set initial view
      isNewTrace = true;
      try {
        await saveRecentTrace(filename, originalTitle, turnCount, content);
        await refreshRecentTraces();
      } catch (err) {
        console.warn('Failed to save to recent traces:', err);
      }
    }

    // Hide initial overlay and show toolbar
    if (dropOverlay) {
      dropOverlay.classList.remove('visible');
    }
    if (toolbar) {
      toolbar.classList.add('visible');
    }

    // Update toolbar with session info (editable)
    if (toolbarTitle) {
      toolbarTitle.textContent = displayName;
      toolbarTitle.dataset.fullTitle = displayName;
      toolbarTitle.dataset.originalTitle = originalTitle;
    }

    if (toolbarMeta) {
      const meta = conversation?.meta;
      const metaItems: string[] = [];

      // Add metadata items
      if (meta?.model) {
        metaItems.push(`<span class="meta-item" title="Model">${escapeHtml(meta.model)}</span>`);
      }
      if (meta?.git_branch) {
        metaItems.push(`<span class="meta-item" title="Git Branch">⎇ ${escapeHtml(meta.git_branch)}</span>`);
      }
      if (meta?.duration_ms !== undefined) {
        metaItems.push(`<span class="meta-item" title="Duration">⏱ ${formatDuration(meta.duration_ms)}</span>`);
      }
      if (meta?.cwd) {
        const shortCwd = meta.cwd.split('/').slice(-2).join('/');
        metaItems.push(`<span class="meta-item" title="${escapeHtml(meta.cwd)}">📁 ${escapeHtml(shortCwd)}</span>`);
      }

      toolbarMeta.innerHTML = metaItems.join('');
    }

    // Enable export button
    if (exportBtn) {
      (exportBtn as HTMLButtonElement).disabled = false;
    }

    // Show legend and canvas controls
    if (legend) {
      legend.classList.add('visible');
    }
    if (canvasControls) {
      canvasControls.classList.add('visible');
    }

    // Apply view mode
    applyViewMode();

    // Show sidebar
    if (sidebar && sidebarVisible) {
      sidebar.classList.add('visible');
      sidebarToggle?.classList.add('active');
    }

    // Apply panel visibility and select first node
    currentFocusIndex = 0;

    // Reset expand toggle state
    allExpanded = false;
    if (expandToggle) {
      expandToggle.textContent = 'Expand';
      expandToggle.classList.remove('expanded');
    }

    setTimeout(() => {
      drawCharts(currentFocusIndex);
      renderWordFrequencyChart();

      // Set initial camera view for new traces
      if (isNewTrace) {
        viewer.setInitialView();
      }

      // Select first cluster
      if (viewer.getClusterCount() > 0) {
        viewer.selectClusterByIndex(0);
      }
    }, 50);

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

  // Mark as not a new trace (has saved state)
  isNewTrace = false;

  // Pass custom name if it exists
  await loadFile(trace.content, trace.filename, true, trace.customName);

  // Restore UI state after loading
  if (trace.uiState) {
    restoreUIState(trace.uiState);

    // Apply restored view mode and sidebar state
    applyViewMode();
    if (sidebarVisible) {
      sidebar?.classList.add('visible');
      sidebarToggle?.classList.add('active');
    } else {
      sidebar?.classList.remove('visible');
      sidebarToggle?.classList.remove('active');
    }

    // Restore selected cluster in viewer
    if (trace.uiState.selectedCluster !== undefined && trace.uiState.selectedCluster < viewer.getClusterCount()) {
      setTimeout(() => {
        viewer.selectClusterByIndex(trace.uiState!.selectedCluster!);
      }, 100);
    }
  }
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
      const name = file.name.toLowerCase();
      const isGzipped = name.endsWith('.gz');
      const isZstd = name.endsWith('.zst') || name.endsWith('.zstd');

      let content: string;
      let displayName = file.name;

      if (isGzipped) {
        content = await decompressGzip(file);
        displayName = file.name.slice(0, -3);
      } else if (isZstd) {
        content = await decompressZstdFile(file);
        displayName = name.endsWith('.zstd') ? file.name.slice(0, -5) : file.name.slice(0, -4);
      } else {
        content = await file.text();
      }

      await loadFile(content, displayName);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert(`Failed to read file: ${error instanceof Error ? error.message : error}`);
    }

    // Reset input so the same file can be selected again
    fileInput.value = '';
  });
}

// File watcher instance
let fileWatcher: FileWatcher | null = null;

// Update watch button state
function updateWatchButtonState(): void {
  if (!watchToggle) return;

  if (fileWatcher?.isWatching()) {
    watchToggle.classList.add('watching');
    watchToggle.textContent = 'Watching';
  } else {
    watchToggle.classList.remove('watching');
    watchToggle.textContent = 'Watch';
  }
}

// Setup watch toggle button (inside viewer experience)
if (watchToggle) {
  // Disable if File System Access API not supported
  if (!FileWatcher.isSupported()) {
    (watchToggle as HTMLButtonElement).disabled = true;
    watchToggle.title = 'File watching requires Chromium-based browser';
  }

  watchToggle.addEventListener('click', async () => {
    // If already watching, stop
    if (fileWatcher?.isWatching()) {
      fileWatcher.stop();
      fileWatcher = null;
      updateWatchButtonState();
      showWatchNotification('Stopped watching');
      return;
    }

    // Create new watcher
    fileWatcher = new FileWatcher({
      onChange: async (content, filename) => {
        console.log(`File changed: ${filename}`);
        // Reload the file with updated content
        await loadFile(content, filename, false);
        // Show a brief notification
        showWatchNotification('File updated');
      },
      onError: (error) => {
        console.error('Watch error:', error);
        showWatchNotification('Watch stopped: ' + error.message);
        updateWatchButtonState();
      },
      pollInterval: 1000,
    });

    const result = await fileWatcher.openAndWatch();
    if (result) {
      await loadFile(result.content, result.filename);
      updateWatchButtonState();
      showWatchNotification(`Watching: ${result.filename}`);
    } else {
      // User cancelled or error
      fileWatcher = null;
      updateWatchButtonState();
    }
  });
}

// Show a brief notification for watch events
function showWatchNotification(message: string): void {
  // Create or reuse notification element
  let notif = document.getElementById('watch-notification');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'watch-notification';
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(80, 200, 120, 0.95);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1000;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(notif);
  }

  notif.textContent = message;
  notif.style.opacity = '1';

  setTimeout(() => {
    notif!.style.opacity = '0';
  }, 2000);
}

// Setup try sample button (now a clickable div with overlay)
if (trySampleBtn) {
  trySampleBtn.addEventListener('click', async () => {
    if (trySampleBtn.classList.contains('loading')) return;

    const btnText = trySampleBtn.querySelector('.sample-preview-btn');
    try {
      trySampleBtn.classList.add('loading');
      if (btnText) btnText.textContent = 'Loading...';

      const response = await fetch('samples/sample-trace.jsonl.zstd');
      if (!response.ok) {
        throw new Error(`Failed to fetch sample: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const content = decompressZstdBuffer(buffer);
      await loadFile(content, 'sample-trace.jsonl', false, 'Thinking Tracer');
    } catch (error) {
      console.error('Failed to load sample:', error);
      alert(`Failed to load sample: ${error instanceof Error ? error.message : error}`);
    } finally {
      trySampleBtn.classList.remove('loading');
      if (btnText) btnText.textContent = 'See How This Was Built';
    }
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
  // Stop any active file watcher
  if (fileWatcher) {
    fileWatcher.stop();
    fileWatcher = null;
    updateWatchButtonState();
  }

  // Save current UI state before switching away
  await saveCurrentUIState();

  // Refresh recent traces list
  await refreshRecentTraces();

  // Show drop overlay
  if (dropOverlay) {
    dropOverlay.classList.add('visible');
  }

  // Hide toolbar
  if (toolbar) {
    toolbar.classList.remove('visible');
  }

  // Hide legend and canvas controls
  if (legend) {
    legend.classList.remove('visible');
  }
  if (canvasControls) {
    canvasControls.classList.remove('visible');
  }

  // Hide sidebar
  sidebar?.classList.remove('visible');

  // Hide conversation pane
  conversationPane?.classList.remove('visible');
  splitHandle?.classList.remove('visible');

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

// Configure marked for safe rendering
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

/**
 * Render markdown to HTML
 */
function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    return marked.parse(text) as string;
  } catch {
    // Fallback to escaped text if parsing fails
    return escapeHtml(text);
  }
}

// ============================================
// View Mode System
// ============================================

/**
 * Apply the current view mode
 */
function applyViewMode(): void {
  // Update view mode buttons
  document.querySelectorAll('.view-mode-btn').forEach((btn) => {
    const mode = (btn as HTMLElement).dataset.mode;
    if (mode === viewMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Apply layout based on mode
  switch (viewMode) {
    case '3d':
      canvasPane?.classList.remove('hidden');
      conversationPane?.classList.remove('visible', 'full-width');
      splitHandle?.classList.remove('visible');
      legend?.classList.add('visible');
      break;
    case 'split':
      canvasPane?.classList.remove('hidden');
      conversationPane?.classList.add('visible');
      conversationPane?.classList.remove('full-width');
      splitHandle?.classList.add('visible');
      legend?.classList.add('visible');
      renderConversation();
      break;
    case 'conversation':
      canvasPane?.classList.add('hidden');
      conversationPane?.classList.add('visible', 'full-width');
      splitHandle?.classList.remove('visible');
      legend?.classList.remove('visible');
      renderConversation();
      break;
  }

}

/**
 * Set view mode
 */
function setViewMode(mode: '3d' | 'split' | 'conversation'): void {
  viewMode = mode;
  applyViewMode();
}

// Wire up view mode buttons
document.querySelectorAll('.view-mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = (btn as HTMLElement).dataset.mode as '3d' | 'split' | 'conversation';
    if (mode) setViewMode(mode);
  });
});

// ============================================
// Sidebar System
// ============================================

/**
 * Toggle sidebar visibility
 */
function toggleSidebar(): void {
  sidebarVisible = !sidebarVisible;
  if (sidebarVisible) {
    sidebar?.classList.add('visible');
    sidebarToggle?.classList.add('active');
  } else {
    sidebar?.classList.remove('visible');
    sidebarToggle?.classList.remove('active');
  }
}

// Wire up sidebar toggle
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', toggleSidebar);
}

// Wire up legend collapse toggle
if (legendHeader && legend) {
  legendHeader.addEventListener('click', () => {
    legend.classList.toggle('collapsed');
  });
}

// Wire up toolbar back button
if (toolbarBack) {
  toolbarBack.addEventListener('click', showFileSelector);
}

// Wire up expand/collapse toggle
if (expandToggle) {
  expandToggle.addEventListener('click', () => {
    allExpanded = !allExpanded;
    if (allExpanded) {
      viewer.expandAll();
      expandToggle.textContent = 'Collapse';
      expandToggle.classList.add('expanded');
    } else {
      viewer.collapseAll();
      expandToggle.textContent = 'Expand';
      expandToggle.classList.remove('expanded');
    }
  });
}

// Wire up editable title
if (toolbarTitle) {
  // Make title editable on double-click
  toolbarTitle.addEventListener('dblclick', () => {
    if (!currentTraceId) return;

    toolbarTitle.contentEditable = 'true';
    toolbarTitle.classList.add('editing');
    toolbarTitle.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(toolbarTitle);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });

  // Save on blur or Enter
  const saveTitle = async () => {
    if (toolbarTitle.contentEditable !== 'true') return;

    toolbarTitle.contentEditable = 'false';
    toolbarTitle.classList.remove('editing');

    const newName = toolbarTitle.textContent?.trim() || '';
    const originalTitle = toolbarTitle.dataset.originalTitle || '';

    // If name matches original, clear custom name
    const customName = newName === originalTitle ? '' : newName;

    // Update display and tooltip
    const displayName = customName || originalTitle;
    toolbarTitle.textContent = displayName;
    toolbarTitle.dataset.fullTitle = displayName;

    // Save to storage
    if (currentTraceId) {
      try {
        await updateTraceCustomName(currentTraceId, customName);
        await refreshRecentTraces();
      } catch (err) {
        console.warn('Failed to save custom name:', err);
      }
    }
  };

  toolbarTitle.addEventListener('blur', saveTitle);

  // Stop all key events from propagating while editing
  const stopIfEditing = (e: Event) => {
    if (toolbarTitle.contentEditable === 'true') {
      e.stopPropagation();
    }
  };

  toolbarTitle.addEventListener('keydown', (e) => {
    if (toolbarTitle.contentEditable === 'true') {
      e.stopPropagation();

      if (e.key === 'Enter') {
        e.preventDefault();
        toolbarTitle.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Restore original display name
        const originalTitle = toolbarTitle.dataset.originalTitle || '';
        toolbarTitle.textContent = originalTitle;
        toolbarTitle.contentEditable = 'false';
        toolbarTitle.classList.remove('editing');
      }
    }
  });

  toolbarTitle.addEventListener('keyup', stopIfEditing);
  toolbarTitle.addEventListener('keypress', stopIfEditing);
}

// Wire up sidebar section accordion
document.querySelectorAll('.sidebar-section-header').forEach((header) => {
  header.addEventListener('click', () => {
    const section = header.closest('.sidebar-section');
    if (section) {
      section.classList.toggle('expanded');
    }
  });
});

// ============================================
// Sidebar Resizing
// ============================================

if (sidebarResize && sidebar) {
  let isSidebarResizing = false;
  let sidebarStartX = 0;
  let sidebarStartWidth = 0;

  sidebarResize.addEventListener('mousedown', (e) => {
    isSidebarResizing = true;
    sidebarStartX = e.clientX;
    sidebarStartWidth = sidebar.offsetWidth;
    sidebarResize.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isSidebarResizing) return;
    const delta = e.clientX - sidebarStartX;
    const newWidth = Math.min(400, Math.max(200, sidebarStartWidth + delta));
    sidebar.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isSidebarResizing) {
      isSidebarResizing = false;
      sidebarResize.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}


// Track copyable content for clipboard
let copyableContent: Record<string, string> = {};

/**
 * Render detail panel content for a selection
 */
function renderDetail(selection: { type: string; data: unknown; turnIndex: number; clusterIndex?: number }): string {
  const { type, data } = selection;

  // Reset copyable content
  copyableContent = {};

  let content = `<div class="detail-section">
    <div class="detail-section-label"><span>Type</span></div>
    <div class="detail-section-content">
      <span class="detail-type-badge ${type}">${type.replace('_', ' ')}</span>
    </div>
  </div>`;

  // Add expand/collapse button for clusters
  if (type === 'cluster') {
    const cluster = data as {
      expanded: boolean;
      index: number;
      thinkingCount: number;
      toolCount: number;
      userTurn?: { content: Array<{ type: string; text?: string }> };
      assistantTurn?: { content: Array<{ type: string; text?: string; thinking?: string; name?: string; content?: string; is_error?: boolean }> };
    };
    content += `<div class="detail-section">
      <div class="detail-section-label">Turn</div>
      <div class="detail-section-content"><strong>${cluster.index + 1}</strong> of ${viewer.getClusterCount()}</div>
    </div>`;
    content += `<div class="detail-section">
      <div class="detail-section-label">Actions</div>
      <div class="detail-section-content detail-actions">
        <button id="toggle-cluster-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="${cluster.expanded ? 'Collapse to single node' : 'Expand to show all blocks'}">
          ${cluster.expanded ? 'Collapse' : 'Expand'}
        </button>
        <button id="focus-cluster-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="Center camera on this turn">
          Focus
        </button>
        <button id="copy-turn-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="Copy turn content to clipboard">
          Copy
        </button>
        <button id="prev-turn-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="Go to previous turn" ${cluster.index === 0 ? 'disabled' : ''}>
          ← Prev
        </button>
        <button id="next-turn-btn" class="detail-action-btn" data-cluster-index="${cluster.index}" title="Go to next turn" ${cluster.index >= viewer.getClusterCount() - 1 ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    </div>`;

    // User message preview
    if (cluster.userTurn) {
      const userText = cluster.userTurn.content
        .filter(b => b.type === 'text')
        .map(b => b.text || '')
        .join('\n');
      if (userText) {
        content += `<div class="detail-section">
          <div class="detail-section-label">User</div>
          <div class="detail-section-content">${escapeHtml(truncate(userText, 200))}</div>
        </div>`;
      }
    }

    // Assistant text preview
    if (cluster.assistantTurn) {
      const assistantText = cluster.assistantTurn.content
        .filter(b => b.type === 'text')
        .map(b => b.text || '')
        .join('\n');
      if (assistantText) {
        content += `<div class="detail-section">
          <div class="detail-section-label">Assistant</div>
          <div class="detail-section-content">${escapeHtml(truncate(assistantText, 200))}</div>
        </div>`;
      }

      // List thinking blocks
      const thinkingBlocks = cluster.assistantTurn.content.filter(b => b.type === 'thinking');
      if (thinkingBlocks.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">Thinking (${thinkingBlocks.length})</div>
          <div class="detail-section-content cluster-list">`;
        for (const block of thinkingBlocks) {
          const preview = truncate(block.thinking || '', 100);
          content += `<div class="cluster-list-item thinking">${escapeHtml(preview)}</div>`;
        }
        content += `</div></div>`;
      }

      // List tool calls
      const toolUses = cluster.assistantTurn.content.filter(b => b.type === 'tool_use');
      if (toolUses.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">Tool Calls (${toolUses.length})</div>
          <div class="detail-section-content cluster-list">`;
        for (const block of toolUses) {
          content += `<div class="cluster-list-item tool_use">${escapeHtml(block.name || 'unknown')}</div>`;
        }
        content += `</div></div>`;
      }

      // List tool results
      const toolResults = cluster.assistantTurn.content.filter(b => b.type === 'tool_result');
      if (toolResults.length > 0) {
        content += `<div class="detail-section">
          <div class="detail-section-label">Tool Results (${toolResults.length})</div>
          <div class="detail-section-content cluster-list">`;
        for (const block of toolResults) {
          const status = block.is_error ? 'error' : 'success';
          const preview = truncate(String(block.content || ''), 80);
          content += `<div class="cluster-list-item tool_result ${status}">${escapeHtml(preview)}</div>`;
        }
        content += `</div></div>`;
      }
    }
  } else if (selection.clusterIndex !== undefined) {
    // Child node of a cluster - show turn number and collapse option
    content += `<div class="detail-section">
      <div class="detail-section-label">Turn</div>
      <div class="detail-section-content"><strong>${selection.clusterIndex + 1}</strong> of ${viewer.getClusterCount()}</div>
    </div>`;
    content += `<div class="detail-section">
      <div class="detail-section-label">Actions</div>
      <div class="detail-section-content">
        <button id="collapse-parent-btn" class="detail-action-btn" data-cluster-index="${selection.clusterIndex}">
          ↩ Collapse Turn
        </button>
      </div>
    </div>`;
  }

  // Type-specific content
  if (type === 'user' || type === 'assistant') {
    const turn = data as { content: Array<{ type: string; text?: string; thinking?: string; name?: string }> };

    // Show content block summary
    const blockTypes = turn.content.reduce((acc, b) => {
      acc[b.type] = (acc[b.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const blockSummary = Object.entries(blockTypes)
      .map(([t, count]) => `${count} ${t}`)
      .join(', ');

    if (blockSummary) {
      content += `<div class="detail-section">
        <div class="detail-section-label">Contains</div>
        <div class="detail-section-content">${escapeHtml(blockSummary)}</div>
      </div>`;
    }

    // Show text content if any
    const textBlocks = turn.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      const text = textBlocks.map(b => b.text || '').join('\n\n');
      copyableContent['text'] = text;
      content += `<div class="detail-section">
        <div class="detail-section-label"><span>Text</span><button class="copy-btn" data-copy-id="text">Copy</button></div>
        <div class="detail-section-content">${escapeHtml(truncate(text, 1000))}</div>
      </div>`;
    }

    // Show thinking preview if any
    const thinkingBlocks = turn.content.filter(b => b.type === 'thinking');
    if (thinkingBlocks.length > 0) {
      const thinking = thinkingBlocks.map(b => b.thinking || '').join('\n\n');
      copyableContent['thinking'] = thinking;
      content += `<div class="detail-section">
        <div class="detail-section-label"><span>Thinking</span><button class="copy-btn" data-copy-id="thinking">Copy</button></div>
        <div class="detail-section-content code">${escapeHtml(truncate(thinking, 500))}</div>
      </div>`;
    }

    // Show tool calls if any
    const toolBlocks = turn.content.filter(b => b.type === 'tool_use');
    if (toolBlocks.length > 0) {
      content += `<div class="detail-section">
        <div class="detail-section-label">Tools Used</div>
        <div class="detail-section-content">${toolBlocks.map(b => escapeHtml(b.name || 'unknown')).join(', ')}</div>
      </div>`;
    }
  } else if (type === 'thinking') {
    const block = data as { thinking?: string };
    if (block.thinking) {
      copyableContent['thinking-block'] = block.thinking;
      content += `<div class="detail-section">
        <div class="detail-section-label"><span>Thinking</span><button class="copy-btn" data-copy-id="thinking-block">Copy</button></div>
        <div class="detail-section-content code">${escapeHtml(truncate(block.thinking, 2000))}</div>
      </div>`;
    }
  } else if (type === 'tool_use') {
    const block = data as { name?: string; input?: Record<string, unknown> };
    content += `<div class="detail-section">
      <div class="detail-section-label"><span>Tool</span></div>
      <div class="detail-section-content"><strong>${escapeHtml(block.name || 'unknown')}</strong></div>
    </div>`;
    if (block.input) {
      const inputJson = JSON.stringify(block.input, null, 2);
      copyableContent['tool-input'] = inputJson;
      content += `<div class="detail-section">
        <div class="detail-section-label"><span>Input</span><button class="copy-btn" data-copy-id="tool-input">Copy</button></div>
        <div class="detail-section-content code">${escapeHtml(truncate(inputJson, 1500))}</div>
      </div>`;
    }
  } else if (type === 'tool_result') {
    const block = data as { content?: string; is_error?: boolean };
    const resultContent = String(block.content || '');
    copyableContent['tool-result'] = resultContent;
    content += `<div class="detail-section">
      <div class="detail-section-label"><span>Result${block.is_error ? ' (Error)' : ''}</span><button class="copy-btn" data-copy-id="tool-result">Copy</button></div>
      <div class="detail-section-content code">${escapeHtml(truncate(resultContent, 2000))}</div>
    </div>`;
  }

  // Add raw data toggle
  const rawJson = JSON.stringify(data, null, 2);
  copyableContent['raw-data'] = rawJson;
  content += `<div class="detail-section">
    <div class="detail-section-label">
      <button id="toggle-raw-btn" class="raw-toggle-btn">Show Raw Data</button>
      <button class="copy-btn" data-copy-id="raw-data" style="margin-left: 8px;">Copy</button>
    </div>
    <div id="raw-data-content" class="detail-section-content code raw-data" style="display: none;">${escapeHtml(truncate(rawJson, 10000))}</div>
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

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Metrics are now in sidebar - no positioning needed

// Minimum bar width for readability
const MIN_BAR_WIDTH = 4;
const BAR_GAP = 1;
const CHART_PADDING = 2;

/**
 * Draw a single metric chart with scrollable support
 */
function drawMetricChart(canvas: HTMLCanvasElement, values: number[], focusIndex?: number, color = '#4a90d9'): void {
  const maxValue = Math.max(...values, 1);
  const container = canvas.parentElement;
  if (!container) return;

  const dpr = window.devicePixelRatio || 1;
  const containerWidth = container.clientWidth;
  const height = 24;

  // Calculate bar width - use minimum if needed, otherwise fit to container
  const naturalBarWidth = (containerWidth - CHART_PADDING * 2) / values.length - BAR_GAP;
  const barWidth = Math.max(MIN_BAR_WIDTH, naturalBarWidth);

  // Calculate required canvas width
  const requiredWidth = CHART_PADDING * 2 + values.length * (barWidth + BAR_GAP);
  const canvasWidth = Math.max(containerWidth, requiredWidth);

  // Set canvas size
  canvas.width = canvasWidth * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // Clear
  ctx.fillStyle = '#2a2a40';
  ctx.fillRect(0, 0, canvasWidth, height);

  // Draw bars
  const minBarHeight = 3; // Minimum visible height for non-zero values
  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    // Skip zero values entirely
    if (value === 0) continue;

    // Non-zero values get at least minBarHeight so they're visible
    const scaledHeight = (value / maxValue) * (height - CHART_PADDING * 2);
    const barHeight = Math.max(minBarHeight, scaledHeight);
    const x = CHART_PADDING + i * (barWidth + BAR_GAP);
    const y = height - CHART_PADDING - barHeight;

    // Highlight focused bar
    if (focusIndex !== undefined && i === focusIndex) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = color;
    }

    ctx.fillRect(x, y, barWidth, barHeight);
  }

  // Auto-scroll to focused bar if needed
  if (focusIndex !== undefined && canvasWidth > containerWidth) {
    const focusX = CHART_PADDING + focusIndex * (barWidth + BAR_GAP);
    const scrollTarget = focusX - containerWidth / 2 + barWidth / 2;
    container.scrollLeft = Math.max(0, Math.min(scrollTarget, canvasWidth - containerWidth));
  }
}

/**
 * Draw all visible metric charts
 */
function drawCharts(focusIndex?: number): void {
  if (!metricsStack) return;

  const metrics = viewer.getClusterMetrics();
  if (metrics.length === 0) {
    return;
  }

  // Update range label
  if (chartRange) {
    chartRange.textContent = `1-${metrics.length}`;
  }

  // Color map for different metrics
  const colors: Record<MetricKey, string> = {
    totalTokens: '#4a90d9',
    outputTokens: '#50c878',
    inputTokens: '#9b59b6',
    thinkingCount: '#9b59b6',
    toolCount: '#f39c12',
    contentLength: '#888888',
  };

  // Draw each visible chart and update totals
  const rows = metricsStack.querySelectorAll('.metric-row');
  rows.forEach((row) => {
    const metricKey = row.getAttribute('data-metric') as MetricKey;
    const canvas = row.querySelector('.metric-canvas') as HTMLCanvasElement;
    const totalEl = row.querySelector('.metric-total') as HTMLElement;

    if (!metricKey || !canvas) return;

    const values = metrics.map(m => m[metricKey]);
    drawMetricChart(canvas, values, focusIndex, colors[metricKey]);

    // Update total
    if (totalEl) {
      const total = values.reduce((sum, v) => sum + v, 0);
      totalEl.textContent = formatMetricValue(total);
    }
  });
}

/**
 * Format metric value for display (compact numbers)
 */
function formatMetricValue(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

// Setup metric click-to-select
if (metricsStack) {
  // Click on chart to select cluster
  metricsStack.addEventListener('click', (e) => {
    const container = (e.target as HTMLElement).closest('.metric-chart-container');
    const canvas = container?.querySelector('.metric-canvas') as HTMLCanvasElement;
    if (!container || !canvas) return;

    const clusterCount = viewer.getClusterCount();
    if (clusterCount === 0) return;

    // Get click position relative to canvas (accounting for scroll)
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left + container.scrollLeft;

    // Calculate bar width (same logic as drawing)
    const containerWidth = container.clientWidth;
    const naturalBarWidth = (containerWidth - CHART_PADDING * 2) / clusterCount - BAR_GAP;
    const barWidth = Math.max(MIN_BAR_WIDTH, naturalBarWidth);

    // Calculate which cluster was clicked
    const clusterIndex = Math.floor((x - CHART_PADDING) / (barWidth + BAR_GAP));

    if (clusterIndex >= 0 && clusterIndex < clusterCount) {
      viewer.selectClusterByIndex(clusterIndex);
    }
  });

  // Chart tooltip on hover
  metricsStack.addEventListener('mousemove', (e) => {
    if (!chartTooltip) return;

    const container = (e.target as HTMLElement).closest('.metric-chart-container');
    const row = (e.target as HTMLElement).closest('.metric-row');
    const canvas = container?.querySelector('.metric-canvas') as HTMLCanvasElement;

    if (!container || !row || !canvas) {
      chartTooltip.classList.remove('visible');
      return;
    }

    const metricKey = row.getAttribute('data-metric') as MetricKey;
    const metrics = viewer.getClusterMetrics();
    if (metrics.length === 0) {
      chartTooltip.classList.remove('visible');
      return;
    }

    // Get click position relative to canvas (accounting for scroll)
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left + container.scrollLeft;

    // Calculate bar width (same logic as drawing)
    const containerWidth = container.clientWidth;
    const naturalBarWidth = (containerWidth - CHART_PADDING * 2) / metrics.length - BAR_GAP;
    const barWidth = Math.max(MIN_BAR_WIDTH, naturalBarWidth);

    // Calculate which cluster is hovered
    const clusterIndex = Math.floor((x - CHART_PADDING) / (barWidth + BAR_GAP));

    if (clusterIndex >= 0 && clusterIndex < metrics.length) {
      const value = metrics[clusterIndex][metricKey];
      const turnEl = chartTooltip.querySelector('.tooltip-turn');
      const valueEl = chartTooltip.querySelector('.tooltip-value');

      if (turnEl) turnEl.textContent = `Turn ${clusterIndex + 1}`;
      if (valueEl) valueEl.textContent = value.toLocaleString();

      // Position tooltip near cursor
      chartTooltip.style.left = `${e.clientX + 12}px`;
      chartTooltip.style.top = `${e.clientY - 10}px`;
      chartTooltip.classList.add('visible');
    } else {
      chartTooltip.classList.remove('visible');
    }
  });

  metricsStack.addEventListener('mouseleave', () => {
    if (chartTooltip) {
      chartTooltip.classList.remove('visible');
    }
  });
}

// Update charts and conversation when selection changes
viewer.onSelect((selection) => {
  if (selection?.clusterIndex !== undefined) {
    currentFocusIndex = selection.clusterIndex;
    drawCharts(currentFocusIndex);

    // Sync conversation scroll to selection
    scrollConversationToCluster(selection.clusterIndex);
  }

  if (!selection) {
    // Show empty state instead of hiding
    if (detailPanelContent) {
      detailPanelContent.innerHTML = '<div class="detail-empty">&lt;no selection&gt;</div>';
    }
    return;
  }

  if (detailPanelContent) {
    detailPanelContent.innerHTML = renderDetail(selection);

    // Wire up cluster toggle button
    const toggleBtn = document.getElementById('toggle-cluster-btn');
    toggleBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(toggleBtn.dataset.clusterIndex || '0', 10);
      viewer.toggleCluster(clusterIndex);
    });

    // Wire up focus button
    const focusBtn = document.getElementById('focus-cluster-btn');
    focusBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(focusBtn.dataset.clusterIndex || '0', 10);
      viewer.focusOnCluster(clusterIndex);
    });

    // Wire up copy turn button
    const copyTurnBtn = document.getElementById('copy-turn-btn');
    copyTurnBtn?.addEventListener('click', async () => {
      const clusterIndex = parseInt(copyTurnBtn.dataset.clusterIndex || '0', 10);
      const searchable = viewer.getSearchableContent();
      const cluster = searchable[clusterIndex];
      if (!cluster) return;

      // Build text content for this turn
      let text = `Turn ${clusterIndex + 1}\n${'='.repeat(40)}\n\n`;
      if (cluster.userText) {
        text += `USER:\n${cluster.userText}\n\n`;
      }
      if (cluster.thinkingBlocks.length > 0) {
        for (const thinking of cluster.thinkingBlocks) {
          text += `THINKING:\n${thinking}\n\n`;
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

      try {
        await navigator.clipboard.writeText(text);
        copyTurnBtn.textContent = 'Copied!';
        setTimeout(() => { copyTurnBtn.textContent = 'Copy'; }, 1500);
      } catch {
        console.error('Failed to copy');
      }
    });

    // Wire up prev/next turn buttons
    const prevBtn = document.getElementById('prev-turn-btn');
    prevBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(prevBtn.dataset.clusterIndex || '0', 10);
      if (clusterIndex > 0) {
        viewer.selectClusterByIndex(clusterIndex - 1);
      }
    });

    const nextBtn = document.getElementById('next-turn-btn');
    nextBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(nextBtn.dataset.clusterIndex || '0', 10);
      if (clusterIndex < viewer.getClusterCount() - 1) {
        viewer.selectClusterByIndex(clusterIndex + 1);
      }
    });

    // Wire up collapse parent button
    const collapseBtn = document.getElementById('collapse-parent-btn');
    collapseBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(collapseBtn.dataset.clusterIndex || '0', 10);
      viewer.toggleCluster(clusterIndex);
    });

    // Wire up raw data toggle
    const rawToggleBtn = document.getElementById('toggle-raw-btn');
    const rawDataContent = document.getElementById('raw-data-content');
    rawToggleBtn?.addEventListener('click', () => {
      if (rawDataContent) {
        const isHidden = rawDataContent.style.display === 'none';
        rawDataContent.style.display = isHidden ? 'block' : 'none';
        rawToggleBtn.textContent = isHidden ? 'Hide Raw Data' : 'Show Raw Data';
      }
    });

    // Wire up copy buttons
    detailPanelContent.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const copyId = (btn as HTMLElement).dataset.copyId;
        if (!copyId || !copyableContent[copyId]) return;

        try {
          await navigator.clipboard.writeText(copyableContent[copyId]);
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1500);
        } catch (err) {
          console.error('Failed to copy:', err);
          btn.textContent = 'Failed';
          setTimeout(() => {
            btn.textContent = 'Copy';
          }, 1500);
        }
      });
    });
  }
});

// Redraw charts on window resize
window.addEventListener('resize', () => {
  drawCharts(currentFocusIndex);
});

// Redraw charts when sidebar is resized
if (sidebar) {
  const resizeObserver = new ResizeObserver(() => {
    // Small delay to let layout settle
    requestAnimationFrame(() => {
      drawCharts(currentFocusIndex);
    });
  });
  resizeObserver.observe(sidebar);
}

// ============================================
// Word Frequency Analysis
// ============================================

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

// Track which words are currently highlighted
const highlightedWords = new Map<string, number>(); // word -> color

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
function extractWords(text: string): Map<string, number> {
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
 * Get word frequencies for the conversation
 */
function getWordFrequencies(source: 'all' | 'user' | 'assistant' | 'thinking'): Array<{ word: string; count: number }> {
  const searchableContent = viewer.getSearchableContent();
  const allWords = new Map<string, number>();

  for (const cluster of searchableContent) {
    let textsToAnalyze: string[] = [];

    if (source === 'all' || source === 'user') {
      if (cluster.userText) textsToAnalyze.push(cluster.userText);
    }

    if (source === 'all' || source === 'assistant') {
      if (cluster.assistantText) textsToAnalyze.push(cluster.assistantText);
    }

    if (source === 'all' || source === 'thinking') {
      textsToAnalyze.push(...cluster.thinkingBlocks);
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
function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/**
 * Toggle word highlight
 */
function toggleWordHighlight(word: string, colorIndex: number): void {
  const color = WORD_HIGHLIGHT_COLORS[colorIndex % WORD_HIGHLIGHT_COLORS.length];

  if (highlightedWords.has(word)) {
    // Unhighlight
    viewer.unhighlightClustersByColor(highlightedWords.get(word)!);
    highlightedWords.delete(word);
  } else {
    // Highlight
    const matchedClusters = viewer.highlightClustersWithWord(word, color);
    if (matchedClusters.length > 0) {
      highlightedWords.set(word, color);
    }
  }

  // Update UI to reflect active state
  updateWordFreqActiveStates();
}

/**
 * Update active states on word frequency rows
 */
function updateWordFreqActiveStates(): void {
  if (!wordFreqChart) return;

  wordFreqChart.querySelectorAll('.word-freq-row').forEach((row) => {
    const word = (row as HTMLElement).dataset.word;
    if (word && highlightedWords.has(word)) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
}

/**
 * Clear all word highlights
 */
function clearWordHighlights(): void {
  viewer.clearAllHighlights();
  highlightedWords.clear();
  updateWordFreqActiveStates();
}

/**
 * Render word frequency chart
 */
function renderWordFrequencyChart(): void {
  if (!wordFreqChart) return;

  // Clear highlights when re-rendering (source changed)
  clearWordHighlights();

  const source = (wordFreqSource?.value || 'all') as 'all' | 'user' | 'assistant' | 'thinking';
  const frequencies = getWordFrequencies(source);

  if (frequencies.length === 0) {
    wordFreqChart.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; padding: 20px;">No words found</div>';
    return;
  }

  const maxCount = frequencies[0].count;

  const html = frequencies.map(({ word, count }, index) => {
    const percentage = (count / maxCount) * 100;
    const color = WORD_HIGHLIGHT_COLORS[index % WORD_HIGHLIGHT_COLORS.length];
    const colorCSS = hexToCSS(color);
    const isActive = highlightedWords.has(word);

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

  wordFreqChart.innerHTML = html;

  // Wire up click handlers
  wordFreqChart.querySelectorAll('.word-freq-row').forEach((row) => {
    row.addEventListener('click', () => {
      const word = (row as HTMLElement).dataset.word;
      const colorIndex = parseInt((row as HTMLElement).dataset.colorIndex || '0', 10);
      if (word) {
        toggleWordHighlight(word, colorIndex);
      }
    });
  });
}

// Word frequency is now in sidebar - no positioning needed


// Wire up word frequency source selector
if (wordFreqSource) {
  wordFreqSource.addEventListener('change', renderWordFrequencyChart);
}

// ============================================
// Split Pane Resizing
// ============================================

let isSplitDragging = false;

if (splitHandle && canvasPane && conversationPane && contentArea) {
  splitHandle.addEventListener('mousedown', (e) => {
    isSplitDragging = true;
    splitHandle.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isSplitDragging) return;

    // Get position relative to content area, not viewport
    const contentRect = contentArea.getBoundingClientRect();
    const relativeX = e.clientX - contentRect.left;
    const containerWidth = contentRect.width;
    const minCanvasWidth = 300;
    const minConvWidth = 250;

    if (relativeX >= minCanvasWidth && (containerWidth - relativeX - 6) >= minConvWidth) {
      canvasPane.style.flex = 'none';
      canvasPane.style.width = `${relativeX}px`;
      conversationPane.style.width = `${containerWidth - relativeX - 6}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isSplitDragging) {
      isSplitDragging = false;
      splitHandle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Trigger resize for Three.js canvas
      window.dispatchEvent(new Event('resize'));
    }
  });
}

// ============================================
// Conversation View
// ============================================

let isScrollingProgrammatically = false;
let selectionFromConversationScroll = false;
let scrollLockTimeout: ReturnType<typeof setTimeout> | null = null;

// Conversation filter state (default: user and output visible)
const conversationFilterState = {
  user: true,
  output: true,
  thinking: false,
  tools: false,
};

/**
 * Apply conversation filters to hide/show elements
 */
function applyConversationFilters(): void {
  if (!conversationContent) return;

  // Apply visibility based on filter state
  conversationContent.querySelectorAll('.conv-user').forEach((el) => {
    (el as HTMLElement).style.display = conversationFilterState.user ? '' : 'none';
  });
  conversationContent.querySelectorAll('.conv-text').forEach((el) => {
    (el as HTMLElement).style.display = conversationFilterState.output ? '' : 'none';
  });
  conversationContent.querySelectorAll('.conv-thinking').forEach((el) => {
    (el as HTMLElement).style.display = conversationFilterState.thinking ? '' : 'none';
  });
  conversationContent.querySelectorAll('.conv-tool').forEach((el) => {
    (el as HTMLElement).style.display = conversationFilterState.tools ? '' : 'none';
  });
}

/**
 * Render the conversation in the side panel
 */
function renderConversation(): void {
  if (!conversationContent) return;

  const conversation = viewer.getConversation();
  if (!conversation) {
    conversationContent.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">No conversation loaded</div>';
    return;
  }

  const clusterCount = viewer.getClusterCount();
  const searchableContent = viewer.getSearchableContent();

  let html = '';

  for (let i = 0; i < searchableContent.length; i++) {
    const cluster = searchableContent[i];

    html += `<div class="conv-turn" data-cluster-index="${i}">`;

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

  conversationContent.innerHTML = html;

  // Wire up collapsible sections
  conversationContent.querySelectorAll('.conv-thinking-header, .conv-tool-header, .conv-user-header, .conv-text-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = header.parentElement;
      parent?.classList.toggle('expanded');
    });
  });

  // Check which content wraps actually overflow and need truncation
  conversationContent.querySelectorAll('.conv-content-wrap').forEach((wrap) => {
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

  // Wire up "More" buttons for truncated content
  conversationContent.querySelectorAll('.conv-expand-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = btn.parentElement;
      wrap?.classList.remove('needs-truncation');
      wrap?.classList.add('full');
    });
  });

  // Wire up turn click to select in 3D
  conversationContent.querySelectorAll('.conv-turn').forEach((turn) => {
    turn.addEventListener('click', () => {
      const clusterIndex = parseInt((turn as HTMLElement).dataset.clusterIndex || '0', 10);

      // Lock scroll sync briefly since we're already at this turn
      isScrollingProgrammatically = true;
      if (scrollLockTimeout) clearTimeout(scrollLockTimeout);

      // Highlight this turn
      conversationContent!.querySelectorAll('.conv-turn.focused').forEach((t) => t.classList.remove('focused'));
      turn.classList.add('focused');

      // Select in 3D (this will try to scroll back to us, but we're locked)
      viewer.selectClusterByIndex(clusterIndex);

      // Unlock after a short delay
      scrollLockTimeout = setTimeout(() => {
        isScrollingProgrammatically = false;
      }, 300);
    });
  });

  // Setup scroll sync (conversation scroll → 3D selection)
  setupScrollSync();

  // Update turn indicator
  if (conversationTurnIndicator) {
    conversationTurnIndicator.textContent = `${clusterCount} turns`;
  }

  // Apply visibility filters
  applyConversationFilters();
}

// Wire up conversation filter toggles
if (conversationFilters) {
  conversationFilters.querySelectorAll('.conv-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLElement).dataset.filter as keyof typeof conversationFilterState;
      if (!filter) return;

      // Toggle filter state
      conversationFilterState[filter] = !conversationFilterState[filter];

      // Update button active state
      btn.classList.toggle('active', conversationFilterState[filter]);

      // Apply filters
      applyConversationFilters();
    });
  });
}

/**
 * Filter conversation to show only specific clusters
 * Pass null to show all clusters
 */
function filterConversation(clusterIndices: number[] | null): void {
  if (!conversationContent) return;

  const turns = conversationContent.querySelectorAll('.conv-turn');

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
 * Setup scroll sync - scrolling conversation selects 3D node
 */
function setupScrollSync(): void {
  if (!conversationContent) return;

  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  conversationContent.addEventListener('scroll', () => {
    // Skip if we're programmatically scrolling (from 3D selection)
    if (isScrollingProgrammatically) {
      return;
    }

    // Debounce scroll handling
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // Double-check we're not in programmatic scroll
      if (isScrollingProgrammatically) return;

      const turns = conversationContent.querySelectorAll('.conv-turn');
      const containerRect = conversationContent.getBoundingClientRect();
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
        selectionFromConversationScroll = true;
        viewer.selectClusterByIndex(clusterIndex);

        // Update focus highlight without scrolling
        conversationContent.querySelectorAll('.conv-turn.focused').forEach((t) => t.classList.remove('focused'));
        (closestTurn as Element).classList.add('focused');
      }
    }, 150);
  });
}

/**
 * Scroll conversation to a specific cluster
 */
function scrollConversationToCluster(clusterIndex: number): void {
  if (!conversationContent) return;

  // If selection came from conversation scroll, don't scroll back
  if (selectionFromConversationScroll) {
    selectionFromConversationScroll = false;
    return;
  }

  const turn = conversationContent.querySelector(`.conv-turn[data-cluster-index="${clusterIndex}"]`);
  if (turn) {
    // Lock scroll sync to prevent feedback loop
    isScrollingProgrammatically = true;

    // Clear any existing timeout
    if (scrollLockTimeout) clearTimeout(scrollLockTimeout);

    // Remove previous focus
    conversationContent.querySelectorAll('.conv-turn.focused').forEach((t) => t.classList.remove('focused'));
    // Add focus to current
    turn.classList.add('focused');
    // Smooth scroll into view
    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Unlock after scroll animation completes (give it plenty of time)
    scrollLockTimeout = setTimeout(() => {
      isScrollingProgrammatically = false;
    }, 600);
  }
}

// Render conversation when view mode applies it
// (applyViewMode handles visibility)

// ============================================
// Search Functionality
// ============================================

interface SearchResult {
  type: 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result';
  clusterIndex: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

let searchResults: SearchResult[] = [];
let currentSearchIndex = -1;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let regexMode = false;
let searchHighlightedClusters: number[] = [];
const SEARCH_HIGHLIGHT_COLOR = 0xff6b6b; // Coral red for search highlights

/**
 * Get enabled search filters from checkboxes
 */
function getSearchFilters(): Set<string> {
  const filters = new Set<string>();

  document.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
    const input = checkbox as HTMLInputElement;
    if (input.checked && input.dataset.type) {
      filters.add(input.dataset.type);
    }
  });

  return filters;
}

/**
 * Find first match in text and return context snippet
 * Supports both plain text (case-insensitive) and regex modes
 */
function findMatch(text: string, query: string, useRegex: boolean): { found: boolean; snippet: string; start: number; end: number } {
  let matchIndex = -1;
  let matchLength = 0;

  if (useRegex) {
    try {
      const regex = new RegExp(query, 'i'); // case-insensitive
      const match = text.match(regex);
      if (match && match.index !== undefined) {
        matchIndex = match.index;
        matchLength = match[0].length;
      }
    } catch {
      // Invalid regex - no match
      return { found: false, snippet: '', start: -1, end: -1 };
    }
  } else {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    matchIndex = lowerText.indexOf(lowerQuery);
    matchLength = query.length;
  }

  if (matchIndex === -1) {
    return { found: false, snippet: '', start: -1, end: -1 };
  }

  // Extract context around match
  const snippetStart = Math.max(0, matchIndex - 30);
  const snippetEnd = Math.min(text.length, matchIndex + matchLength + 50);
  let snippet = text.slice(snippetStart, snippetEnd);

  // Add ellipsis if truncated
  if (snippetStart > 0) snippet = '...' + snippet;
  if (snippetEnd < text.length) snippet = snippet + '...';

  return { found: true, snippet, start: matchIndex, end: matchIndex + matchLength };
}

/**
 * Validate regex pattern
 */
function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

/**
 * Perform search across all clusters using the Viewer's searchable content
 */
function performSearch(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  if (!query.trim()) return results;

  // Validate regex if in regex mode
  if (regexMode && !isValidRegex(query)) {
    return results;
  }

  const filters = getSearchFilters();
  const searchableContent = viewer.getSearchableContent();

  for (const cluster of searchableContent) {
    // Search user text
    if (filters.has('user') && cluster.userText) {
      const match = findMatch(cluster.userText, query, regexMode);
      if (match.found) {
        results.push({
          type: 'user',
          clusterIndex: cluster.clusterIndex,
          text: match.snippet,
          matchStart: match.start,
          matchEnd: match.end,
        });
      }
    }

    // Search assistant text
    if (filters.has('assistant') && cluster.assistantText) {
      const match = findMatch(cluster.assistantText, query, regexMode);
      if (match.found) {
        results.push({
          type: 'assistant',
          clusterIndex: cluster.clusterIndex,
          text: match.snippet,
          matchStart: match.start,
          matchEnd: match.end,
        });
      }
    }

    // Search thinking blocks
    if (filters.has('thinking')) {
      for (const thinking of cluster.thinkingBlocks) {
        const match = findMatch(thinking, query, regexMode);
        if (match.found) {
          results.push({
            type: 'thinking',
            clusterIndex: cluster.clusterIndex,
            text: match.snippet,
            matchStart: match.start,
            matchEnd: match.end,
          });
        }
      }
    }

    // Search tool uses
    if (filters.has('tool_use')) {
      for (const toolUse of cluster.toolUses) {
        const searchText = `${toolUse.name} ${toolUse.input}`;
        const match = findMatch(searchText, query, regexMode);
        if (match.found) {
          results.push({
            type: 'tool_use',
            clusterIndex: cluster.clusterIndex,
            text: match.snippet,
            matchStart: match.start,
            matchEnd: match.end,
          });
        }
      }
    }

    // Search tool results
    if (filters.has('tool_result')) {
      for (const toolResult of cluster.toolResults) {
        const match = findMatch(toolResult.content, query, regexMode);
        if (match.found) {
          results.push({
            type: 'tool_result',
            clusterIndex: cluster.clusterIndex,
            text: match.snippet,
            matchStart: match.start,
            matchEnd: match.end,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtmlSearch(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight search query in snippet
 */
function highlightSnippet(snippet: string, query: string): string {
  if (!query) return escapeHtmlSearch(snippet);

  const lowerSnippet = snippet.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerSnippet.indexOf(lowerQuery);

  if (index === -1) return escapeHtmlSearch(snippet);

  const before = snippet.slice(0, index);
  const match = snippet.slice(index, index + query.length);
  const after = snippet.slice(index + query.length);

  return `${escapeHtmlSearch(before)}<mark>${escapeHtmlSearch(match)}</mark>${escapeHtmlSearch(after)}`;
}

/**
 * Render search results list
 */
function renderSearchResults(): void {
  if (!searchResultsList) return;

  if (searchResults.length === 0) {
    searchResultsList.classList.remove('has-results');
    searchResultsList.innerHTML = '';
    return;
  }

  searchResultsList.classList.add('has-results');

  const query = searchInput?.value || '';
  const clusterCount = viewer.getClusterCount();

  const html = searchResults.map((result, index) => {
    const isActive = index === currentSearchIndex;
    const typeLabel = result.type.replace('_', ' ');

    return `
      <div class="search-result-item ${result.type} ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="search-result-meta">
          <span class="search-result-type ${result.type}">${typeLabel}</span>
          <span class="search-result-turn">Turn ${result.clusterIndex + 1}/${clusterCount}</span>
        </div>
        <div class="search-result-snippet">${highlightSnippet(result.text, query)}</div>
      </div>
    `;
  }).join('');

  searchResultsList.innerHTML = html;

  // Wire up click handlers
  searchResultsList.querySelectorAll('.search-result-item').forEach((item) => {
    item.addEventListener('click', () => {
      const index = parseInt((item as HTMLElement).dataset.index || '0', 10);
      navigateToResult(index);
    });
  });

  // Scroll active item into view
  const activeItem = searchResultsList.querySelector('.search-result-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Update search results display
 */
function updateSearchUI(): void {
  if (!searchResultsCount) return;

  if (searchResults.length === 0) {
    const query = searchInput?.value || '';
    searchResultsCount.textContent = query ? 'No matches' : '';
  } else {
    searchResultsCount.textContent = `${currentSearchIndex + 1} / ${searchResults.length}`;
  }

  // Update button states
  const hasResults = searchResults.length > 0;
  if (searchPrevBtn) (searchPrevBtn as HTMLButtonElement).disabled = !hasResults;
  if (searchNextBtn) (searchNextBtn as HTMLButtonElement).disabled = !hasResults;

  // Update results list active state
  if (searchResultsList) {
    searchResultsList.querySelectorAll('.search-result-item').forEach((item, index) => {
      if (index === currentSearchIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
      }
    });
  }
}

/**
 * Navigate to a search result
 */
function navigateToResult(index: number): void {
  if (index < 0 || index >= searchResults.length) return;

  currentSearchIndex = index;
  const result = searchResults[index];

  // Select the cluster in the viewer
  viewer.selectClusterByIndex(result.clusterIndex);

  updateSearchUI();
}

/**
 * Go to next search result
 */
function searchNext(): void {
  if (searchResults.length === 0) return;
  const nextIndex = (currentSearchIndex + 1) % searchResults.length;
  navigateToResult(nextIndex);
}

/**
 * Go to previous search result
 */
function searchPrev(): void {
  if (searchResults.length === 0) return;
  const prevIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
  navigateToResult(prevIndex);
}

/**
 * Clear search
 */
function clearSearch(): void {
  if (searchInput) {
    searchInput.value = '';
    searchInput.classList.remove('regex-error');
  }
  searchResults = [];
  currentSearchIndex = -1;

  // Clear search highlights
  for (const clusterIndex of searchHighlightedClusters) {
    viewer.unhighlightCluster(clusterIndex);
  }
  searchHighlightedClusters = [];

  // Clear filters
  viewer.setSearchFilter(null);
  filterConversation(null);

  renderSearchResults();
  updateSearchUI();
}

/**
 * Handle search input change (debounced)
 */
function handleSearchInput(): void {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

  searchDebounceTimer = setTimeout(() => {
    const query = searchInput?.value || '';

    // Update regex error styling
    if (searchInput) {
      if (regexMode && query && !isValidRegex(query)) {
        searchInput.classList.add('regex-error');
      } else {
        searchInput.classList.remove('regex-error');
      }
    }

    searchResults = performSearch(query);
    currentSearchIndex = searchResults.length > 0 ? 0 : -1;

    // Clear previous search highlights
    for (const clusterIndex of searchHighlightedClusters) {
      viewer.unhighlightCluster(clusterIndex);
    }
    searchHighlightedClusters = [];

    // Apply search filter and highlights to 3D view and conversation
    if (searchResults.length > 0) {
      const matchingClusters = [...new Set(searchResults.map(r => r.clusterIndex))];
      viewer.setSearchFilter(matchingClusters);
      filterConversation(matchingClusters);

      // Highlight matching clusters
      for (const clusterIndex of matchingClusters) {
        viewer.highlightCluster(clusterIndex, SEARCH_HIGHLIGHT_COLOR);
        searchHighlightedClusters.push(clusterIndex);
      }
    } else {
      viewer.setSearchFilter(null);
      filterConversation(null);
    }

    // Render the results list
    renderSearchResults();

    // Navigate to first result
    if (searchResults.length > 0) {
      navigateToResult(0);
    } else {
      updateSearchUI();
    }
  }, 200);
}

// Wire up search UI
if (searchInput) {
  searchInput.addEventListener('input', handleSearchInput);

  // Handle Enter/Shift+Enter for navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        searchPrev();
      } else {
        searchNext();
      }
    } else if (e.key === 'Escape') {
      clearSearch();
      searchInput.blur();
    }
  });
}

if (searchPrevBtn) {
  searchPrevBtn.addEventListener('click', searchPrev);
}

if (searchNextBtn) {
  searchNextBtn.addEventListener('click', searchNext);
}

if (searchClearBtn) {
  searchClearBtn.addEventListener('click', clearSearch);
}

// Wire up regex toggle
if (searchRegexToggle) {
  searchRegexToggle.addEventListener('click', () => {
    regexMode = !regexMode;
    searchRegexToggle.classList.toggle('active', regexMode);

    // Update placeholder to indicate mode
    if (searchInput) {
      searchInput.placeholder = regexMode ? 'Regex search... (/)' : 'Search... (/)';
    }

    // Re-run search with new mode
    handleSearchInput();
  });
}

// Wire up filter checkboxes to re-search
// Wire up search filter checkboxes
document.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
  checkbox.addEventListener('change', handleSearchInput);
});

// Global keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // Don't trigger if already in an input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  // / - Focus search (when sidebar visible)
  if (e.key === '/' && searchInput && sidebarVisible) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }

  // H - Home view (restore saved camera state)
  if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    if (savedCameraState) {
      viewer.setCameraState(savedCameraState.position, savedCameraState.target);
    } else {
      // If no saved state, use initial view
      viewer.setInitialView();
    }
  }

  // R - Reset to initial view
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    viewer.setInitialView();
  }
});

// ============================================
// Export Functionality
// ============================================

/**
 * Generate HTML export of the conversation
 */
function exportAsHtml(): string {
  const searchableContent = viewer.getSearchableContent();
  const conversation = viewer.getConversation();
  const title = conversation?.meta?.title || 'Conversation Export';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    h1 { border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    .turn { margin-bottom: 30px; background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .user { background: #e3f2fd; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
    .user-label { font-weight: 600; color: #1565c0; margin-bottom: 5px; }
    .assistant { }
    .thinking { background: #fff3e0; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .thinking-header { font-weight: 600; color: #e65100; margin-bottom: 5px; cursor: pointer; }
    .thinking-content { white-space: pre-wrap; font-size: 14px; color: #666; }
    .tool { background: #f3e5f5; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .tool-header { font-weight: 600; color: #7b1fa2; margin-bottom: 5px; }
    .tool-content { white-space: pre-wrap; font-size: 13px; font-family: monospace; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 4px; overflow-x: auto; }
    .tool-result { background: #e8f5e9; }
    .tool-result .tool-header { color: #2e7d32; }
    .tool-error { background: #ffebee; }
    .tool-error .tool-header { color: #c62828; }
    .text { }
    .meta { color: #666; font-size: 12px; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
    /* Markdown content */
    .user > div:last-child, .text, .thinking-content { line-height: 1.6; }
    .user > div:last-child p, .text p { margin: 0 0 0.75em 0; }
    .user > div:last-child p:last-child, .text p:last-child { margin-bottom: 0; }
    code { background: rgba(0,0,0,0.08); padding: 0.15em 0.4em; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
    pre { background: rgba(0,0,0,0.08); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0.75em 0; }
    pre code { background: none; padding: 0; }
    blockquote { margin: 0.75em 0; padding: 0.5em 1em; border-left: 3px solid #ddd; background: rgba(0,0,0,0.03); }
    ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
    table { border-collapse: collapse; margin: 0.75em 0; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; }
    th { background: rgba(0,0,0,0.05); }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
`;

  for (let i = 0; i < searchableContent.length; i++) {
    const cluster = searchableContent[i];
    html += `  <div class="turn">\n`;

    // User message
    if (cluster.userText) {
      html += `    <div class="user">
      <div class="user-label">User</div>
      <div>${renderMarkdown(cluster.userText)}</div>
    </div>\n`;
    }

    // Assistant section
    html += `    <div class="assistant">\n`;

    // Thinking blocks
    for (const thinking of cluster.thinkingBlocks) {
      html += `      <details class="thinking">
        <summary class="thinking-header">Thinking (${thinking.length.toLocaleString()} chars)</summary>
        <div class="thinking-content">${renderMarkdown(thinking)}</div>
      </details>\n`;
    }

    // Tool calls and results
    for (let t = 0; t < cluster.toolUses.length; t++) {
      const toolUse = cluster.toolUses[t];
      html += `      <details class="tool">
        <summary class="tool-header">Tool: ${escapeHtml(toolUse.name)}</summary>
        <div class="tool-content">${escapeHtml(toolUse.input)}</div>
      </details>\n`;

      if (t < cluster.toolResults.length) {
        const toolResult = cluster.toolResults[t];
        const resultClass = toolResult.isError ? 'tool tool-error' : 'tool tool-result';
        html += `      <details class="${resultClass}">
        <summary class="tool-header">${toolResult.isError ? 'Error' : 'Result'}</summary>
        <div class="tool-content">${escapeHtml(toolResult.content)}</div>
      </details>\n`;
      }
    }

    // Assistant text
    if (cluster.assistantText) {
      html += `      <div class="text">${renderMarkdown(cluster.assistantText)}</div>\n`;
    }

    html += `    </div>\n`;
    html += `  </div>\n`;
  }

  html += `  <div class="meta">Exported from Thinking Tracer on ${new Date().toLocaleString()}</div>
</body>
</html>`;

  return html;
}

/**
 * Generate Markdown export of the conversation
 */
function exportAsMarkdown(): string {
  const searchableContent = viewer.getSearchableContent();
  const conversation = viewer.getConversation();
  const title = conversation?.meta?.title || 'Conversation Export';

  let md = `# ${title}\n\n`;

  for (let i = 0; i < searchableContent.length; i++) {
    const cluster = searchableContent[i];
    md += `---\n\n`;
    md += `## Turn ${i + 1}\n\n`;

    // User message
    if (cluster.userText) {
      md += `### User\n\n${cluster.userText}\n\n`;
    }

    // Assistant section
    md += `### Assistant\n\n`;

    // Thinking blocks
    for (let t = 0; t < cluster.thinkingBlocks.length; t++) {
      const thinking = cluster.thinkingBlocks[t];
      md += `<details>\n<summary>Thinking (${thinking.length.toLocaleString()} chars)</summary>\n\n\`\`\`\n${thinking}\n\`\`\`\n\n</details>\n\n`;
    }

    // Tool calls and results
    for (let t = 0; t < cluster.toolUses.length; t++) {
      const toolUse = cluster.toolUses[t];
      md += `<details>\n<summary>Tool: ${toolUse.name}</summary>\n\n\`\`\`\n${toolUse.input}\n\`\`\`\n\n</details>\n\n`;

      if (t < cluster.toolResults.length) {
        const toolResult = cluster.toolResults[t];
        const label = toolResult.isError ? 'Error' : 'Result';
        md += `<details>\n<summary>${label}</summary>\n\n\`\`\`\n${toolResult.content}\n\`\`\`\n\n</details>\n\n`;
      }
    }

    // Assistant text
    if (cluster.assistantText) {
      md += `${cluster.assistantText}\n\n`;
    }
  }

  md += `---\n\n*Exported from Thinking Tracer on ${new Date().toLocaleString()}*\n`;

  return md;
}

/**
 * Trigger a file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get a safe filename from the conversation title
 */
function getSafeFilename(title: string): string {
  return title
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
    .toLowerCase() || 'conversation';
}

// Export button dropdown toggle
if (exportBtn && exportDropdown) {
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    exportDropdown.classList.remove('open');
  });
}

// Export menu options
if (exportMenu) {
  exportMenu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const format = target.dataset.format;

    if (!format) return;

    const conversation = viewer.getConversation();
    const title = conversation?.meta?.title || 'conversation';
    const safeFilename = getSafeFilename(title);

    if (format === 'html') {
      const html = exportAsHtml();
      downloadFile(html, `${safeFilename}.html`, 'text/html');
    } else if (format === 'markdown') {
      const md = exportAsMarkdown();
      downloadFile(md, `${safeFilename}.md`, 'text/markdown');
    }

    exportDropdown?.classList.remove('open');
  });
}

// Load recent traces on startup
refreshRecentTraces();

// Save UI state before leaving
window.addEventListener('beforeunload', () => {
  // Use synchronous-ish approach - fire and forget
  // IndexedDB operations will likely complete before page closes
  if (currentTraceId) {
    const uiState = getCurrentUIState();
    updateTraceUIState(currentTraceId, uiState).catch(() => {
      // Ignore errors on unload
    });
  }
});

// Also save periodically while using (every 30 seconds if there's a trace loaded)
setInterval(() => {
  if (currentTraceId) {
    saveCurrentUIState();
  }
}, 30000);

// Log ready state
console.log('Thinking Tracer ready');
console.log('Drop a Claude Code conversation file to visualize');

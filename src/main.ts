/**
 * Standalone viewer entry point
 */

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
import {
  exportAsHtml,
  exportAsMarkdown,
  downloadFile,
  getSafeFilename,
  escapeHtml,
} from './export';
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
} from './search';
import { MetricsPanel, DetailPanel, WordFrequencyPanel, ConversationPanel } from './ui';
import type { Selection } from './ui';

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
const coilControlsToggle = document.getElementById('coil-controls-toggle');
const coilControlsPanel = document.getElementById('coil-controls');
const coilResetBtn = document.getElementById('coil-reset-btn');
const coilSliders = document.querySelectorAll('.coil-slider');
const clusterLinesToggle = document.getElementById('cluster-lines-toggle') as HTMLInputElement | null;
const clusterLineOptions = document.getElementById('cluster-line-options');
const clusterLineColor = document.getElementById('cluster-line-color') as HTMLInputElement | null;
const clusterLineColorValue = document.getElementById('cluster-line-color-value');
const clusterLineWidth = document.getElementById('cluster-line-width') as HTMLInputElement | null;
const clusterLineWidthValue = document.getElementById('cluster-line-width-value');
const clusterLineOpacity = document.getElementById('cluster-line-opacity') as HTMLInputElement | null;
const clusterLineOpacityValue = document.getElementById('cluster-line-opacity-value');

// Track expanded state
let allExpanded = false;

// Chart state
let currentFocusIndex = 0;
let metricsPanel: MetricsPanel | null = null;
let detailPanel: DetailPanel | null = null;
let wordFrequencyPanel: WordFrequencyPanel | null = null;
let conversationPanel: ConversationPanel | null = null;

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

// Create metrics panel
if (metricsStack) {
  metricsPanel = new MetricsPanel(
    {
      container: metricsStack,
      rangeLabel: chartRange,
      tooltip: chartTooltip,
    },
    viewer
  );
}

// Create detail panel
if (detailPanelContent) {
  detailPanel = new DetailPanel({ container: detailPanelContent }, viewer);
}

// Create word frequency panel
if (wordFreqChart) {
  wordFrequencyPanel = new WordFrequencyPanel(
    { container: wordFreqChart, sourceSelect: wordFreqSource },
    viewer
  );
}

// Create conversation panel
if (conversationContent) {
  conversationPanel = new ConversationPanel(
    {
      container: conversationContent,
      turnIndicator: conversationTurnIndicator,
      filtersContainer: conversationFilters,
    },
    viewer
  );
}

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
      metricsPanel?.draw(currentFocusIndex);
      wordFrequencyPanel?.render();

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

  // Hide legend, canvas controls, and coil controls
  if (legend) {
    legend.classList.remove('visible');
  }
  if (canvasControls) {
    canvasControls.classList.remove('visible');
  }
  if (coilControlsPanel) {
    coilControlsPanel.classList.remove('visible');
    coilControlsToggle?.classList.remove('active');
  }

  // Hide sidebar
  sidebar?.classList.remove('visible');

  // Hide conversation pane
  conversationPane?.classList.remove('visible');
  splitHandle?.classList.remove('visible');

  viewer.clearSelection();
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
      conversationPanel?.render();
      break;
    case 'conversation':
      canvasPane?.classList.add('hidden');
      conversationPane?.classList.add('visible', 'full-width');
      splitHandle?.classList.remove('visible');
      legend?.classList.remove('visible');
      conversationPanel?.render();
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

// Wire up coil controls toggle
if (coilControlsToggle && coilControlsPanel) {
  coilControlsToggle.addEventListener('click', () => {
    const isVisible = coilControlsPanel.classList.toggle('visible');
    coilControlsToggle.classList.toggle('active', isVisible);

    // Initialize slider values when opening
    if (isVisible) {
      updateCoilSliders();
    }
  });
}

// Wire up coil reset button
if (coilResetBtn) {
  coilResetBtn.addEventListener('click', () => {
    viewer.resetCoilParams();
    updateCoilSliders();
  });
}

// Wire up cluster lines toggle
if (clusterLinesToggle) {
  clusterLinesToggle.addEventListener('change', () => {
    viewer.setShowClusterLines(clusterLinesToggle.checked);
    // Show/hide line options
    if (clusterLineOptions) {
      clusterLineOptions.classList.toggle('visible', clusterLinesToggle.checked);
    }
  });
}

// Wire up cluster line color
if (clusterLineColor) {
  clusterLineColor.addEventListener('input', () => {
    const hex = parseInt(clusterLineColor.value.slice(1), 16);
    viewer.setClusterLineColor(hex);
    if (clusterLineColorValue) {
      clusterLineColorValue.textContent = clusterLineColor.value.toUpperCase();
    }
  });
}

// Wire up cluster line width
if (clusterLineWidth) {
  clusterLineWidth.addEventListener('input', () => {
    const width = parseFloat(clusterLineWidth.value);
    viewer.setClusterLineWidth(width);
    if (clusterLineWidthValue) {
      clusterLineWidthValue.textContent = String(Math.round(width));
    }
  });
}

// Wire up cluster line opacity
if (clusterLineOpacity) {
  clusterLineOpacity.addEventListener('input', () => {
    const opacity = parseFloat(clusterLineOpacity.value);
    viewer.setClusterLineOpacity(opacity);
    if (clusterLineOpacityValue) {
      clusterLineOpacityValue.textContent = opacity.toFixed(2);
    }
  });
}

// Wire up coil sliders
function updateCoilSliders() {
  const params = viewer.getCoilParams();
  coilSliders.forEach((sliderDiv) => {
    const param = (sliderDiv as HTMLElement).dataset.param;
    if (!param) return;
    const input = sliderDiv.querySelector('input') as HTMLInputElement;
    const valueSpan = sliderDiv.querySelector('.coil-value') as HTMLElement;
    if (input && valueSpan && param in params) {
      const value = params[param as keyof typeof params];
      input.value = String(value);
      valueSpan.textContent = value.toFixed(2);
    }
  });

  // Sync cluster lines checkbox and options
  const showLines = viewer.getShowClusterLines();
  if (clusterLinesToggle) {
    clusterLinesToggle.checked = showLines;
  }
  if (clusterLineOptions) {
    clusterLineOptions.classList.toggle('visible', showLines);
  }
  if (clusterLineColor) {
    const colorHex = '#' + viewer.getClusterLineColor().toString(16).padStart(6, '0');
    clusterLineColor.value = colorHex;
    if (clusterLineColorValue) {
      clusterLineColorValue.textContent = colorHex.toUpperCase();
    }
  }
  if (clusterLineWidth && clusterLineWidthValue) {
    const width = viewer.getClusterLineWidth();
    clusterLineWidth.value = String(width);
    clusterLineWidthValue.textContent = String(Math.round(width));
  }
  if (clusterLineOpacity && clusterLineOpacityValue) {
    const opacity = viewer.getClusterLineOpacity();
    clusterLineOpacity.value = String(opacity);
    clusterLineOpacityValue.textContent = opacity.toFixed(2);
  }
}

coilSliders.forEach((sliderDiv) => {
  const param = (sliderDiv as HTMLElement).dataset.param;
  const input = sliderDiv.querySelector('input') as HTMLInputElement;
  const valueSpan = sliderDiv.querySelector('.coil-value') as HTMLElement;

  if (input && param) {
    input.addEventListener('input', () => {
      const value = parseFloat(input.value);
      if (valueSpan) {
        valueSpan.textContent = value.toFixed(2);
      }
      viewer.setCoilParam(param, value);
    });
  }
});

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

// Update charts and conversation when selection changes
viewer.onSelect((selection: Selection | null) => {
  if (selection?.clusterIndex !== undefined) {
    currentFocusIndex = selection.clusterIndex;
    metricsPanel?.draw(currentFocusIndex);

    // Sync conversation scroll to selection
    conversationPanel?.scrollToCluster(selection.clusterIndex);
  }

  // Update detail panel
  detailPanel?.update(selection);
});

// Redraw charts on window resize
window.addEventListener('resize', () => {
  metricsPanel?.draw(currentFocusIndex);
});

// Redraw charts when sidebar is resized
if (sidebar) {
  const resizeObserver = new ResizeObserver(() => {
    // Small delay to let layout settle
    requestAnimationFrame(() => {
      metricsPanel?.draw(currentFocusIndex);
    });
  });
  resizeObserver.observe(sidebar);
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
// Search Functionality
// ============================================

let searchResults: SearchResult[] = [];
let currentSearchIndex = -1;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let regexMode = false;
let searchHighlightedClusters: number[] = [];
const SEARCH_HIGHLIGHT_COLOR = 0xff6b6b; // Coral red for search highlights

/**
 * Get enabled search filters from checkboxes
 */
function getSearchFilters(): Set<SearchContentType> {
  const filters = new Set<SearchContentType>();

  document.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
    const input = checkbox as HTMLInputElement;
    if (input.checked && input.dataset.type) {
      filters.add(input.dataset.type as SearchContentType);
    }
  });

  return filters;
}

/**
 * Run search with current settings
 */
function runSearch(query: string): SearchResult[] {
  const clusters = viewer.getSearchableContent();
  const filters = getSearchFilters();
  return performSearch(clusters, query, { useRegex: regexMode, filters });
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
        <div class="search-result-snippet">${highlightSnippet(result.text, query, regexMode)}</div>
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

  const query = searchInput?.value || '';
  searchResultsCount.textContent = formatResultCount(currentSearchIndex, searchResults.length, !!query);

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
  const nextIndex = getNextResultIndex(currentSearchIndex, searchResults.length);
  if (nextIndex >= 0) navigateToResult(nextIndex);
}

/**
 * Go to previous search result
 */
function searchPrev(): void {
  const prevIndex = getPrevResultIndex(currentSearchIndex, searchResults.length);
  if (prevIndex >= 0) navigateToResult(prevIndex);
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
  conversationPanel?.filter(null);

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

    searchResults = runSearch(query);
    currentSearchIndex = searchResults.length > 0 ? 0 : -1;

    // Clear previous search highlights
    for (const clusterIndex of searchHighlightedClusters) {
      viewer.unhighlightCluster(clusterIndex);
    }
    searchHighlightedClusters = [];

    // Apply search filter and highlights to 3D view and conversation
    if (searchResults.length > 0) {
      const matchingClusters = getMatchingClusters(searchResults);
      viewer.setSearchFilter(matchingClusters);
      conversationPanel?.filter(matchingClusters);

      // Highlight matching clusters
      for (const clusterIndex of matchingClusters) {
        viewer.highlightCluster(clusterIndex, SEARCH_HIGHLIGHT_COLOR);
        searchHighlightedClusters.push(clusterIndex);
      }
    } else {
      viewer.setSearchFilter(null);
      conversationPanel?.filter(null);
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
    const title = conversation?.meta?.title || 'Conversation Export';
    const safeFilename = getSafeFilename(title);
    const clusters = viewer.getSearchableContent();

    if (format === 'html') {
      const html = exportAsHtml(clusters, title);
      downloadFile(html, `${safeFilename}.html`, 'text/html');
    } else if (format === 'markdown') {
      const md = exportAsMarkdown(clusters, title);
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

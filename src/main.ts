/**
 * Standalone viewer entry point
 */

import { Viewer } from './core/Viewer';
import { hashContent } from './utils/hash';
import { escapeHtml } from './export';
import type { SearchableViewer } from './ui';
import {
  MetricsPanel,
  DetailPanel,
  WordFrequencyPanel,
  ConversationPanel,
  CoilControlsPanel,
  FileLoader,
  RecentTracesManager,
  SearchController,
  SidebarController,
  ExportController,
  SplitPaneController,
} from './ui';
import type { Selection, RecentTrace, TraceUIState } from './ui';

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
const coilControlsPanelEl = document.getElementById('coil-controls');
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
let coilControlsPanel: CoilControlsPanel | null = null;
let fileLoader: FileLoader | null = null;
let recentTracesManager: RecentTracesManager | null = null;
let searchController: SearchController | null = null;
let sidebarController: SidebarController | null = null;
let exportController: ExportController | null = null;
let splitPaneController: SplitPaneController | null = null;

// View mode: '3d' | 'split' | 'conversation'
let viewMode: '3d' | 'split' | 'conversation' = 'split';

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
    sidebarVisible: sidebarController?.isVisible() ?? true,
    splitRatio,
    selectedCluster: currentFocusIndex,
  };
}

/**
 * Save current UI state to storage
 */
async function saveCurrentUIState(): Promise<void> {
  if (!currentTraceId || !recentTracesManager) return;

  const uiState = getCurrentUIState();
  await recentTracesManager.updateUIState(currentTraceId, uiState);
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
    sidebarController?.setVisible(uiState.sidebarVisible);
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
      if (recentTracesManager) {
        await recentTracesManager.saveTrace(filename, originalTitle, turnCount, content);
        await recentTracesManager.refresh();
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
    exportController?.enable();

    // Show legend and canvas controls
    if (legend) {
      legend.classList.add('visible');
    }
    if (canvasControls) {
      canvasControls.classList.add('visible');
    }

    // Apply view mode
    applyViewMode();

    // Show sidebar if it should be visible
    if (sidebarController?.isVisible()) {
      sidebarController.show();
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
  if (recentTracesManager) {
    await recentTracesManager.touchTrace(trace);
  }

  // Mark as not a new trace (has saved state)
  isNewTrace = false;

  // Pass custom name if it exists
  await loadFile(trace.content, trace.filename, true, trace.customName);

  // Restore UI state after loading
  if (trace.uiState) {
    restoreUIState(trace.uiState);

    // Apply restored view mode (sidebar state is already applied by restoreUIState)
    applyViewMode();

    // Restore selected cluster in viewer
    if (trace.uiState.selectedCluster !== undefined && trace.uiState.selectedCluster < viewer.getClusterCount()) {
      setTimeout(() => {
        viewer.selectClusterByIndex(trace.uiState!.selectedCluster!);
      }, 100);
    }
  }
}

// Create FileLoader
fileLoader = new FileLoader({
  fileInput: fileInput,
  fileSelectBtn: fileSelectBtn,
  trySampleBtn: trySampleBtn,
  watchToggle: watchToggle,
  dropOverlay: dropOverlay,
  onLoad: loadFile,
  onError: (error) => {
    alert(error.message);
  },
});

// Create RecentTracesManager
recentTracesManager = new RecentTracesManager({
  container: recentTracesEl,
  listElement: recentListEl,
  clearBtn: recentClearBtn,
  onSelect: loadRecentTrace,
});

/**
 * Show the file selector overlay
 */
async function showFileSelector(): Promise<void> {
  // Stop any active file watcher
  fileLoader?.stopWatching();

  // Save current UI state before switching away
  await saveCurrentUIState();

  // Refresh recent traces list
  await recentTracesManager?.refresh();

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
    coilControlsPanel.hide();
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

// Create SidebarController
if (sidebar) {
  sidebarController = new SidebarController({
    elements: {
      sidebar,
      toggleBtn: sidebarToggle,
      resizeHandle: sidebarResize,
      legend,
      legendHeader,
    },
    initialVisible: true,
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

// Wire up coil controls panel
if (coilControlsToggle && coilControlsPanelEl) {
  coilControlsPanel = new CoilControlsPanel(
    {
      toggleBtn: coilControlsToggle,
      panel: coilControlsPanelEl,
      resetBtn: coilResetBtn,
      sliders: coilSliders,
      clusterLinesToggle,
      clusterLineOptions,
      lineColor: clusterLineColor,
      lineColorValue: clusterLineColorValue,
      lineWidth: clusterLineWidth,
      lineWidthValue: clusterLineWidthValue,
      lineOpacity: clusterLineOpacity,
      lineOpacityValue: clusterLineOpacityValue,
    },
    viewer
  );
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
    if (currentTraceId && recentTracesManager) {
      await recentTracesManager.updateCustomName(currentTraceId, customName);
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

if (splitHandle && canvasPane && conversationPane && contentArea) {
  splitPaneController = new SplitPaneController({
    elements: {
      handle: splitHandle,
      primaryPane: canvasPane,
      secondaryPane: conversationPane,
      container: contentArea,
    },
    minPrimaryWidth: 300,
    minSecondaryWidth: 250,
    gapWidth: 6,
    onResizeEnd: () => {
      // Trigger resize for Three.js canvas
      window.dispatchEvent(new Event('resize'));
    },
  });
}

// ============================================
// Search Functionality
// ============================================

// Create SearchController - viewer needs to implement SearchableViewer interface
if (searchInput) {
  // Cast viewer to SearchableViewer (it implements all required methods)
  const searchableViewer: SearchableViewer = {
    getClusterCount: () => viewer.getClusterCount(),
    getSearchableContent: () => viewer.getSearchableContent(),
    selectClusterByIndex: (index) => viewer.selectClusterByIndex(index),
    setSearchFilter: (indices) => viewer.setSearchFilter(indices),
    highlightCluster: (index, color) => viewer.highlightCluster(index, color),
    unhighlightCluster: (index) => viewer.unhighlightCluster(index),
  };

  searchController = new SearchController({
    elements: {
      input: searchInput,
      resultsCount: searchResultsCount,
      resultsList: searchResultsList,
      prevBtn: searchPrevBtn,
      nextBtn: searchNextBtn,
      clearBtn: searchClearBtn,
      regexToggle: searchRegexToggle,
    },
    viewer: searchableViewer,
    conversationPanel: conversationPanel ?? undefined,
    isSidebarVisible: () => sidebarController?.isVisible() ?? true,
  });
}

// ============================================
// Global Keyboard Shortcuts
// ============================================

window.addEventListener('keydown', (e) => {
  // Don't trigger if already in an input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
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

// Create ExportController
if (exportBtn && exportDropdown) {
  exportController = new ExportController({
    elements: {
      exportBtn,
      dropdown: exportDropdown,
      menu: exportMenu,
    },
    dataProvider: {
      getSearchableContent: () => viewer.getSearchableContent(),
      getConversationTitle: () => viewer.getConversation()?.meta?.title,
    },
  });
}

// Load recent traces on startup
recentTracesManager?.refresh();

// Save UI state before leaving and cleanup
window.addEventListener('beforeunload', () => {
  // Use synchronous-ish approach - fire and forget
  // IndexedDB operations will likely complete before page closes
  if (currentTraceId && recentTracesManager) {
    const uiState = getCurrentUIState();
    recentTracesManager.updateUIState(currentTraceId, uiState).catch(() => {
      // Ignore errors on unload
    });
  }

  // Cleanup controllers
  searchController?.dispose();
  coilControlsPanel?.dispose();
  sidebarController?.dispose();
  exportController?.dispose();
  splitPaneController?.dispose();

  // Cleanup panels
  metricsPanel?.dispose();
  detailPanel?.dispose();
  wordFrequencyPanel?.dispose();
  conversationPanel?.dispose();

  // Cleanup loaders
  fileLoader?.dispose();
  recentTracesManager?.dispose();

  // Cleanup viewer
  viewer?.dispose();
});

// Register periodic autosave with the viewer's render loop (every 30 seconds)
viewer.onPeriodicTick(() => {
  if (currentTraceId) {
    saveCurrentUIState();
  }
}, 30);

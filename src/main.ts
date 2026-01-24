/**
 * Standalone viewer entry point
 */

import { Viewer } from './core/Viewer';
import { hashContent } from './utils/hash';
import {
  exportAsHtml,
  exportAsMarkdown,
  downloadFile,
  getSafeFilename,
  escapeHtml,
} from './export';
import type { SearchableViewer } from './ui';
import {
  MetricsPanel,
  DetailPanel,
  WordFrequencyPanel,
  ConversationPanel,
  FileLoader,
  RecentTracesManager,
  SearchController,
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
let fileLoader: FileLoader | null = null;
let recentTracesManager: RecentTracesManager | null = null;
let searchController: SearchController | null = null;

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
    isSidebarVisible: () => sidebarVisible,
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

  // Cleanup search controller
  searchController?.dispose();
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

/**
 * Standalone viewer entry point
 */

import './styles/main.css';

import { initI18n, t, onLocaleChange, changeLocale, getCurrentLocale, SUPPORTED_LOCALES, LOCALE_NAMES, type SupportedLocale } from './i18n';
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

// Initialize i18n before app starts
initI18n().then(() => {
  // Update any static text that was rendered before i18n was ready
  updateStaticText();
});

// Toast notification system
type ToastType = 'error' | 'success' | 'info';

function showToast(message: string, type: ToastType = 'info', title?: string, duration = 5000): void {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons: Record<ToastType, string> = {
    error: '⚠',
    success: '✓',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  // Dismiss handler
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    document.removeEventListener('keydown', escapeHandler);
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  };

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn?.addEventListener('click', dismiss);

  // Escape key handler
  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dismiss();
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  container.appendChild(toast);
}

/**
 * Update all static text in the UI with translations
 */
function updateStaticText(): void {
  // Landing page
  const dropTitle = document.querySelector('.drop-title');
  const dropIntro = document.querySelector('.drop-intro');
  const dropText = document.querySelector('.drop-text');
  const dropSubtext = document.querySelector('.drop-subtext');
  const fileSelectBtn = document.getElementById('file-select-btn');
  const urlLoadBtn = document.getElementById('url-load-btn');
  const urlInput = document.getElementById('url-input') as HTMLInputElement | null;
  const samplePreviewBtn = document.querySelector('.sample-preview-btn');

  if (dropTitle) dropTitle.textContent = t('landing.dropTitle');
  if (dropIntro) dropIntro.textContent = t('landing.dropIntro');
  if (dropText) dropText.textContent = t('landing.dropText');
  if (dropSubtext) dropSubtext.textContent = t('landing.dropSubtext');
  if (fileSelectBtn) fileSelectBtn.textContent = t('landing.selectFile');
  if (urlLoadBtn && !urlLoadBtn.classList.contains('loading')) {
    urlLoadBtn.textContent = t('landing.loadUrl');
  }
  if (urlInput) urlInput.placeholder = t('landing.urlPlaceholder');
  if (samplePreviewBtn) samplePreviewBtn.textContent = t('landing.seeHowBuilt');

  // Recent traces
  const recentHeader = document.querySelector('.recent-header h3');
  const recentClearBtn = document.getElementById('recent-clear-btn');
  if (recentHeader) recentHeader.textContent = t('landing.recentTraces');
  if (recentClearBtn) recentClearBtn.textContent = t('sidebar.copy').replace('Copy', 'Clear All'); // Use generic clear

  // Toolbar
  const toolbarBack = document.getElementById('toolbar-back');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const exportBtn = document.getElementById('export-btn');
  if (toolbarBack) toolbarBack.title = t('toolbar.back');
  if (sidebarToggle) sidebarToggle.title = t('toolbar.toggleSidebar');
  if (exportBtn) exportBtn.textContent = t('toolbar.export').replace('Conversation', '').trim();

  // View mode buttons
  document.querySelectorAll('.view-mode-btn').forEach((btn) => {
    const mode = (btn as HTMLElement).dataset.mode;
    if (mode === '3d') btn.setAttribute('title', t('toolbar.view3d'));
    else if (mode === 'split') btn.setAttribute('title', t('toolbar.viewSplit'));
    else if (mode === 'conversation') btn.setAttribute('title', t('toolbar.viewConversation'));
  });

  // Export menu
  document.querySelectorAll('.export-menu button').forEach((btn) => {
    const format = (btn as HTMLElement).dataset.format;
    if (format === 'html') btn.textContent = t('toolbar.exportHtml');
    else if (format === 'markdown') btn.textContent = t('toolbar.exportMarkdown');
  });

  // Search
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const searchRegexToggle = document.getElementById('search-regex-toggle');
  const searchPrevBtn = document.getElementById('search-prev');
  const searchNextBtn = document.getElementById('search-next');
  const searchClearBtn = document.getElementById('search-clear');
  if (searchInput) searchInput.placeholder = t('search.placeholder');
  if (searchRegexToggle) searchRegexToggle.title = t('search.regexToggle');
  if (searchPrevBtn) {
    searchPrevBtn.innerHTML = t('search.prevShort');
    searchPrevBtn.title = t('search.prev');
  }
  if (searchNextBtn) {
    searchNextBtn.innerHTML = t('search.nextShort');
    searchNextBtn.title = t('search.next');
  }
  if (searchClearBtn) {
    searchClearBtn.textContent = t('search.clearShort');
    searchClearBtn.title = t('search.clear');
  }

  // Search filters
  document.querySelectorAll('.search-filter').forEach((label) => {
    const input = label.querySelector('input');
    const span = label.querySelector('span:last-child');
    if (!input || !span) return;
    const type = input.dataset.type;
    if (type === 'user') span.textContent = t('search.user');
    else if (type === 'assistant') span.textContent = t('search.assistant');
    else if (type === 'thinking') span.textContent = t('search.thinking');
    else if (type === 'tool_use') span.textContent = t('search.tool');
    else if (type === 'tool_result') span.textContent = t('search.result');
  });

  // Sidebar sections
  document.querySelectorAll('.sidebar-section').forEach((section) => {
    const sectionType = (section as HTMLElement).dataset.section;
    const header = section.querySelector('.sidebar-section-header h3');
    if (!header) return;
    if (sectionType === 'metrics') header.textContent = t('sidebar.metrics');
    else if (sectionType === 'words') header.textContent = t('sidebar.topWords');
    else if (sectionType === 'details') header.textContent = t('sidebar.details');
  });

  // Metrics labels
  document.querySelectorAll('.metric-row').forEach((row) => {
    const metric = (row as HTMLElement).dataset.metric;
    const label = row.querySelector('.metric-label');
    if (!label) return;
    if (metric === 'totalTokens') label.textContent = t('sidebar.tokens');
    else if (metric === 'outputTokens') label.textContent = t('sidebar.output');
    else if (metric === 'inputTokens') label.textContent = t('sidebar.input');
    else if (metric === 'thinkingCount') label.textContent = t('sidebar.thinking');
    else if (metric === 'toolCount') label.textContent = t('sidebar.tools');
  });

  // Word frequency source options
  const wordFreqSource = document.getElementById('word-freq-source') as HTMLSelectElement | null;
  if (wordFreqSource) {
    const options = wordFreqSource.querySelectorAll('option');
    options.forEach((option) => {
      if (option.value === 'all') option.textContent = t('sidebar.allContent');
      else if (option.value === 'user') option.textContent = t('sidebar.userOnly');
      else if (option.value === 'assistant') option.textContent = t('sidebar.assistantOnly');
      else if (option.value === 'thinking') option.textContent = t('sidebar.thinkingOnly');
    });
  }

  // Detail panel empty state
  const detailEmpty = document.querySelector('.detail-empty');
  if (detailEmpty) detailEmpty.textContent = t('sidebar.noSelection');

  // Legend
  const legendHeaderSpan = document.querySelector('#legend-header span:first-child');
  if (legendHeaderSpan) legendHeaderSpan.textContent = t('legend.title');

  const legendSections = document.querySelectorAll('.legend-section h3');
  legendSections.forEach((h3) => {
    if (h3.textContent === 'Node Types') h3.textContent = t('legend.nodeTypes');
  });

  document.querySelectorAll('.legend-item').forEach((item) => {
    const colorDiv = item.querySelector('.legend-color');
    const label = item.querySelector('.legend-label');
    if (!colorDiv || !label) return;
    if (colorDiv.classList.contains('user')) label.textContent = t('legend.user');
    else if (colorDiv.classList.contains('assistant')) label.textContent = t('legend.assistant');
    else if (colorDiv.classList.contains('thinking')) label.textContent = t('legend.thinking');
    else if (colorDiv.classList.contains('tool-use')) label.textContent = t('legend.toolCall');
    else if (colorDiv.classList.contains('tool-result-success')) label.textContent = t('legend.toolSuccess');
    else if (colorDiv.classList.contains('tool-result')) label.textContent = t('legend.toolError');
  });

  // Canvas controls
  const expandToggle = document.getElementById('expand-toggle');
  const watchToggle = document.getElementById('watch-toggle');
  const coilControlsToggle = document.getElementById('coil-controls-toggle');
  if (expandToggle && !expandToggle.classList.contains('expanded')) {
    expandToggle.textContent = t('sidebar.expand');
  } else if (expandToggle) {
    expandToggle.textContent = t('sidebar.collapse');
  }
  if (watchToggle && !watchToggle.classList.contains('watching')) {
    watchToggle.textContent = t('landing.watch');
  } else if (watchToggle) {
    watchToggle.textContent = t('landing.watching');
  }
  if (coilControlsToggle) coilControlsToggle.textContent = t('canvas.coilSettings').split(' ')[0];

  // Coil controls
  const coilResetBtn = document.getElementById('coil-reset-btn');
  if (coilResetBtn) coilResetBtn.textContent = t('coil.reset');

  // Conversation filters
  document.querySelectorAll('.conv-filter').forEach((btn) => {
    const filter = (btn as HTMLElement).dataset.filter;
    if (filter === 'user') btn.textContent = t('filter.user');
    else if (filter === 'output') btn.textContent = t('filter.output');
    else if (filter === 'thinking') btn.textContent = t('filter.thinking');
    else if (filter === 'tools') btn.textContent = t('filter.tools');
    else if (filter === 'documents') btn.textContent = t('filter.documents');
  });

  // Update language switcher display
  updateLanguageSwitcher();
}

/**
 * Create and setup the language switcher
 */
function setupLanguageSwitcher(): void {
  const exportDropdown = document.querySelector('.export-dropdown');
  if (!exportDropdown) return;

  // Create language switcher container
  const langSwitcher = document.createElement('div');
  langSwitcher.className = 'lang-switcher';
  langSwitcher.id = 'lang-switcher';

  const currentLang = document.createElement('button');
  currentLang.className = 'lang-current';
  currentLang.id = 'lang-current';
  currentLang.textContent = LOCALE_NAMES[getCurrentLocale()];

  const langMenu = document.createElement('div');
  langMenu.className = 'lang-menu';
  langMenu.id = 'lang-menu';

  SUPPORTED_LOCALES.forEach((locale) => {
    const btn = document.createElement('button');
    btn.dataset.locale = locale;
    btn.textContent = LOCALE_NAMES[locale];
    if (locale === getCurrentLocale()) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', async () => {
      await changeLocale(locale);
    });
    langMenu.appendChild(btn);
  });

  langSwitcher.appendChild(currentLang);
  langSwitcher.appendChild(langMenu);

  // Insert before export dropdown
  exportDropdown.parentNode?.insertBefore(langSwitcher, exportDropdown);

  // Toggle menu on click
  currentLang.addEventListener('click', (e) => {
    e.stopPropagation();
    langSwitcher.classList.toggle('open');
  });

  // Close menu on outside click
  document.addEventListener('click', () => {
    langSwitcher.classList.remove('open');
  });
}

/**
 * Update language switcher display
 */
function updateLanguageSwitcher(): void {
  const currentBtn = document.getElementById('lang-current');
  const menuBtns = document.querySelectorAll('#lang-menu button');

  if (currentBtn) {
    currentBtn.textContent = LOCALE_NAMES[getCurrentLocale()];
  }

  menuBtns.forEach((btn) => {
    const locale = (btn as HTMLElement).dataset.locale as SupportedLocale;
    if (locale === getCurrentLocale()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Subscribe to locale changes
onLocaleChange(() => {
  updateStaticText();
});

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
const urlInput = document.getElementById('url-input') as HTMLInputElement | null;
const urlLoadBtn = document.getElementById('url-load-btn');

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
  if (uiState.splitRatio !== undefined && canvasPane && conversationPane && contentArea) {
    const contentWidth = contentArea.offsetWidth;
    if (contentWidth > 0) {
      const canvasWidth = uiState.splitRatio * contentWidth;
      canvasPane.style.flex = 'none';
      canvasPane.style.width = `${canvasWidth}px`;
      // Let conversation pane fill remaining space
      conversationPane.style.flex = '1';
      conversationPane.style.width = '';
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
    currentTraceId = await hashContent(content);

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
    showToast(error instanceof Error ? error.message : String(error), 'error', 'Failed to load file');
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
    showToast(error.message, 'error', 'Error');
  },
});

// Create RecentTracesManager
recentTracesManager = new RecentTracesManager({
  container: recentTracesEl,
  listElement: recentListEl,
  clearBtn: recentClearBtn,
  onSelect: loadRecentTrace,
  onSelectExample: async (example) => {
    await loadFromUrl(example.url, example.name);
  },
});

// ============================================
// URL Loading
// ============================================

/**
 * Load a trace from a URL
 */
/**
 * Convert GitHub blob URLs to raw.githubusercontent.com URLs
 * e.g., https://github.com/user/repo/blob/main/path/file.jsonl
 *    -> https://raw.githubusercontent.com/user/repo/main/path/file.jsonl
 */
function convertGitHubUrl(url: string): string {
  const githubBlobPattern = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/;
  const match = url.match(githubBlobPattern);
  if (match) {
    const [, owner, repo, pathWithBranch] = match;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${pathWithBranch}`;
  }
  return url;
}

/**
 * Check if a URL points to localhost (for local server loading)
 */
function isLocalhostUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.href);
    return urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Load a file from URL with optional retry logic for local servers
 */
async function loadFromUrl(url: string, customName?: string, options?: { retries?: number; retryDelay?: number; silent?: boolean; authToken?: string }): Promise<boolean> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return false;

  const { retries = 0, retryDelay = 500, silent = false, authToken } = options || {};

  // Validate URL format - must be http(s):// or a path (contains / or ends with .jsonl etc)
  const isAbsoluteUrl = /^https?:\/\//i.test(trimmedUrl);
  const isPath = /[/.]/.test(trimmedUrl); // Contains slash or dot (like samples/file.jsonl)
  if (!isAbsoluteUrl && !isPath) {
    if (!silent) {
      showToast(t('toast.invalidUrlMessage'), 'error', t('toast.invalidUrl'));
    }
    return false;
  }

  // Update UI to show loading
  if (urlLoadBtn) {
    urlLoadBtn.textContent = t('landing.loading');
    urlLoadBtn.classList.add('loading');
  }

  const isLocalhost = isLocalhostUrl(trimmedUrl);
  let lastError: Error | null = null;

  // Retry loop for local server (it might not be ready yet when browser opens)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Convert GitHub blob URLs to raw URLs (avoids CORS issues)
      const resolvedUrl = convertGitHubUrl(trimmedUrl);

      // Extract filename from URL
      const urlObj = new URL(resolvedUrl, window.location.href);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'trace.jsonl';

      await fileLoader?.loadFromUrl(resolvedUrl, filename, customName, authToken);
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If we have retries left and this is localhost, wait and retry
      if (attempt < retries && isLocalhost) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

  // All retries failed
  if (!silent && lastError) {
    console.error('Failed to load from URL:', lastError);
    const message = lastError.message;
    // Provide friendlier error messages for common cases
    if (message.includes('JSON Parse error') || message.includes('SyntaxError')) {
      showToast(t('toast.invalidJsonl'), 'error', t('toast.failedToLoad'));
    } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      if (isLocalhost) {
        showToast(t('toast.localServerFailed'), 'error', t('toast.failedToLoad'));
      } else {
        showToast(t('toast.fetchFailed'), 'error', t('toast.failedToLoad'));
      }
    } else if (message.includes('Authentication failed')) {
      showToast(t('toast.authFailed'), 'error', t('toast.failedToLoad'));
    } else {
      showToast(message, 'error', t('toast.failedToLoad'));
    }
  }

  if (urlLoadBtn) {
    urlLoadBtn.textContent = t('landing.loadUrl');
    urlLoadBtn.classList.remove('loading');
  }

  return false;
}

// URL load button click handler
urlLoadBtn?.addEventListener('click', () => {
  const url = urlInput?.value.trim();
  if (url) {
    loadFromUrl(url);
  }
});

// Enter key in URL input
urlInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const url = urlInput.value.trim();
    if (url) {
      loadFromUrl(url);
    }
  }
});

// Check for ?url= query parameter on startup
(async function checkUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  const titleParam = params.get('title');
  const tokenParam = params.get('token');

  if (urlParam) {
    const isLocalhost = isLocalhostUrl(urlParam);

    // Pre-fill the input field (but not the token for security)
    if (urlInput) {
      urlInput.value = urlParam;
    }

    // For localhost URLs, show a loading message and use retry logic
    // (the local server might not be ready when the browser opens)
    if (isLocalhost && dropOverlay) {
      const dropText = dropOverlay.querySelector('.drop-text');
      const dropSubtext = dropOverlay.querySelector('.drop-subtext');
      if (dropText) dropText.textContent = t('landing.loadingFromServer');
      if (dropSubtext) dropSubtext.textContent = t('landing.connectingToCli');
    }

    // Attempt to load from URL (with retries for localhost)
    const success = await loadFromUrl(
      urlParam,
      titleParam || undefined,
      {
        retries: isLocalhost ? 10 : 0,
        retryDelay: 300,
        authToken: tokenParam || undefined,
      }
    );

    if (success) {
      // Clean up URL bar (remove query params for cleaner look and security - remove token)
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    } else {
      // If failed, restore the landing page text
      if (isLocalhost && dropOverlay) {
        const dropText = dropOverlay.querySelector('.drop-text');
        const dropSubtext = dropOverlay.querySelector('.drop-subtext');
        if (dropText) dropText.textContent = t('landing.dropText');
        if (dropSubtext) dropSubtext.textContent = t('landing.dropSubtext');
      }
      console.log('URL load failed, showing file selector');
    }
  }
})();

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
      getSourceId: () => viewer.getConversation()?.meta?.source,
    },
  });
}

// Load recent traces on startup
recentTracesManager?.refresh();

// Setup language switcher
setupLanguageSwitcher();

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

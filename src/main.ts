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
const metricsPanel = document.getElementById('metrics-panel');
const metricsStack = document.getElementById('metrics-stack');
const chartRange = document.getElementById('chart-range');
const wordFreqPanel = document.getElementById('word-freq-panel');
const wordFreqChart = document.getElementById('word-freq-chart');
const wordFreqSource = document.getElementById('word-freq-source') as HTMLSelectElement | null;
const searchPanel = document.getElementById('search-panel');
const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
const searchResultsCount = document.getElementById('search-results-count');
const searchResultsList = document.getElementById('search-results-list');
const searchPrevBtn = document.getElementById('search-prev');
const searchNextBtn = document.getElementById('search-next');
const searchClearBtn = document.getElementById('search-clear');

// Chart state
let currentFocusIndex = 0;
type MetricKey = 'totalTokens' | 'outputTokens' | 'inputTokens' | 'thinkingCount' | 'toolCount' | 'contentLength';

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
      if (meta?.source_version) {
        metaItems.push(`<span class="meta-item" title="Claude Code Version">v${escapeHtml(meta.source_version)}</span>`);
      }

      infoPanel.innerHTML = `
        <h1>${escapeHtml(title)}</h1>
        ${metaItems.length > 0 ? `<div class="meta-row">${metaItems.join('')}</div>` : ''}
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

    // Show search panel
    updateSearchPanelVisibility(true);

    // Draw initial charts
    currentFocusIndex = Math.floor(viewer.getClusterCount() / 2);
    drawCharts(currentFocusIndex);

    // Show word frequency panel (after metrics panel is positioned)
    setTimeout(() => updateWordFreqPanelVisibility(true), 50);

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

  // Hide metrics panel
  if (metricsPanel) {
    metricsPanel.classList.remove('visible');
  }

  // Hide search panel
  updateSearchPanelVisibility(false);

  // Hide word frequency panel
  updateWordFreqPanelVisibility(false);

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
      <div class="detail-section-content">
        <button id="toggle-cluster-btn" class="detail-action-btn" data-cluster-index="${cluster.index}">
          ${cluster.expanded ? '↩ Collapse' : '↗ Expand'}
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

/**
 * Position metrics panel below info panel
 */
function positionMetricsPanel(): void {
  if (!metricsPanel || !infoPanel) return;

  const infoPanelRect = infoPanel.getBoundingClientRect();
  metricsPanel.style.top = `${infoPanelRect.bottom + 10}px`;
}

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
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const barHeight = Math.max(1, (value / maxValue) * (height - CHART_PADDING * 2));
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
  if (!metricsPanel || !metricsStack) return;

  const metrics = viewer.getClusterMetrics();
  if (metrics.length === 0) {
    metricsPanel.classList.remove('visible');
    return;
  }

  metricsPanel.classList.add('visible');
  positionMetricsPanel();

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

  // Draw each visible chart
  const rows = metricsStack.querySelectorAll('.metric-row');
  rows.forEach((row) => {
    const metricKey = row.getAttribute('data-metric') as MetricKey;
    const canvas = row.querySelector('.metric-canvas') as HTMLCanvasElement;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;

    if (!metricKey || !canvas || !checkbox) return;

    if (checkbox.checked) {
      row.classList.remove('hidden');
      const values = metrics.map(m => m[metricKey]);
      drawMetricChart(canvas, values, focusIndex, colors[metricKey]);
    } else {
      row.classList.add('hidden');
    }
  });
}

// Setup metric toggles and click-to-select
if (metricsStack) {
  metricsStack.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('input[type="checkbox"]')) {
      drawCharts(currentFocusIndex);
    }
  });

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
}

// Update charts when selection changes
viewer.onSelect((selection) => {
  if (selection?.clusterIndex !== undefined) {
    currentFocusIndex = selection.clusterIndex;
    drawCharts(currentFocusIndex);
  }

  if (!selection) {
    if (detailPanel) {
      detailPanel.classList.remove('visible');
    }
    return;
  }

  if (detailPanel && detailPanelContent) {
    detailPanel.classList.add('visible');
    detailPanelContent.innerHTML = renderDetail(selection);

    // Wire up cluster toggle button
    const toggleBtn = document.getElementById('toggle-cluster-btn');
    toggleBtn?.addEventListener('click', () => {
      const clusterIndex = parseInt(toggleBtn.dataset.clusterIndex || '0', 10);
      viewer.toggleCluster(clusterIndex);
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

// Reposition panels on window resize
window.addEventListener('resize', () => {
  if (metricsPanel?.classList.contains('visible')) {
    positionMetricsPanel();
    drawCharts(currentFocusIndex);
  }
  if (wordFreqPanel?.classList.contains('visible')) {
    positionWordFreqPanel();
  }
});

// Redraw charts when metrics panel is resized
if (metricsPanel) {
  const resizeObserver = new ResizeObserver(() => {
    if (metricsPanel.classList.contains('visible')) {
      // Small delay to let layout settle
      requestAnimationFrame(() => {
        drawCharts(currentFocusIndex);
        if (wordFreqPanel?.classList.contains('visible')) {
          positionWordFreqPanel();
        }
      });
    }
  });
  resizeObserver.observe(metricsPanel);

  // Manual resize handle
  const resizeHandle = document.getElementById('metrics-resize-handle');
  if (resizeHandle) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = metricsPanel.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const delta = e.clientX - startX;
      const newWidth = Math.min(500, Math.max(180, startWidth + delta));
      metricsPanel.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
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
  if (!wordFreqChart || !wordFreqPanel) return;

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

/**
 * Position word frequency panel below metrics panel
 */
function positionWordFreqPanel(): void {
  if (!wordFreqPanel || !metricsPanel) return;

  const metricsPanelRect = metricsPanel.getBoundingClientRect();
  wordFreqPanel.style.top = `${metricsPanelRect.bottom + 10}px`;
  wordFreqPanel.style.width = `${metricsPanel.offsetWidth}px`;
}

/**
 * Show/hide word frequency panel
 */
function updateWordFreqPanelVisibility(visible: boolean): void {
  if (wordFreqPanel) {
    if (visible) {
      wordFreqPanel.classList.add('visible');
      positionWordFreqPanel();
      renderWordFrequencyChart();
    } else {
      wordFreqPanel.classList.remove('visible');
    }
  }
}

// Wire up word frequency source selector
if (wordFreqSource) {
  wordFreqSource.addEventListener('change', renderWordFrequencyChart);
}

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

/**
 * Get enabled search filters from checkboxes
 */
function getSearchFilters(): Set<string> {
  const filters = new Set<string>();
  if (!searchPanel) return filters;

  searchPanel.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
    const input = checkbox as HTMLInputElement;
    if (input.checked && input.dataset.type) {
      filters.add(input.dataset.type);
    }
  });

  return filters;
}

/**
 * Find first match in text and return context snippet
 */
function findMatch(text: string, lowerQuery: string, queryLength: number): { found: boolean; snippet: string; start: number; end: number } {
  const lowerText = text.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return { found: false, snippet: '', start: -1, end: -1 };
  }

  // Extract context around match
  const snippetStart = Math.max(0, matchIndex - 30);
  const snippetEnd = Math.min(text.length, matchIndex + queryLength + 50);
  let snippet = text.slice(snippetStart, snippetEnd);

  // Add ellipsis if truncated
  if (snippetStart > 0) snippet = '...' + snippet;
  if (snippetEnd < text.length) snippet = snippet + '...';

  return { found: true, snippet, start: matchIndex, end: matchIndex + queryLength };
}

/**
 * Perform search across all clusters using the Viewer's searchable content
 */
function performSearch(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  if (!query.trim()) return results;

  const filters = getSearchFilters();
  const lowerQuery = query.toLowerCase();
  const searchableContent = viewer.getSearchableContent();

  for (const cluster of searchableContent) {
    // Search user text
    if (filters.has('user') && cluster.userText) {
      const match = findMatch(cluster.userText, lowerQuery, query.length);
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
      const match = findMatch(cluster.assistantText, lowerQuery, query.length);
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
        const match = findMatch(thinking, lowerQuery, query.length);
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
        const match = findMatch(searchText, lowerQuery, query.length);
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
        const match = findMatch(toolResult.content, lowerQuery, query.length);
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
  if (searchInput) searchInput.value = '';
  searchResults = [];
  currentSearchIndex = -1;
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
    searchResults = performSearch(query);
    currentSearchIndex = searchResults.length > 0 ? 0 : -1;

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

// Wire up filter checkboxes to re-search
if (searchPanel) {
  searchPanel.querySelectorAll('.search-filter input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', handleSearchInput);
  });
}

// Global keyboard shortcut: / to focus search
window.addEventListener('keydown', (e) => {
  // Don't trigger if already in an input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  if (e.key === '/' && searchInput && searchPanel?.classList.contains('visible')) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

/**
 * Show/hide search panel based on loaded state
 */
function updateSearchPanelVisibility(visible: boolean): void {
  if (searchPanel) {
    if (visible) {
      searchPanel.classList.add('visible');
    } else {
      searchPanel.classList.remove('visible');
      clearSearch();
    }
  }
}

// Load recent traces on startup
refreshRecentTraces();

// Log ready state
console.log('Thinking Tracer ready');
console.log('Drop a Claude Code conversation file to visualize');

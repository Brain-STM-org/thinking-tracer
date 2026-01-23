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

    // Draw initial charts
    currentFocusIndex = Math.floor(viewer.getClusterCount() / 2);
    drawCharts(currentFocusIndex);

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

/**
 * Draw a single metric chart
 */
function drawMetricChart(canvas: HTMLCanvasElement, values: number[], focusIndex?: number, color = '#4a90d9'): void {
  const maxValue = Math.max(...values, 1);

  // Setup canvas with device pixel ratio for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = 2;
  const barWidth = Math.max(1, (width - padding * 2) / values.length - 1);
  const gap = 1;

  // Clear
  ctx.fillStyle = '#2a2a40';
  ctx.fillRect(0, 0, width, height);

  // Draw bars
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const barHeight = Math.max(1, (value / maxValue) * (height - padding * 2));
    const x = padding + i * (barWidth + gap);
    const y = height - padding - barHeight;

    // Highlight focused bar
    if (focusIndex !== undefined && i === focusIndex) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = color;
    }

    ctx.fillRect(x, y, barWidth, barHeight);
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
    const canvas = (e.target as HTMLElement).closest('.metric-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clusterCount = viewer.getClusterCount();
    if (clusterCount === 0) return;

    // Calculate which cluster was clicked
    const padding = 2;
    const barWidth = Math.max(1, (rect.width - padding * 2) / clusterCount - 1);
    const gap = 1;
    const clusterIndex = Math.floor((x - padding) / (barWidth + gap));

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

// Reposition metrics panel on window resize
window.addEventListener('resize', () => {
  if (metricsPanel?.classList.contains('visible')) {
    positionMetricsPanel();
    drawCharts(currentFocusIndex);
  }
});

// Redraw charts when metrics panel is resized
if (metricsPanel) {
  const resizeObserver = new ResizeObserver(() => {
    if (metricsPanel.classList.contains('visible')) {
      drawCharts(currentFocusIndex);
    }
  });
  resizeObserver.observe(metricsPanel);
}

// Load recent traces on startup
refreshRecentTraces();

// Log ready state
console.log('Thinking Tracer ready');
console.log('Drop a Claude Code conversation file to visualize');

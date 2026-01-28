/**
 * Metrics Panel - displays per-cluster metrics as bar charts
 */

import { t } from '../../i18n';
import type { MetricKey, ViewerInterface, MetricsPanelElements } from '../types';

// Chart layout constants
const MIN_BAR_WIDTH = 4;
const BAR_GAP = 1;
const CHART_PADDING = 2;
const CHART_HEIGHT = 24;

// Color palette for different metrics
const METRIC_COLORS: Record<MetricKey, string> = {
  totalTokens: '#4a90d9',
  outputTokens: '#50c878',
  inputTokens: '#9b59b6',
  thinkingCount: '#9b59b6',
  toolCount: '#f39c12',
  contentLength: '#888888',
};

/**
 * Format large numbers compactly (1000 -> 1K, 1000000 -> 1M)
 */
export function formatMetricValue(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

/**
 * Calculate which cluster index is at a given x position
 */
function getClusterIndexAtPosition(
  x: number,
  containerWidth: number,
  clusterCount: number
): number {
  const naturalBarWidth = (containerWidth - CHART_PADDING * 2) / clusterCount - BAR_GAP;
  const barWidth = Math.max(MIN_BAR_WIDTH, naturalBarWidth);
  return Math.floor((x - CHART_PADDING) / (barWidth + BAR_GAP));
}

/**
 * MetricsPanel manages the metrics bar charts in the sidebar
 */
export class MetricsPanel {
  private viewer: ViewerInterface;
  private container: HTMLElement;
  private rangeLabel: HTMLElement | null;
  private tooltip: HTMLElement | null;
  private focusIndex: number = 0;
  private disposed = false;

  // Bound event handlers for cleanup
  private handleClick: (e: MouseEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseLeave: () => void;

  constructor(elements: MetricsPanelElements, viewer: ViewerInterface) {
    this.viewer = viewer;
    this.container = elements.container;
    this.rangeLabel = elements.rangeLabel ?? null;
    this.tooltip = elements.tooltip ?? null;

    // Bind event handlers
    this.handleClick = this.onClick.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseLeave = this.onMouseLeave.bind(this);

    // Wire up events
    this.container.addEventListener('click', this.handleClick);
    this.container.addEventListener('mousemove', this.handleMouseMove);
    this.container.addEventListener('mouseleave', this.handleMouseLeave);
  }

  /**
   * Draw all metric charts
   */
  public draw(focusIndex?: number): void {
    if (this.disposed) return;

    if (focusIndex !== undefined) {
      this.focusIndex = focusIndex;
    }

    const metrics = this.viewer.getClusterMetrics();
    if (metrics.length === 0) return;

    // Update range label
    if (this.rangeLabel) {
      this.rangeLabel.textContent = `1-${metrics.length}`;
    }

    // Draw each visible chart row
    const rows = this.container.querySelectorAll('.metric-row');
    rows.forEach((row) => {
      const metricKey = row.getAttribute('data-metric') as MetricKey;
      const canvas = row.querySelector('.metric-canvas') as HTMLCanvasElement;
      const totalEl = row.querySelector('.metric-total') as HTMLElement;

      if (!metricKey || !canvas) return;

      const values = metrics.map((m) => m[metricKey]);
      this.drawChart(canvas, values, this.focusIndex, METRIC_COLORS[metricKey]);

      // Update total
      if (totalEl) {
        const total = values.reduce((sum, v) => sum + v, 0);
        totalEl.textContent = formatMetricValue(total);
      }
    });
  }

  /**
   * Update focus to a specific cluster
   */
  public setFocus(index: number): void {
    this.focusIndex = index;
    this.draw();
  }

  /**
   * Clean up event listeners
   */
  public dispose(): void {
    this.disposed = true;
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('mousemove', this.handleMouseMove);
    this.container.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  /**
   * Draw a single metric chart
   */
  private drawChart(
    canvas: HTMLCanvasElement,
    values: number[],
    focusIndex: number,
    color: string
  ): void {
    const maxValue = Math.max(...values, 1);
    const container = canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = container.clientWidth;
    const height = CHART_HEIGHT;

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
      ctx.fillStyle = i === focusIndex ? '#ffffff' : color;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Auto-scroll to focused bar if needed
    if (canvasWidth > containerWidth) {
      const focusX = CHART_PADDING + focusIndex * (barWidth + BAR_GAP);
      const scrollTarget = focusX - containerWidth / 2 + barWidth / 2;
      container.scrollLeft = Math.max(0, Math.min(scrollTarget, canvasWidth - containerWidth));
    }
  }

  /**
   * Handle click on chart to select cluster
   */
  private onClick(e: MouseEvent): void {
    const container = (e.target as HTMLElement).closest('.metric-chart-container');
    const canvas = container?.querySelector('.metric-canvas') as HTMLCanvasElement;
    if (!container || !canvas) return;

    const clusterCount = this.viewer.getClusterCount();
    if (clusterCount === 0) return;

    // Get click position relative to canvas (accounting for scroll)
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left + container.scrollLeft;

    const clusterIndex = getClusterIndexAtPosition(x, container.clientWidth, clusterCount);

    if (clusterIndex >= 0 && clusterIndex < clusterCount) {
      this.viewer.selectClusterByIndex(clusterIndex);
    }
  }

  /**
   * Handle mousemove for tooltip
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.tooltip) return;

    const container = (e.target as HTMLElement).closest('.metric-chart-container');
    const row = (e.target as HTMLElement).closest('.metric-row');
    const canvas = container?.querySelector('.metric-canvas') as HTMLCanvasElement;

    if (!container || !row || !canvas) {
      this.tooltip.classList.remove('visible');
      return;
    }

    const metricKey = row.getAttribute('data-metric') as MetricKey;
    const metrics = this.viewer.getClusterMetrics();
    if (metrics.length === 0) {
      this.tooltip.classList.remove('visible');
      return;
    }

    // Get position relative to canvas (accounting for scroll)
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left + container.scrollLeft;

    const clusterIndex = getClusterIndexAtPosition(x, container.clientWidth, metrics.length);

    if (clusterIndex >= 0 && clusterIndex < metrics.length) {
      const value = metrics[clusterIndex][metricKey];
      const turnEl = this.tooltip.querySelector('.tooltip-turn');
      const valueEl = this.tooltip.querySelector('.tooltip-value');

      if (turnEl) turnEl.textContent = t('metrics.turnNumber', { number: clusterIndex + 1 });
      if (valueEl) valueEl.textContent = value.toLocaleString();

      // Position tooltip near cursor
      this.tooltip.style.left = `${e.clientX + 12}px`;
      this.tooltip.style.top = `${e.clientY - 10}px`;
      this.tooltip.classList.add('visible');
    } else {
      this.tooltip.classList.remove('visible');
    }
  }

  /**
   * Handle mouseleave to hide tooltip
   */
  private onMouseLeave(): void {
    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
    }
  }
}

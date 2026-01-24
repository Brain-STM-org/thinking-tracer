/**
 * Tests for MetricsPanel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsPanel, formatMetricValue } from './MetricsPanel';
import type { ViewerInterface, ClusterMetrics } from '../types';

// Mock canvas context
const createMockContext = () => ({
  scale: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: '',
});

// Create sample metrics data
const createMetrics = (count: number): ClusterMetrics[] => {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    totalTokens: (i + 1) * 100,
    inputTokens: (i + 1) * 40,
    outputTokens: (i + 1) * 60,
    thinkingCount: i % 2,
    toolCount: i % 3,
    contentLength: (i + 1) * 500,
  }));
};

// Create mock viewer
const createMockViewer = (metrics: ClusterMetrics[]): ViewerInterface => ({
  getClusterCount: vi.fn().mockReturnValue(metrics.length),
  getClusterMetrics: vi.fn().mockReturnValue(metrics),
  selectClusterByIndex: vi.fn(),
});

// Helper to mock read-only DOM properties
function mockElementProperty(element: Element, property: string, value: unknown): void {
  Object.defineProperty(element, property, {
    value,
    writable: true,
    configurable: true,
  });
}

describe('formatMetricValue', () => {
  it('formats values under 1000 as-is', () => {
    expect(formatMetricValue(0)).toBe('0');
    expect(formatMetricValue(1)).toBe('1');
    expect(formatMetricValue(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatMetricValue(1000)).toBe('1.0K');
    expect(formatMetricValue(1500)).toBe('1.5K');
    expect(formatMetricValue(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatMetricValue(1000000)).toBe('1.0M');
    expect(formatMetricValue(2500000)).toBe('2.5M');
    expect(formatMetricValue(10000000)).toBe('10.0M');
  });
});

describe('MetricsPanel', () => {
  let container: HTMLElement;
  let rangeLabel: HTMLElement;
  let tooltip: HTMLElement;
  let viewer: ViewerInterface;
  let panel: MetricsPanel | undefined;

  beforeEach(() => {
    // Create container with metric rows
    container = document.createElement('div');
    container.innerHTML = `
      <div class="metric-row" data-metric="totalTokens">
        <div class="metric-chart-container">
          <canvas class="metric-canvas"></canvas>
        </div>
        <span class="metric-total"></span>
      </div>
      <div class="metric-row" data-metric="thinkingCount">
        <div class="metric-chart-container">
          <canvas class="metric-canvas"></canvas>
        </div>
        <span class="metric-total"></span>
      </div>
    `;

    rangeLabel = document.createElement('span');
    tooltip = document.createElement('div');
    tooltip.innerHTML = `
      <span class="tooltip-turn"></span>
      <span class="tooltip-value"></span>
    `;

    // Mock canvas getContext and parent element properties
    const mockCtx = createMockContext();
    container.querySelectorAll('canvas').forEach((canvas) => {
      (canvas as any).getContext = vi.fn().mockReturnValue(mockCtx);
      const parent = canvas.parentElement!;
      mockElementProperty(parent, 'clientWidth', 400);
      mockElementProperty(parent, 'scrollLeft', 0);
    });

    viewer = createMockViewer(createMetrics(5));
    panel = new MetricsPanel(
      { container, rangeLabel, tooltip },
      viewer
    );
  });

  afterEach(() => {
    panel?.dispose();
    panel = undefined;
  });

  describe('constructor', () => {
    it('creates panel with required elements', () => {
      expect(panel).toBeDefined();
    });

    it('works without optional elements', () => {
      const minimalPanel = new MetricsPanel(
        { container },
        viewer
      );
      expect(minimalPanel).toBeDefined();
      minimalPanel.dispose();
    });
  });

  describe('draw', () => {
    it('calls getClusterMetrics on viewer', () => {
      panel!.draw();
      expect(viewer.getClusterMetrics).toHaveBeenCalled();
    });

    it('updates range label with cluster count', () => {
      panel!.draw();
      expect(rangeLabel.textContent).toBe('1-5');
    });

    it('updates total values for each metric row', () => {
      panel!.draw();
      const totals = container.querySelectorAll('.metric-total');
      // totalTokens: 100+200+300+400+500 = 1500
      expect(totals[0].textContent).toBe('1.5K');
    });

    it('respects focus index parameter', () => {
      panel!.draw(3);
      // Canvas should have been accessed
      const canvas = container.querySelector('canvas')!;
      expect((canvas as any).getContext).toHaveBeenCalled();
    });

    it('handles empty metrics gracefully', () => {
      const emptyViewer = createMockViewer([]);
      const emptyPanel = new MetricsPanel({ container }, emptyViewer);

      // Should not throw
      expect(() => emptyPanel.draw()).not.toThrow();
      emptyPanel.dispose();
    });
  });

  describe('setFocus', () => {
    it('updates focus and redraws', () => {
      const drawSpy = vi.spyOn(panel!, 'draw');
      panel!.setFocus(2);
      expect(drawSpy).toHaveBeenCalled();
    });
  });

  describe('click handling', () => {
    it('calls selectClusterByIndex on click', () => {
      // Get the canvas element to dispatch event from
      const canvas = container.querySelector('.metric-canvas') as HTMLCanvasElement;
      const chartContainer = canvas.parentElement as HTMLElement;

      // Mock getBoundingClientRect on the container
      chartContainer.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 400,
        height: 24,
      });

      // Create click event at position that maps to a cluster
      // With 5 clusters in 400px, each bar is ~80px (minus padding/gaps)
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        bubbles: true,
      });

      // Dispatch from the canvas (event bubbles to container)
      canvas.dispatchEvent(clickEvent);

      // selectClusterByIndex should be called
      expect(viewer.selectClusterByIndex).toHaveBeenCalled();
    });
  });

  describe('tooltip handling', () => {
    it('shows tooltip on mousemove over chart', () => {
      const canvas = container.querySelector('.metric-canvas') as HTMLCanvasElement;
      const chartContainer = canvas.parentElement as HTMLElement;

      chartContainer.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 400,
        height: 24,
      });

      const moveEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 50,
        bubbles: true,
      });

      // Dispatch from the canvas
      canvas.dispatchEvent(moveEvent);

      expect(tooltip.classList.contains('visible')).toBe(true);
    });

    it('hides tooltip on mouseleave', () => {
      tooltip.classList.add('visible');

      const leaveEvent = new MouseEvent('mouseleave', {
        bubbles: true,
      });

      container.dispatchEvent(leaveEvent);

      expect(tooltip.classList.contains('visible')).toBe(false);
    });
  });

  describe('dispose', () => {
    it('removes event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener');

      panel!.dispose();
      panel = undefined; // Prevent afterEach from calling dispose again

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('prevents further draws after dispose', () => {
      const p = panel!;
      p.dispose();
      panel = undefined; // Prevent afterEach from calling dispose again

      // Should not throw and should not call viewer
      vi.clearAllMocks();
      p.draw();

      expect(viewer.getClusterMetrics).not.toHaveBeenCalled();
    });
  });
});

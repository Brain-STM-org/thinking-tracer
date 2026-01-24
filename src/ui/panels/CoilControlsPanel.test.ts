/**
 * Tests for CoilControlsPanel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CoilControlsPanel,
  type CoilControllableViewer,
  type CoilControlsPanelElements,
  type CoilParams,
} from './CoilControlsPanel';

function createMockViewer(): CoilControllableViewer {
  const state = {
    params: {
      spiralRadius: 2.5,
      spiralAngleStep: 1.26,
      coilRadius: 6,
      coilAngleStep: 0.39,
      coilVerticalStep: 1.5,
      focusRadius: 4,
      minVerticalSpacing: 0.2,
      maxVerticalSpacing: 1.5,
    } as CoilParams,
    showClusterLines: true,
    lineColor: 0xb7410e,
    lineWidth: 6,
    lineOpacity: 0.4,
  };

  return {
    getCoilParams: vi.fn(() => ({ ...state.params })),
    setCoilParam: vi.fn((name: string, value: number) => {
      if (name in state.params) {
        (state.params as unknown as Record<string, number>)[name] = value;
      }
    }),
    resetCoilParams: vi.fn(() => {
      state.params = {
        spiralRadius: 2.5,
        spiralAngleStep: 1.26,
        coilRadius: 6,
        coilAngleStep: 0.39,
        coilVerticalStep: 1.5,
        focusRadius: 4,
        minVerticalSpacing: 0.2,
        maxVerticalSpacing: 1.5,
      };
    }),
    getShowClusterLines: vi.fn(() => state.showClusterLines),
    setShowClusterLines: vi.fn((show: boolean) => {
      state.showClusterLines = show;
    }),
    getClusterLineColor: vi.fn(() => state.lineColor),
    setClusterLineColor: vi.fn((color: number) => {
      state.lineColor = color;
    }),
    getClusterLineWidth: vi.fn(() => state.lineWidth),
    setClusterLineWidth: vi.fn((width: number) => {
      state.lineWidth = width;
    }),
    getClusterLineOpacity: vi.fn(() => state.lineOpacity),
    setClusterLineOpacity: vi.fn((opacity: number) => {
      state.lineOpacity = opacity;
    }),
  };
}

function createMockElements(): CoilControlsPanelElements {
  const toggleBtn = document.createElement('button');
  const panel = document.createElement('div');
  const resetBtn = document.createElement('button');

  // Create slider elements
  const slidersContainer = document.createElement('div');
  const sliderParams = ['spiralRadius', 'coilRadius', 'focusRadius'];
  sliderParams.forEach((param) => {
    const sliderDiv = document.createElement('div');
    sliderDiv.className = 'coil-slider';
    sliderDiv.dataset.param = param;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '10';
    input.value = '2.5';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'coil-value';
    valueSpan.textContent = '2.50';

    sliderDiv.appendChild(input);
    sliderDiv.appendChild(valueSpan);
    slidersContainer.appendChild(sliderDiv);
  });

  const sliders = slidersContainer.querySelectorAll('.coil-slider');

  // Cluster lines controls
  const clusterLinesToggle = document.createElement('input');
  clusterLinesToggle.type = 'checkbox';
  clusterLinesToggle.checked = true;

  const clusterLineOptions = document.createElement('div');

  const lineColor = document.createElement('input');
  lineColor.type = 'color';
  lineColor.value = '#b7410e';

  const lineColorValue = document.createElement('span');
  lineColorValue.textContent = '#B7410E';

  const lineWidth = document.createElement('input');
  lineWidth.type = 'range';
  lineWidth.value = '6';

  const lineWidthValue = document.createElement('span');
  lineWidthValue.textContent = '6';

  const lineOpacity = document.createElement('input');
  lineOpacity.type = 'range';
  lineOpacity.value = '0.4';

  const lineOpacityValue = document.createElement('span');
  lineOpacityValue.textContent = '0.40';

  return {
    toggleBtn,
    panel,
    resetBtn,
    sliders,
    clusterLinesToggle,
    clusterLineOptions,
    lineColor,
    lineColorValue,
    lineWidth,
    lineWidthValue,
    lineOpacity,
    lineOpacityValue,
  };
}

describe('CoilControlsPanel', () => {
  let panel: CoilControlsPanel;
  let viewer: CoilControllableViewer;
  let elements: CoilControlsPanelElements;

  beforeEach(() => {
    viewer = createMockViewer();
    elements = createMockElements();
  });

  afterEach(() => {
    panel?.dispose();
  });

  describe('construction', () => {
    it('creates panel with required elements', () => {
      panel = new CoilControlsPanel(elements, viewer);
      expect(panel).toBeDefined();
    });

    it('creates panel with minimal elements', () => {
      const minimalElements: CoilControlsPanelElements = {
        toggleBtn: document.createElement('button'),
        panel: document.createElement('div'),
        sliders: [],
      };
      panel = new CoilControlsPanel(minimalElements, viewer);
      expect(panel).toBeDefined();
    });
  });

  describe('panel toggle', () => {
    it('toggles panel visibility on button click', () => {
      panel = new CoilControlsPanel(elements, viewer);

      expect(elements.panel.classList.contains('visible')).toBe(false);

      elements.toggleBtn.click();
      expect(elements.panel.classList.contains('visible')).toBe(true);
      expect(elements.toggleBtn.classList.contains('active')).toBe(true);

      elements.toggleBtn.click();
      expect(elements.panel.classList.contains('visible')).toBe(false);
      expect(elements.toggleBtn.classList.contains('active')).toBe(false);
    });

    it('syncs from viewer when panel opens', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.toggleBtn.click();

      expect(viewer.getCoilParams).toHaveBeenCalled();
      expect(viewer.getShowClusterLines).toHaveBeenCalled();
      expect(viewer.getClusterLineColor).toHaveBeenCalled();
    });

    it('isVisible returns correct state', () => {
      panel = new CoilControlsPanel(elements, viewer);

      expect(panel.isVisible()).toBe(false);

      elements.toggleBtn.click();
      expect(panel.isVisible()).toBe(true);

      elements.toggleBtn.click();
      expect(panel.isVisible()).toBe(false);
    });
  });

  describe('show/hide methods', () => {
    it('show() makes panel visible and syncs', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.show();

      expect(elements.panel.classList.contains('visible')).toBe(true);
      expect(elements.toggleBtn.classList.contains('active')).toBe(true);
      expect(viewer.getCoilParams).toHaveBeenCalled();
    });

    it('hide() makes panel invisible', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.show();
      panel.hide();

      expect(elements.panel.classList.contains('visible')).toBe(false);
      expect(elements.toggleBtn.classList.contains('active')).toBe(false);
    });
  });

  describe('reset button', () => {
    it('calls viewer.resetCoilParams on click', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.resetBtn!.click();

      expect(viewer.resetCoilParams).toHaveBeenCalled();
    });

    it('syncs UI after reset', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.resetBtn!.click();

      expect(viewer.getCoilParams).toHaveBeenCalled();
    });
  });

  describe('coil sliders', () => {
    it('updates viewer when slider changes', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const slider = elements.sliders[0].querySelector('input') as HTMLInputElement;
      slider.value = '5';
      slider.dispatchEvent(new Event('input'));

      expect(viewer.setCoilParam).toHaveBeenCalledWith('spiralRadius', 5);
    });

    it('updates value display when slider changes', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const slider = elements.sliders[0].querySelector('input') as HTMLInputElement;
      const valueSpan = elements.sliders[0].querySelector('.coil-value') as HTMLElement;

      slider.value = '3.5';
      slider.dispatchEvent(new Event('input'));

      expect(valueSpan.textContent).toBe('3.50');
    });

    it('handles multiple sliders independently', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const slider1 = elements.sliders[0].querySelector('input') as HTMLInputElement;
      const slider2 = elements.sliders[1].querySelector('input') as HTMLInputElement;

      slider1.value = '3';
      slider1.dispatchEvent(new Event('input'));

      slider2.value = '8';
      slider2.dispatchEvent(new Event('input'));

      expect(viewer.setCoilParam).toHaveBeenCalledWith('spiralRadius', 3);
      expect(viewer.setCoilParam).toHaveBeenCalledWith('coilRadius', 8);
    });
  });

  describe('cluster lines toggle', () => {
    it('calls viewer.setShowClusterLines on change', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.clusterLinesToggle!.checked = false;
      elements.clusterLinesToggle!.dispatchEvent(new Event('change'));

      expect(viewer.setShowClusterLines).toHaveBeenCalledWith(false);
    });

    it('toggles line options visibility', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.clusterLinesToggle!.checked = false;
      elements.clusterLinesToggle!.dispatchEvent(new Event('change'));

      expect(elements.clusterLineOptions!.classList.contains('visible')).toBe(false);

      elements.clusterLinesToggle!.checked = true;
      elements.clusterLinesToggle!.dispatchEvent(new Event('change'));

      expect(elements.clusterLineOptions!.classList.contains('visible')).toBe(true);
    });
  });

  describe('line color', () => {
    it('calls viewer.setClusterLineColor on input', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.lineColor!.value = '#ff0000';
      elements.lineColor!.dispatchEvent(new Event('input'));

      expect(viewer.setClusterLineColor).toHaveBeenCalledWith(0xff0000);
    });

    it('updates color value display', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.lineColor!.value = '#00ff00';
      elements.lineColor!.dispatchEvent(new Event('input'));

      expect(elements.lineColorValue!.textContent).toBe('#00FF00');
    });
  });

  describe('line width', () => {
    it('calls viewer.setClusterLineWidth on input', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.lineWidth!.value = '10';
      elements.lineWidth!.dispatchEvent(new Event('input'));

      expect(viewer.setClusterLineWidth).toHaveBeenCalledWith(10);
    });

    it('updates width value display', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.lineWidth!.value = '8';
      elements.lineWidth!.dispatchEvent(new Event('input'));

      expect(elements.lineWidthValue!.textContent).toBe('8');
    });
  });

  describe('line opacity', () => {
    it('calls viewer.setClusterLineOpacity on input', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.lineOpacity!.value = '0.75';
      elements.lineOpacity!.dispatchEvent(new Event('input'));

      expect(viewer.setClusterLineOpacity).toHaveBeenCalledWith(0.75);
    });

    it('updates opacity value display', () => {
      panel = new CoilControlsPanel(elements, viewer);

      elements.lineOpacity!.value = '0.5';
      elements.lineOpacity!.dispatchEvent(new Event('input'));

      expect(elements.lineOpacityValue!.textContent).toBe('0.50');
    });
  });

  describe('syncFromViewer', () => {
    it('syncs coil parameters from viewer', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.syncFromViewer();

      const slider = elements.sliders[0].querySelector('input') as HTMLInputElement;
      const valueSpan = elements.sliders[0].querySelector('.coil-value') as HTMLElement;

      expect(slider.value).toBe('2.5');
      expect(valueSpan.textContent).toBe('2.50');
    });

    it('syncs cluster lines state', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.syncFromViewer();

      expect(elements.clusterLinesToggle!.checked).toBe(true);
      expect(elements.clusterLineOptions!.classList.contains('visible')).toBe(true);
    });

    it('syncs line color', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.syncFromViewer();

      expect(elements.lineColor!.value).toBe('#b7410e');
      expect(elements.lineColorValue!.textContent).toBe('#B7410E');
    });

    it('syncs line width', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.syncFromViewer();

      expect(elements.lineWidth!.value).toBe('6');
      expect(elements.lineWidthValue!.textContent).toBe('6');
    });

    it('syncs line opacity', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.syncFromViewer();

      expect(elements.lineOpacity!.value).toBe('0.4');
      expect(elements.lineOpacityValue!.textContent).toBe('0.40');
    });
  });

  describe('dispose', () => {
    it('removes toggle listener', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const removeListenerSpy = vi.spyOn(elements.toggleBtn, 'removeEventListener');

      panel.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('removes reset listener', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const removeListenerSpy = vi.spyOn(elements.resetBtn!, 'removeEventListener');

      panel.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('removes slider listeners', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const slider = elements.sliders[0].querySelector('input') as HTMLInputElement;
      const removeListenerSpy = vi.spyOn(slider, 'removeEventListener');

      panel.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('removes line control listeners', () => {
      panel = new CoilControlsPanel(elements, viewer);

      const colorSpy = vi.spyOn(elements.lineColor!, 'removeEventListener');
      const widthSpy = vi.spyOn(elements.lineWidth!, 'removeEventListener');
      const opacitySpy = vi.spyOn(elements.lineOpacity!, 'removeEventListener');

      panel.dispose();

      expect(colorSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(widthSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(opacitySpy).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('ignores operations after dispose', () => {
      panel = new CoilControlsPanel(elements, viewer);

      panel.dispose();

      // These should not throw
      panel.syncFromViewer();
      panel.show();
      panel.hide();

      // Toggle click shouldn't do anything
      elements.toggleBtn.click();
      expect(elements.panel.classList.contains('visible')).toBe(false);
    });
  });
});

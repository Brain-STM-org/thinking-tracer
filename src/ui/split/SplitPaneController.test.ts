/**
 * Tests for SplitPaneController
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SplitPaneController, type SplitPaneControllerElements } from './SplitPaneController';

function createMockElements(): SplitPaneControllerElements {
  const handle = document.createElement('div');
  handle.className = 'split-handle';

  const primaryPane = document.createElement('div');
  primaryPane.className = 'canvas-pane';

  const secondaryPane = document.createElement('div');
  secondaryPane.className = 'conversation-pane';

  const container = document.createElement('div');
  container.className = 'content-area';
  container.appendChild(primaryPane);
  container.appendChild(handle);
  container.appendChild(secondaryPane);

  return {
    handle,
    primaryPane,
    secondaryPane,
    container,
  };
}

describe('SplitPaneController', () => {
  let controller: SplitPaneController;
  let elements: SplitPaneControllerElements;

  beforeEach(() => {
    elements = createMockElements();
  });

  afterEach(() => {
    controller?.dispose();
  });

  describe('construction', () => {
    it('creates controller with required elements', () => {
      controller = new SplitPaneController({ elements });
      expect(controller).toBeDefined();
    });

    it('uses default min widths', () => {
      controller = new SplitPaneController({ elements });
      // Controller created successfully with defaults
      expect(controller).toBeDefined();
    });

    it('accepts custom min widths', () => {
      controller = new SplitPaneController({
        elements,
        minPrimaryWidth: 400,
        minSecondaryWidth: 300,
        gapWidth: 10,
      });
      expect(controller).toBeDefined();
    });
  });

  describe('dragging', () => {
    it('starts drag on mousedown', () => {
      controller = new SplitPaneController({ elements });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      expect(controller.isDraggingActive()).toBe(true);
      expect(elements.handle.classList.contains('dragging')).toBe(true);
      expect(document.body.style.cursor).toBe('ew-resize');
    });

    it('resizes panes on mousemove', () => {
      controller = new SplitPaneController({ elements });

      // Mock container dimensions
      vi.spyOn(elements.container, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 1000,
        top: 0,
        right: 1000,
        bottom: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      const mousemove = new MouseEvent('mousemove', { clientX: 600 });
      document.dispatchEvent(mousemove);

      expect(elements.primaryPane.style.width).toBe('600px');
      expect(elements.secondaryPane.style.width).toBe('394px'); // 1000 - 600 - 6 (gap)
    });

    it('respects min primary width constraint', () => {
      controller = new SplitPaneController({
        elements,
        minPrimaryWidth: 300,
      });

      vi.spyOn(elements.container, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 1000,
        top: 0,
        right: 1000,
        bottom: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      // Try to resize to 200px (below min)
      const mousemove = new MouseEvent('mousemove', { clientX: 200 });
      document.dispatchEvent(mousemove);

      // Width should not change (still empty because it was never set)
      expect(elements.primaryPane.style.width).toBe('');
    });

    it('respects min secondary width constraint', () => {
      controller = new SplitPaneController({
        elements,
        minSecondaryWidth: 250,
      });

      vi.spyOn(elements.container, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 1000,
        top: 0,
        right: 1000,
        bottom: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      // Try to resize primary to 800px, leaving only 194px for secondary (below min 250)
      const mousemove = new MouseEvent('mousemove', { clientX: 800 });
      document.dispatchEvent(mousemove);

      // Width should not change (still empty because it was never set)
      expect(elements.primaryPane.style.width).toBe('');
    });

    it('ends drag on mouseup', () => {
      controller = new SplitPaneController({ elements });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      expect(controller.isDraggingActive()).toBe(true);

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(controller.isDraggingActive()).toBe(false);
      expect(elements.handle.classList.contains('dragging')).toBe(false);
      expect(document.body.style.cursor).toBe('');
    });

    it('calls onResizeEnd callback on mouseup', () => {
      const onResizeEnd = vi.fn();
      controller = new SplitPaneController({ elements, onResizeEnd });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(onResizeEnd).toHaveBeenCalled();
    });

    it('ignores mousemove when not dragging', () => {
      controller = new SplitPaneController({ elements });

      vi.spyOn(elements.container, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 1000,
        top: 0,
        right: 1000,
        bottom: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const mousemove = new MouseEvent('mousemove', { clientX: 600 });
      document.dispatchEvent(mousemove);

      expect(elements.primaryPane.style.width).toBe('');
    });

    it('ignores mouseup when not dragging', () => {
      const onResizeEnd = vi.fn();
      controller = new SplitPaneController({ elements, onResizeEnd });

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(onResizeEnd).not.toHaveBeenCalled();
    });
  });

  describe('getSplitRatio', () => {
    it('returns ratio of primary width to container width', () => {
      controller = new SplitPaneController({ elements });

      Object.defineProperty(elements.primaryPane, 'offsetWidth', { value: 400 });
      Object.defineProperty(elements.container, 'offsetWidth', { value: 1000 });

      expect(controller.getSplitRatio()).toBe(0.4);
    });

    it('returns 0.5 when container width is 0', () => {
      controller = new SplitPaneController({ elements });

      Object.defineProperty(elements.container, 'offsetWidth', { value: 0 });

      expect(controller.getSplitRatio()).toBe(0.5);
    });
  });

  describe('setSplitRatio', () => {
    it('sets pane widths based on ratio', () => {
      controller = new SplitPaneController({ elements, gapWidth: 6 });

      Object.defineProperty(elements.container, 'offsetWidth', { value: 1000 });

      controller.setSplitRatio(0.6);

      expect(elements.primaryPane.style.width).toBe('600px');
      expect(elements.secondaryPane.style.width).toBe('394px');
    });

    it('clamps ratio to valid range', () => {
      controller = new SplitPaneController({ elements, gapWidth: 6 });

      Object.defineProperty(elements.container, 'offsetWidth', { value: 1000 });

      controller.setSplitRatio(0.05); // Below min 0.1
      expect(elements.primaryPane.style.width).toBe('100px'); // 0.1 * 1000

      controller.setSplitRatio(0.95); // Above max 0.9
      expect(elements.primaryPane.style.width).toBe('900px'); // 0.9 * 1000
    });

    it('does nothing when container width is 0', () => {
      controller = new SplitPaneController({ elements });

      Object.defineProperty(elements.container, 'offsetWidth', { value: 0 });

      controller.setSplitRatio(0.6);

      expect(elements.primaryPane.style.width).toBe('');
    });
  });

  describe('dispose', () => {
    it('removes handle listener', () => {
      controller = new SplitPaneController({ elements });

      const removeListenerSpy = vi.spyOn(elements.handle, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('removes document listeners', () => {
      controller = new SplitPaneController({ elements });

      const removeListenerSpy = vi.spyOn(document, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    it('ends active drag on dispose', () => {
      controller = new SplitPaneController({ elements });

      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      expect(controller.isDraggingActive()).toBe(true);
      expect(elements.handle.classList.contains('dragging')).toBe(true);

      controller.dispose();

      expect(elements.handle.classList.contains('dragging')).toBe(false);
      expect(document.body.style.cursor).toBe('');
    });

    it('ignores operations after dispose', () => {
      controller = new SplitPaneController({ elements });

      controller.dispose();

      // These should not throw
      Object.defineProperty(elements.container, 'offsetWidth', { value: 1000 });
      controller.setSplitRatio(0.5);

      // Handle click shouldn't do anything
      const mousedown = new MouseEvent('mousedown', { clientX: 500 });
      elements.handle.dispatchEvent(mousedown);

      expect(elements.handle.classList.contains('dragging')).toBe(false);
    });
  });
});

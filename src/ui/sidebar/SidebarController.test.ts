/**
 * Tests for SidebarController
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SidebarController, type SidebarControllerElements } from './SidebarController';

function createMockElements(): SidebarControllerElements {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';

  const toggleBtn = document.createElement('button');
  const resizeHandle = document.createElement('div');
  const legend = document.createElement('div');
  const legendHeader = document.createElement('div');

  // Add some sidebar sections
  const section1 = document.createElement('div');
  section1.className = 'sidebar-section';
  const header1 = document.createElement('div');
  header1.className = 'sidebar-section-header';
  section1.appendChild(header1);
  sidebar.appendChild(section1);

  const section2 = document.createElement('div');
  section2.className = 'sidebar-section';
  const header2 = document.createElement('div');
  header2.className = 'sidebar-section-header';
  section2.appendChild(header2);
  sidebar.appendChild(section2);

  return {
    sidebar,
    toggleBtn,
    resizeHandle,
    legend,
    legendHeader,
  };
}

describe('SidebarController', () => {
  let controller: SidebarController;
  let elements: SidebarControllerElements;

  beforeEach(() => {
    elements = createMockElements();
  });

  afterEach(() => {
    controller?.dispose();
  });

  describe('construction', () => {
    it('creates controller with required elements', () => {
      controller = new SidebarController({ elements });
      expect(controller).toBeDefined();
    });

    it('creates controller with minimal elements', () => {
      const minimalElements: SidebarControllerElements = {
        sidebar: document.createElement('div'),
      };
      controller = new SidebarController({ elements: minimalElements });
      expect(controller).toBeDefined();
    });

    it('applies initial visible state by default', () => {
      controller = new SidebarController({ elements });

      expect(elements.sidebar.classList.contains('visible')).toBe(true);
      expect(elements.toggleBtn?.classList.contains('active')).toBe(true);
    });

    it('applies initial hidden state when specified', () => {
      controller = new SidebarController({ elements, initialVisible: false });

      expect(elements.sidebar.classList.contains('visible')).toBe(false);
      expect(elements.toggleBtn?.classList.contains('active')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('toggles visibility on button click', () => {
      controller = new SidebarController({ elements });

      expect(controller.isVisible()).toBe(true);

      elements.toggleBtn?.click();
      expect(controller.isVisible()).toBe(false);
      expect(elements.sidebar.classList.contains('visible')).toBe(false);
      expect(elements.toggleBtn?.classList.contains('active')).toBe(false);

      elements.toggleBtn?.click();
      expect(controller.isVisible()).toBe(true);
      expect(elements.sidebar.classList.contains('visible')).toBe(true);
      expect(elements.toggleBtn?.classList.contains('active')).toBe(true);
    });

    it('calls onVisibilityChange callback', () => {
      const onVisibilityChange = vi.fn();
      controller = new SidebarController({ elements, onVisibilityChange });

      elements.toggleBtn?.click();
      expect(onVisibilityChange).toHaveBeenCalledWith(false);

      elements.toggleBtn?.click();
      expect(onVisibilityChange).toHaveBeenCalledWith(true);
    });
  });

  describe('show/hide methods', () => {
    it('show() makes sidebar visible', () => {
      controller = new SidebarController({ elements, initialVisible: false });

      controller.show();

      expect(controller.isVisible()).toBe(true);
      expect(elements.sidebar.classList.contains('visible')).toBe(true);
    });

    it('hide() makes sidebar hidden', () => {
      controller = new SidebarController({ elements, initialVisible: true });

      controller.hide();

      expect(controller.isVisible()).toBe(false);
      expect(elements.sidebar.classList.contains('visible')).toBe(false);
    });

    it('show() calls onVisibilityChange', () => {
      const onVisibilityChange = vi.fn();
      controller = new SidebarController({ elements, initialVisible: false, onVisibilityChange });

      controller.show();
      expect(onVisibilityChange).toHaveBeenCalledWith(true);
    });

    it('hide() calls onVisibilityChange', () => {
      const onVisibilityChange = vi.fn();
      controller = new SidebarController({ elements, initialVisible: true, onVisibilityChange });

      controller.hide();
      expect(onVisibilityChange).toHaveBeenCalledWith(false);
    });

    it('show() does nothing if already visible', () => {
      const onVisibilityChange = vi.fn();
      controller = new SidebarController({ elements, initialVisible: true, onVisibilityChange });

      controller.show();
      expect(onVisibilityChange).not.toHaveBeenCalled();
    });

    it('hide() does nothing if already hidden', () => {
      const onVisibilityChange = vi.fn();
      controller = new SidebarController({ elements, initialVisible: false, onVisibilityChange });

      controller.hide();
      expect(onVisibilityChange).not.toHaveBeenCalled();
    });

    it('toggle() changes visibility', () => {
      controller = new SidebarController({ elements, initialVisible: true });

      controller.toggle();
      expect(controller.isVisible()).toBe(false);

      controller.toggle();
      expect(controller.isVisible()).toBe(true);
    });

    it('setVisible() sets visibility without callback', () => {
      const onVisibilityChange = vi.fn();
      controller = new SidebarController({ elements, initialVisible: true, onVisibilityChange });

      controller.setVisible(false);
      expect(controller.isVisible()).toBe(false);
      expect(elements.sidebar.classList.contains('visible')).toBe(false);
      // setVisible does not call the callback (used for restoring state)
      expect(onVisibilityChange).not.toHaveBeenCalled();
    });
  });

  describe('legend collapse', () => {
    it('toggles legend collapsed class on header click', () => {
      controller = new SidebarController({ elements });

      expect(elements.legend?.classList.contains('collapsed')).toBe(false);

      elements.legendHeader?.click();
      expect(elements.legend?.classList.contains('collapsed')).toBe(true);

      elements.legendHeader?.click();
      expect(elements.legend?.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('section accordions', () => {
    it('toggles section expanded class on header click', () => {
      controller = new SidebarController({ elements });

      const sectionHeaders = elements.sidebar.querySelectorAll('.sidebar-section-header');
      const section1 = sectionHeaders[0].closest('.sidebar-section');

      expect(section1?.classList.contains('expanded')).toBe(false);

      (sectionHeaders[0] as HTMLElement).click();
      expect(section1?.classList.contains('expanded')).toBe(true);

      (sectionHeaders[0] as HTMLElement).click();
      expect(section1?.classList.contains('expanded')).toBe(false);
    });

    it('toggles sections independently', () => {
      controller = new SidebarController({ elements });

      const sectionHeaders = elements.sidebar.querySelectorAll('.sidebar-section-header');
      const section1 = sectionHeaders[0].closest('.sidebar-section');
      const section2 = sectionHeaders[1].closest('.sidebar-section');

      (sectionHeaders[0] as HTMLElement).click();
      expect(section1?.classList.contains('expanded')).toBe(true);
      expect(section2?.classList.contains('expanded')).toBe(false);

      (sectionHeaders[1] as HTMLElement).click();
      expect(section1?.classList.contains('expanded')).toBe(true);
      expect(section2?.classList.contains('expanded')).toBe(true);
    });
  });

  describe('resize', () => {
    it('starts resize on mousedown', () => {
      controller = new SidebarController({ elements });

      const mousedown = new MouseEvent('mousedown', { clientX: 300 });
      elements.resizeHandle?.dispatchEvent(mousedown);

      expect(elements.resizeHandle?.classList.contains('dragging')).toBe(true);
      expect(document.body.style.cursor).toBe('ew-resize');
    });

    it('resizes sidebar on mousemove', () => {
      controller = new SidebarController({ elements });

      // Set initial width
      elements.sidebar.style.width = '250px';
      Object.defineProperty(elements.sidebar, 'offsetWidth', { value: 250 });

      const mousedown = new MouseEvent('mousedown', { clientX: 300 });
      elements.resizeHandle?.dispatchEvent(mousedown);

      const mousemove = new MouseEvent('mousemove', { clientX: 350 });
      document.dispatchEvent(mousemove);

      expect(elements.sidebar.style.width).toBe('300px');
    });

    it('respects min width constraint', () => {
      controller = new SidebarController({ elements, minWidth: 200 });

      Object.defineProperty(elements.sidebar, 'offsetWidth', { value: 250 });

      const mousedown = new MouseEvent('mousedown', { clientX: 300 });
      elements.resizeHandle?.dispatchEvent(mousedown);

      // Move left by 100px (would result in 150px, below min)
      const mousemove = new MouseEvent('mousemove', { clientX: 200 });
      document.dispatchEvent(mousemove);

      expect(elements.sidebar.style.width).toBe('200px');
    });

    it('respects max width constraint', () => {
      controller = new SidebarController({ elements, maxWidth: 400 });

      Object.defineProperty(elements.sidebar, 'offsetWidth', { value: 350 });

      const mousedown = new MouseEvent('mousedown', { clientX: 300 });
      elements.resizeHandle?.dispatchEvent(mousedown);

      // Move right by 100px (would result in 450px, above max)
      const mousemove = new MouseEvent('mousemove', { clientX: 400 });
      document.dispatchEvent(mousemove);

      expect(elements.sidebar.style.width).toBe('400px');
    });

    it('ends resize on mouseup', () => {
      controller = new SidebarController({ elements });

      const mousedown = new MouseEvent('mousedown', { clientX: 300 });
      elements.resizeHandle?.dispatchEvent(mousedown);

      expect(elements.resizeHandle?.classList.contains('dragging')).toBe(true);

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(elements.resizeHandle?.classList.contains('dragging')).toBe(false);
      expect(document.body.style.cursor).toBe('');
    });

    it('ignores mousemove when not resizing', () => {
      controller = new SidebarController({ elements });

      elements.sidebar.style.width = '250px';

      const mousemove = new MouseEvent('mousemove', { clientX: 350 });
      document.dispatchEvent(mousemove);

      expect(elements.sidebar.style.width).toBe('250px');
    });
  });

  describe('dispose', () => {
    it('removes toggle listener', () => {
      controller = new SidebarController({ elements });

      const removeListenerSpy = vi.spyOn(elements.toggleBtn!, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('removes legend header listener', () => {
      controller = new SidebarController({ elements });

      const removeListenerSpy = vi.spyOn(elements.legendHeader!, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('removes resize listeners', () => {
      controller = new SidebarController({ elements });

      const handleSpy = vi.spyOn(elements.resizeHandle!, 'removeEventListener');
      const documentSpy = vi.spyOn(document, 'removeEventListener');

      controller.dispose();

      expect(handleSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(documentSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(documentSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    it('removes section header listeners', () => {
      controller = new SidebarController({ elements });

      const sectionHeaders = elements.sidebar.querySelectorAll('.sidebar-section-header');
      const removeSpy = vi.spyOn(sectionHeaders[0], 'removeEventListener');

      controller.dispose();

      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('ends active resize on dispose', () => {
      controller = new SidebarController({ elements });

      const mousedown = new MouseEvent('mousedown', { clientX: 300 });
      elements.resizeHandle?.dispatchEvent(mousedown);

      expect(elements.resizeHandle?.classList.contains('dragging')).toBe(true);

      controller.dispose();

      expect(elements.resizeHandle?.classList.contains('dragging')).toBe(false);
      expect(document.body.style.cursor).toBe('');
    });

    it('ignores operations after dispose', () => {
      controller = new SidebarController({ elements });

      controller.dispose();

      // These should not throw
      controller.show();
      controller.hide();
      controller.toggle();
      controller.setVisible(true);

      // Toggle click shouldn't do anything
      elements.toggleBtn?.click();
      expect(elements.sidebar.classList.contains('visible')).toBe(true); // unchanged from disposal state
    });
  });
});

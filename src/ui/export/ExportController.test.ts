/**
 * Tests for ExportController
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ExportController,
  type ExportControllerElements,
  type ExportDataProvider,
} from './ExportController';

// Mock the export module
vi.mock('../../export', () => ({
  exportAsHtml: vi.fn(() => '<html>exported</html>'),
  exportAsMarkdown: vi.fn(() => '# Exported'),
  downloadFile: vi.fn(),
  getSafeFilename: vi.fn((name: string) => name.replace(/[^a-z0-9]/gi, '_')),
}));

import { exportAsHtml, exportAsMarkdown, downloadFile, getSafeFilename } from '../../export';

function createMockElements(): ExportControllerElements {
  const exportBtn = document.createElement('button');
  const dropdown = document.createElement('div');
  dropdown.className = 'export-dropdown';

  const menu = document.createElement('div');
  menu.className = 'export-menu';

  // Add format options
  const htmlOption = document.createElement('button');
  htmlOption.dataset.format = 'html';
  htmlOption.textContent = 'HTML';
  menu.appendChild(htmlOption);

  const mdOption = document.createElement('button');
  mdOption.dataset.format = 'markdown';
  mdOption.textContent = 'Markdown';
  menu.appendChild(mdOption);

  return {
    exportBtn,
    dropdown,
    menu,
  };
}

function createMockDataProvider(): ExportDataProvider {
  return {
    getSearchableContent: vi.fn(() => [
      {
        clusterIndex: 0,
        turnIndex: 0,
        role: 'user' as const,
        userText: 'Hello',
        assistantText: '',
        thinkingText: '',
        thinkingBlocks: [],
        outputText: 'Hello',
        toolCalls: [],
        toolUses: [],
        toolResults: [],
        documents: [],
      },
    ]),
    getConversationTitle: vi.fn(() => 'Test Conversation'),
    getSourceId: vi.fn(() => 'claude-code'),
  };
}

describe('ExportController', () => {
  let controller: ExportController;
  let elements: ExportControllerElements;
  let dataProvider: ExportDataProvider;

  beforeEach(() => {
    elements = createMockElements();
    dataProvider = createMockDataProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    controller?.dispose();
  });

  describe('construction', () => {
    it('creates controller with required elements', () => {
      controller = new ExportController({ elements, dataProvider });
      expect(controller).toBeDefined();
    });

    it('creates controller without menu', () => {
      const minimalElements: ExportControllerElements = {
        exportBtn: document.createElement('button'),
        dropdown: document.createElement('div'),
      };
      controller = new ExportController({ elements: minimalElements, dataProvider });
      expect(controller).toBeDefined();
    });
  });

  describe('dropdown toggle', () => {
    it('opens dropdown on button click', () => {
      controller = new ExportController({ elements, dataProvider });

      expect(elements.dropdown.classList.contains('open')).toBe(false);

      elements.exportBtn.click();

      expect(elements.dropdown.classList.contains('open')).toBe(true);
    });

    it('toggles dropdown on repeated clicks', () => {
      controller = new ExportController({ elements, dataProvider });

      elements.exportBtn.click();
      expect(elements.dropdown.classList.contains('open')).toBe(true);

      elements.exportBtn.click();
      expect(elements.dropdown.classList.contains('open')).toBe(false);
    });

    it('closes dropdown on document click', () => {
      controller = new ExportController({ elements, dataProvider });

      elements.exportBtn.click();
      expect(elements.dropdown.classList.contains('open')).toBe(true);

      document.dispatchEvent(new MouseEvent('click'));
      expect(elements.dropdown.classList.contains('open')).toBe(false);
    });

    it('stops propagation on button click', () => {
      controller = new ExportController({ elements, dataProvider });

      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      elements.exportBtn.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('export actions', () => {
    it('exports as HTML when html option clicked', () => {
      controller = new ExportController({ elements, dataProvider });

      const htmlOption = elements.menu?.querySelector('[data-format="html"]') as HTMLElement;
      htmlOption.click();

      expect(dataProvider.getSearchableContent).toHaveBeenCalled();
      expect(dataProvider.getConversationTitle).toHaveBeenCalled();
      expect(exportAsHtml).toHaveBeenCalled();
      expect(downloadFile).toHaveBeenCalledWith(
        '<html>exported</html>',
        'Test_Conversation.html',
        'text/html'
      );
    });

    it('exports as Markdown when markdown option clicked', () => {
      controller = new ExportController({ elements, dataProvider });

      const mdOption = elements.menu?.querySelector('[data-format="markdown"]') as HTMLElement;
      mdOption.click();

      expect(dataProvider.getSearchableContent).toHaveBeenCalled();
      expect(dataProvider.getConversationTitle).toHaveBeenCalled();
      expect(exportAsMarkdown).toHaveBeenCalled();
      expect(downloadFile).toHaveBeenCalledWith(
        '# Exported',
        'Test_Conversation.md',
        'text/markdown'
      );
    });

    it('closes dropdown after export', () => {
      controller = new ExportController({ elements, dataProvider });

      elements.exportBtn.click();
      expect(elements.dropdown.classList.contains('open')).toBe(true);

      const htmlOption = elements.menu?.querySelector('[data-format="html"]') as HTMLElement;
      htmlOption.click();

      expect(elements.dropdown.classList.contains('open')).toBe(false);
    });

    it('uses default title when none provided', () => {
      const providerWithNoTitle: ExportDataProvider = {
        getSearchableContent: vi.fn(() => []),
        getConversationTitle: vi.fn(() => undefined),
        getSourceId: vi.fn(() => undefined),
      };
      controller = new ExportController({ elements, dataProvider: providerWithNoTitle });

      const htmlOption = elements.menu?.querySelector('[data-format="html"]') as HTMLElement;
      htmlOption.click();

      expect(getSafeFilename).toHaveBeenCalledWith('Conversation Export');
    });

    it('ignores clicks on elements without data-format', () => {
      controller = new ExportController({ elements, dataProvider });

      // Click on menu container itself (no data-format)
      elements.menu?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(exportAsHtml).not.toHaveBeenCalled();
      expect(exportAsMarkdown).not.toHaveBeenCalled();
    });
  });

  describe('public methods', () => {
    it('isOpen returns correct state', () => {
      controller = new ExportController({ elements, dataProvider });

      expect(controller.isOpen()).toBe(false);

      elements.exportBtn.click();
      expect(controller.isOpen()).toBe(true);

      document.dispatchEvent(new MouseEvent('click'));
      expect(controller.isOpen()).toBe(false);
    });

    it('openDropdown opens the dropdown', () => {
      controller = new ExportController({ elements, dataProvider });

      controller.openDropdown();
      expect(elements.dropdown.classList.contains('open')).toBe(true);
    });

    it('closeDropdown closes the dropdown', () => {
      controller = new ExportController({ elements, dataProvider });

      controller.openDropdown();
      controller.closeDropdown();
      expect(elements.dropdown.classList.contains('open')).toBe(false);
    });

    it('enable enables the export button', () => {
      controller = new ExportController({ elements, dataProvider });

      (elements.exportBtn as HTMLButtonElement).disabled = true;
      controller.enable();
      expect((elements.exportBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('disable disables the export button', () => {
      controller = new ExportController({ elements, dataProvider });

      controller.disable();
      expect((elements.exportBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('dispose', () => {
    it('removes button listener', () => {
      controller = new ExportController({ elements, dataProvider });

      const removeListenerSpy = vi.spyOn(elements.exportBtn, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('removes document listener', () => {
      controller = new ExportController({ elements, dataProvider });

      const removeListenerSpy = vi.spyOn(document, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('removes menu listener', () => {
      controller = new ExportController({ elements, dataProvider });

      const removeListenerSpy = vi.spyOn(elements.menu!, 'removeEventListener');

      controller.dispose();

      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('closes dropdown on dispose', () => {
      controller = new ExportController({ elements, dataProvider });

      controller.openDropdown();
      expect(elements.dropdown.classList.contains('open')).toBe(true);

      controller.dispose();
      expect(elements.dropdown.classList.contains('open')).toBe(false);
    });

    it('ignores operations after dispose', () => {
      controller = new ExportController({ elements, dataProvider });

      controller.dispose();

      // These should not throw
      controller.openDropdown();
      controller.closeDropdown();
      controller.enable();
      controller.disable();

      // Button click shouldn't do anything
      elements.exportBtn.click();
      expect(elements.dropdown.classList.contains('open')).toBe(false);
    });
  });
});

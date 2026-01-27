/**
 * ExportController
 *
 * Manages export dropdown and export actions including:
 * - Dropdown toggle on button click
 * - Close dropdown when clicking outside
 * - Handle export format selection (HTML, Markdown)
 */

import {
  exportAsHtml,
  exportAsMarkdown,
  downloadFile,
  getSafeFilename,
} from '../../export';
import type { SearchableCluster } from '../types';

/**
 * Interface for getting export data from the viewer
 */
export interface ExportDataProvider {
  /** Get searchable content for export */
  getSearchableContent(): SearchableCluster[];
  /** Get conversation title */
  getConversationTitle(): string | undefined;
  /** Get source ID (e.g., 'claude-code') */
  getSourceId(): string | undefined;
}

/**
 * DOM elements for ExportController
 */
export interface ExportControllerElements {
  /** Export button that toggles dropdown */
  exportBtn: HTMLElement;
  /** Dropdown container */
  dropdown: Element;
  /** Menu with format options */
  menu?: Element | null;
}

/**
 * Configuration options for ExportController
 */
export interface ExportControllerOptions {
  /** DOM elements */
  elements: ExportControllerElements;
  /** Data provider for export content */
  dataProvider: ExportDataProvider;
}

export class ExportController {
  private elements: ExportControllerElements;
  private dataProvider: ExportDataProvider;
  private disposed = false;

  // Bound handlers for cleanup
  private boundHandleButtonClick: (e: MouseEvent) => void;
  private boundHandleDocumentClick: () => void;
  private boundHandleMenuClick: (e: MouseEvent) => void;

  constructor(options: ExportControllerOptions) {
    this.elements = options.elements;
    this.dataProvider = options.dataProvider;

    // Bind handlers
    this.boundHandleButtonClick = this.handleButtonClick.bind(this);
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
    this.boundHandleMenuClick = this.handleMenuClick.bind(this);

    this.attachListeners();
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    const { exportBtn, menu } = this.elements;

    exportBtn.addEventListener('click', this.boundHandleButtonClick);
    document.addEventListener('click', this.boundHandleDocumentClick);
    (menu as HTMLElement)?.addEventListener('click', this.boundHandleMenuClick);
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    const { exportBtn, menu } = this.elements;

    exportBtn.removeEventListener('click', this.boundHandleButtonClick);
    document.removeEventListener('click', this.boundHandleDocumentClick);
    (menu as HTMLElement)?.removeEventListener('click', this.boundHandleMenuClick);
  }

  /**
   * Handle export button click - toggle dropdown
   */
  private handleButtonClick(e: MouseEvent): void {
    if (this.disposed) return;

    e.stopPropagation();
    this.elements.dropdown.classList.toggle('open');
  }

  /**
   * Handle document click - close dropdown
   */
  private handleDocumentClick(): void {
    if (this.disposed) return;

    this.elements.dropdown.classList.remove('open');
  }

  /**
   * Handle menu click - export in selected format
   */
  private handleMenuClick(e: MouseEvent): void {
    if (this.disposed) return;

    const target = e.target as HTMLElement;
    const format = target.dataset.format;

    if (!format) return;

    this.exportAs(format);
    this.closeDropdown();
  }

  /**
   * Export conversation in the specified format
   */
  private exportAs(format: string): void {
    const clusters = this.dataProvider.getSearchableContent();
    const title = this.dataProvider.getConversationTitle() || 'Conversation Export';
    const sourceId = this.dataProvider.getSourceId();
    const safeFilename = getSafeFilename(title);

    if (format === 'html') {
      const html = exportAsHtml(clusters, title, sourceId);
      downloadFile(html, `${safeFilename}.html`, 'text/html');
    } else if (format === 'markdown') {
      const md = exportAsMarkdown(clusters, title, sourceId);
      downloadFile(md, `${safeFilename}.md`, 'text/markdown');
    }
  }

  /**
   * Check if dropdown is currently open
   */
  public isOpen(): boolean {
    return this.elements.dropdown.classList.contains('open');
  }

  /**
   * Open the dropdown
   */
  public openDropdown(): void {
    if (this.disposed) return;

    this.elements.dropdown.classList.add('open');
  }

  /**
   * Close the dropdown
   */
  public closeDropdown(): void {
    if (this.disposed) return;

    this.elements.dropdown.classList.remove('open');
  }

  /**
   * Enable the export button
   */
  public enable(): void {
    if (this.disposed) return;

    (this.elements.exportBtn as HTMLButtonElement).disabled = false;
  }

  /**
   * Disable the export button
   */
  public disable(): void {
    if (this.disposed) return;

    (this.elements.exportBtn as HTMLButtonElement).disabled = true;
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.disposed) return;

    // Close dropdown before setting disposed flag
    this.elements.dropdown.classList.remove('open');

    this.disposed = true;
    this.detachListeners();
  }
}

/**
 * SidebarController
 *
 * Manages sidebar functionality including:
 * - Sidebar visibility toggle
 * - Sidebar resizing
 * - Sidebar section accordions
 * - Legend collapse
 */

/**
 * DOM elements for SidebarController
 */
export interface SidebarControllerElements {
  /** The sidebar container */
  sidebar: HTMLElement;
  /** Toggle button to show/hide sidebar */
  toggleBtn?: HTMLElement | null;
  /** Resize handle for sidebar width */
  resizeHandle?: HTMLElement | null;
  /** Legend element (for collapse toggle) */
  legend?: HTMLElement | null;
  /** Legend header (clickable to collapse) */
  legendHeader?: HTMLElement | null;
}

/**
 * Configuration options for SidebarController
 */
export interface SidebarControllerOptions {
  /** DOM elements */
  elements: SidebarControllerElements;
  /** Initial visibility state */
  initialVisible?: boolean;
  /** Min sidebar width when resizing */
  minWidth?: number;
  /** Max sidebar width when resizing */
  maxWidth?: number;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
}

export class SidebarController {
  private elements: SidebarControllerElements;
  private visible: boolean;
  private disposed = false;
  private minWidth: number;
  private maxWidth: number;
  private onVisibilityChange?: (visible: boolean) => void;

  // Resize state
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  // Bound handlers for cleanup
  private boundHandleToggle: () => void;
  private boundHandleLegendToggle: () => void;
  private boundHandleResizeStart: (e: MouseEvent) => void;
  private boundHandleResizeMove: (e: MouseEvent) => void;
  private boundHandleResizeEnd: () => void;
  private sectionHeaderHandlers: Map<HTMLElement, () => void> = new Map();

  constructor(options: SidebarControllerOptions) {
    this.elements = options.elements;
    this.visible = options.initialVisible ?? true;
    this.minWidth = options.minWidth ?? 200;
    this.maxWidth = options.maxWidth ?? 400;
    this.onVisibilityChange = options.onVisibilityChange;

    // Bind handlers
    this.boundHandleToggle = this.handleToggle.bind(this);
    this.boundHandleLegendToggle = this.handleLegendToggle.bind(this);
    this.boundHandleResizeStart = this.handleResizeStart.bind(this);
    this.boundHandleResizeMove = this.handleResizeMove.bind(this);
    this.boundHandleResizeEnd = this.handleResizeEnd.bind(this);

    this.attachListeners();

    // Apply initial state
    this.applyVisibility();
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    const { toggleBtn, resizeHandle, legendHeader, sidebar } = this.elements;

    // Toggle button
    toggleBtn?.addEventListener('click', this.boundHandleToggle);

    // Legend collapse
    legendHeader?.addEventListener('click', this.boundHandleLegendToggle);

    // Resize handle
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', this.boundHandleResizeStart);
      document.addEventListener('mousemove', this.boundHandleResizeMove);
      document.addEventListener('mouseup', this.boundHandleResizeEnd);
    }

    // Sidebar section accordions
    const sectionHeaders = sidebar.querySelectorAll('.sidebar-section-header');
    sectionHeaders.forEach((header) => {
      const handler = () => {
        const section = header.closest('.sidebar-section');
        if (section) {
          section.classList.toggle('expanded');
        }
      };
      this.sectionHeaderHandlers.set(header as HTMLElement, handler);
      header.addEventListener('click', handler);
    });
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    const { toggleBtn, resizeHandle, legendHeader } = this.elements;

    toggleBtn?.removeEventListener('click', this.boundHandleToggle);
    legendHeader?.removeEventListener('click', this.boundHandleLegendToggle);

    if (resizeHandle) {
      resizeHandle.removeEventListener('mousedown', this.boundHandleResizeStart);
      document.removeEventListener('mousemove', this.boundHandleResizeMove);
      document.removeEventListener('mouseup', this.boundHandleResizeEnd);
    }

    // Remove section header handlers
    for (const [header, handler] of this.sectionHeaderHandlers) {
      header.removeEventListener('click', handler);
    }
    this.sectionHeaderHandlers.clear();
  }

  /**
   * Apply current visibility state to DOM
   */
  private applyVisibility(): void {
    const { sidebar, toggleBtn } = this.elements;

    if (this.visible) {
      sidebar.classList.add('visible');
      toggleBtn?.classList.add('active');
    } else {
      sidebar.classList.remove('visible');
      toggleBtn?.classList.remove('active');
    }
  }

  /**
   * Handle toggle button click
   */
  private handleToggle(): void {
    if (this.disposed) return;

    this.visible = !this.visible;
    this.applyVisibility();
    this.onVisibilityChange?.(this.visible);
  }

  /**
   * Handle legend header click (collapse toggle)
   */
  private handleLegendToggle(): void {
    if (this.disposed) return;

    const { legend } = this.elements;
    legend?.classList.toggle('collapsed');
  }

  /**
   * Handle resize start
   */
  private handleResizeStart(e: MouseEvent): void {
    if (this.disposed) return;

    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.elements.sidebar.offsetWidth;

    this.elements.resizeHandle?.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  /**
   * Handle resize move
   */
  private handleResizeMove(e: MouseEvent): void {
    if (!this.isResizing || this.disposed) return;

    const delta = e.clientX - this.resizeStartX;
    const newWidth = Math.min(this.maxWidth, Math.max(this.minWidth, this.resizeStartWidth + delta));
    this.elements.sidebar.style.width = `${newWidth}px`;
  }

  /**
   * Handle resize end
   */
  private handleResizeEnd(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.elements.resizeHandle?.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  /**
   * Check if sidebar is currently visible
   */
  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * Show the sidebar
   */
  public show(): void {
    if (this.disposed || this.visible) return;

    this.visible = true;
    this.applyVisibility();
    this.onVisibilityChange?.(this.visible);
  }

  /**
   * Hide the sidebar
   */
  public hide(): void {
    if (this.disposed || !this.visible) return;

    this.visible = false;
    this.applyVisibility();
    this.onVisibilityChange?.(this.visible);
  }

  /**
   * Toggle sidebar visibility
   */
  public toggle(): void {
    if (this.disposed) return;

    this.visible = !this.visible;
    this.applyVisibility();
    this.onVisibilityChange?.(this.visible);
  }

  /**
   * Set visibility state (used when restoring from saved state)
   */
  public setVisible(visible: boolean): void {
    if (this.disposed) return;

    this.visible = visible;
    this.applyVisibility();
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // End any active resize
    if (this.isResizing) {
      this.handleResizeEnd();
    }

    this.detachListeners();
  }
}

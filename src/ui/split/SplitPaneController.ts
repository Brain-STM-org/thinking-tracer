/**
 * SplitPaneController
 *
 * Manages split pane resizing including:
 * - Drag handle for resizing
 * - Min/max width constraints
 * - Triggering resize events for canvas updates
 */

/**
 * DOM elements for SplitPaneController
 */
export interface SplitPaneControllerElements {
  /** The drag handle element */
  handle: HTMLElement;
  /** The left/primary pane (canvas) */
  primaryPane: HTMLElement;
  /** The right/secondary pane (conversation) */
  secondaryPane: HTMLElement;
  /** The container holding both panes */
  container: HTMLElement;
}

/**
 * Configuration options for SplitPaneController
 */
export interface SplitPaneControllerOptions {
  /** DOM elements */
  elements: SplitPaneControllerElements;
  /** Minimum width of primary pane in pixels */
  minPrimaryWidth?: number;
  /** Minimum width of secondary pane in pixels */
  minSecondaryWidth?: number;
  /** Gap between panes (handle width) in pixels */
  gapWidth?: number;
  /** Callback when resize ends */
  onResizeEnd?: () => void;
}

export class SplitPaneController {
  private elements: SplitPaneControllerElements;
  private disposed = false;
  private isDragging = false;
  private minPrimaryWidth: number;
  private minSecondaryWidth: number;
  private gapWidth: number;
  private onResizeEnd?: () => void;

  // Bound handlers for cleanup
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleMouseUp: () => void;

  constructor(options: SplitPaneControllerOptions) {
    this.elements = options.elements;
    this.minPrimaryWidth = options.minPrimaryWidth ?? 300;
    this.minSecondaryWidth = options.minSecondaryWidth ?? 250;
    this.gapWidth = options.gapWidth ?? 6;
    this.onResizeEnd = options.onResizeEnd;

    // Bind handlers
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);

    this.attachListeners();
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    const { handle } = this.elements;

    handle.addEventListener('mousedown', this.boundHandleMouseDown);
    document.addEventListener('mousemove', this.boundHandleMouseMove);
    document.addEventListener('mouseup', this.boundHandleMouseUp);
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    const { handle } = this.elements;

    handle.removeEventListener('mousedown', this.boundHandleMouseDown);
    document.removeEventListener('mousemove', this.boundHandleMouseMove);
    document.removeEventListener('mouseup', this.boundHandleMouseUp);
  }

  /**
   * Handle mouse down on drag handle
   */
  private handleMouseDown(e: MouseEvent): void {
    if (this.disposed) return;

    this.isDragging = true;
    this.elements.handle.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  /**
   * Handle mouse move during drag
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging || this.disposed) return;

    const { primaryPane, secondaryPane, container } = this.elements;

    // Get position relative to container, not viewport
    const containerRect = container.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;

    // Check constraints
    const secondaryWidth = containerWidth - relativeX - this.gapWidth;
    if (relativeX >= this.minPrimaryWidth && secondaryWidth >= this.minSecondaryWidth) {
      primaryPane.style.flex = 'none';
      primaryPane.style.width = `${relativeX}px`;
      // Let secondary flex to fill remaining space (stays attached to right edge on window resize)
      secondaryPane.style.flex = '1';
      secondaryPane.style.width = '';
    }
  }

  /**
   * Handle mouse up to end drag
   */
  private handleMouseUp(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.elements.handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Trigger resize callback (e.g., for Three.js canvas)
    this.onResizeEnd?.();
  }

  /**
   * Check if currently dragging
   */
  public isDraggingActive(): boolean {
    return this.isDragging;
  }

  /**
   * Get current split ratio (primary width / container width)
   */
  public getSplitRatio(): number {
    const { primaryPane, container } = this.elements;
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return 0.5;
    return primaryPane.offsetWidth / containerWidth;
  }

  /**
   * Set split ratio (0-1)
   */
  public setSplitRatio(ratio: number): void {
    if (this.disposed) return;

    const { primaryPane, secondaryPane, container } = this.elements;
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;

    const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
    const primaryWidth = clampedRatio * containerWidth;

    primaryPane.style.flex = 'none';
    primaryPane.style.width = `${primaryWidth}px`;
    // Let secondary flex to fill remaining space (stays attached to right edge on window resize)
    secondaryPane.style.flex = '1';
    secondaryPane.style.width = '';
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.disposed) return;

    // End any active drag
    if (this.isDragging) {
      this.isDragging = false;
      this.elements.handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    this.disposed = true;
    this.detachListeners();
  }
}

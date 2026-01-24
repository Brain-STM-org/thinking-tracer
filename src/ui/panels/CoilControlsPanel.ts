/**
 * CoilControlsPanel
 *
 * Handles the coil/spiral layout controls including:
 * - Panel visibility toggle
 * - Coil parameter sliders (spiral radius, angle step, etc.)
 * - Cluster line controls (toggle, color, width, opacity)
 * - Reset to defaults
 */

/**
 * Coil parameters interface (from Viewer)
 */
export interface CoilParams {
  spiralRadius: number;
  spiralAngleStep: number;
  coilRadius: number;
  coilAngleStep: number;
  coilVerticalStep: number;
  focusRadius: number;
  minVerticalSpacing: number;
  maxVerticalSpacing: number;
}

/**
 * Viewer interface for coil controls
 */
export interface CoilControllableViewer {
  getCoilParams(): CoilParams;
  setCoilParam(name: string, value: number): void;
  resetCoilParams(): void;
  getShowClusterLines(): boolean;
  setShowClusterLines(show: boolean): void;
  getClusterLineColor(): number;
  setClusterLineColor(color: number): void;
  getClusterLineWidth(): number;
  setClusterLineWidth(width: number): void;
  getClusterLineOpacity(): number;
  setClusterLineOpacity(opacity: number): void;
}

/**
 * DOM elements for CoilControlsPanel
 */
export interface CoilControlsPanelElements {
  /** Toggle button to show/hide panel */
  toggleBtn: HTMLElement;
  /** The panel container */
  panel: HTMLElement;
  /** Reset button */
  resetBtn?: HTMLElement | null;
  /** Container for coil parameter sliders */
  sliders: NodeListOf<Element> | HTMLElement[];
  /** Cluster lines checkbox */
  clusterLinesToggle?: HTMLInputElement | null;
  /** Container for line options (shown when lines enabled) */
  clusterLineOptions?: HTMLElement | null;
  /** Line color input */
  lineColor?: HTMLInputElement | null;
  /** Line color value display */
  lineColorValue?: HTMLElement | null;
  /** Line width input */
  lineWidth?: HTMLInputElement | null;
  /** Line width value display */
  lineWidthValue?: HTMLElement | null;
  /** Line opacity input */
  lineOpacity?: HTMLInputElement | null;
  /** Line opacity value display */
  lineOpacityValue?: HTMLElement | null;
}

export class CoilControlsPanel {
  private elements: CoilControlsPanelElements;
  private viewer: CoilControllableViewer;
  private disposed = false;

  // Bound handlers for cleanup
  private boundHandleToggle: () => void;
  private boundHandleReset: () => void;
  private boundHandleLinesToggle: () => void;
  private boundHandleColorChange: () => void;
  private boundHandleWidthChange: () => void;
  private boundHandleOpacityChange: () => void;
  private sliderHandlers: Map<HTMLInputElement, () => void> = new Map();

  constructor(elements: CoilControlsPanelElements, viewer: CoilControllableViewer) {
    this.elements = elements;
    this.viewer = viewer;

    // Bind handlers
    this.boundHandleToggle = this.handleToggle.bind(this);
    this.boundHandleReset = this.handleReset.bind(this);
    this.boundHandleLinesToggle = this.handleLinesToggle.bind(this);
    this.boundHandleColorChange = this.handleColorChange.bind(this);
    this.boundHandleWidthChange = this.handleWidthChange.bind(this);
    this.boundHandleOpacityChange = this.handleOpacityChange.bind(this);

    this.attachListeners();
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    const {
      toggleBtn,
      resetBtn,
      sliders,
      clusterLinesToggle,
      lineColor,
      lineWidth,
      lineOpacity,
    } = this.elements;

    // Panel toggle
    toggleBtn.addEventListener('click', this.boundHandleToggle);

    // Reset button
    resetBtn?.addEventListener('click', this.boundHandleReset);

    // Cluster lines toggle
    clusterLinesToggle?.addEventListener('change', this.boundHandleLinesToggle);

    // Line appearance controls
    lineColor?.addEventListener('input', this.boundHandleColorChange);
    lineWidth?.addEventListener('input', this.boundHandleWidthChange);
    lineOpacity?.addEventListener('input', this.boundHandleOpacityChange);

    // Coil parameter sliders
    sliders.forEach((sliderDiv) => {
      const param = (sliderDiv as HTMLElement).dataset.param;
      const input = sliderDiv.querySelector('input') as HTMLInputElement;
      const valueSpan = sliderDiv.querySelector('.coil-value') as HTMLElement;

      if (input && param) {
        const handler = () => {
          const value = parseFloat(input.value);
          if (valueSpan) {
            valueSpan.textContent = value.toFixed(2);
          }
          this.viewer.setCoilParam(param, value);
        };
        this.sliderHandlers.set(input, handler);
        input.addEventListener('input', handler);
      }
    });
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    const {
      toggleBtn,
      resetBtn,
      clusterLinesToggle,
      lineColor,
      lineWidth,
      lineOpacity,
    } = this.elements;

    toggleBtn.removeEventListener('click', this.boundHandleToggle);
    resetBtn?.removeEventListener('click', this.boundHandleReset);
    clusterLinesToggle?.removeEventListener('change', this.boundHandleLinesToggle);
    lineColor?.removeEventListener('input', this.boundHandleColorChange);
    lineWidth?.removeEventListener('input', this.boundHandleWidthChange);
    lineOpacity?.removeEventListener('input', this.boundHandleOpacityChange);

    // Remove slider handlers
    for (const [input, handler] of this.sliderHandlers) {
      input.removeEventListener('input', handler);
    }
    this.sliderHandlers.clear();
  }

  /**
   * Handle panel toggle
   */
  private handleToggle(): void {
    if (this.disposed) return;

    const { panel, toggleBtn } = this.elements;
    const isVisible = panel.classList.toggle('visible');
    toggleBtn.classList.toggle('active', isVisible);

    // Initialize slider values when opening
    if (isVisible) {
      this.syncFromViewer();
    }
  }

  /**
   * Handle reset button
   */
  private handleReset(): void {
    if (this.disposed) return;

    this.viewer.resetCoilParams();
    this.syncFromViewer();
  }

  /**
   * Handle cluster lines toggle
   */
  private handleLinesToggle(): void {
    if (this.disposed) return;

    const { clusterLinesToggle, clusterLineOptions } = this.elements;
    if (!clusterLinesToggle) return;

    this.viewer.setShowClusterLines(clusterLinesToggle.checked);
    clusterLineOptions?.classList.toggle('visible', clusterLinesToggle.checked);
  }

  /**
   * Handle line color change
   */
  private handleColorChange(): void {
    if (this.disposed) return;

    const { lineColor, lineColorValue } = this.elements;
    if (!lineColor) return;

    const hex = parseInt(lineColor.value.slice(1), 16);
    this.viewer.setClusterLineColor(hex);
    if (lineColorValue) {
      lineColorValue.textContent = lineColor.value.toUpperCase();
    }
  }

  /**
   * Handle line width change
   */
  private handleWidthChange(): void {
    if (this.disposed) return;

    const { lineWidth, lineWidthValue } = this.elements;
    if (!lineWidth) return;

    const width = parseFloat(lineWidth.value);
    this.viewer.setClusterLineWidth(width);
    if (lineWidthValue) {
      lineWidthValue.textContent = String(Math.round(width));
    }
  }

  /**
   * Handle line opacity change
   */
  private handleOpacityChange(): void {
    if (this.disposed) return;

    const { lineOpacity, lineOpacityValue } = this.elements;
    if (!lineOpacity) return;

    const opacity = parseFloat(lineOpacity.value);
    this.viewer.setClusterLineOpacity(opacity);
    if (lineOpacityValue) {
      lineOpacityValue.textContent = opacity.toFixed(2);
    }
  }

  /**
   * Sync all UI controls from viewer state
   */
  public syncFromViewer(): void {
    if (this.disposed) return;

    const {
      sliders,
      clusterLinesToggle,
      clusterLineOptions,
      lineColor,
      lineColorValue,
      lineWidth,
      lineWidthValue,
      lineOpacity,
      lineOpacityValue,
    } = this.elements;

    // Sync coil parameters
    const params = this.viewer.getCoilParams();
    sliders.forEach((sliderDiv) => {
      const param = (sliderDiv as HTMLElement).dataset.param;
      if (!param) return;
      const input = sliderDiv.querySelector('input') as HTMLInputElement;
      const valueSpan = sliderDiv.querySelector('.coil-value') as HTMLElement;
      if (input && valueSpan && param in params) {
        const value = params[param as keyof CoilParams];
        input.value = String(value);
        valueSpan.textContent = value.toFixed(2);
      }
    });

    // Sync cluster lines state
    const showLines = this.viewer.getShowClusterLines();
    if (clusterLinesToggle) {
      clusterLinesToggle.checked = showLines;
    }
    clusterLineOptions?.classList.toggle('visible', showLines);

    // Sync line color
    if (lineColor) {
      const colorHex = '#' + this.viewer.getClusterLineColor().toString(16).padStart(6, '0');
      lineColor.value = colorHex;
      if (lineColorValue) {
        lineColorValue.textContent = colorHex.toUpperCase();
      }
    }

    // Sync line width
    if (lineWidth && lineWidthValue) {
      const width = this.viewer.getClusterLineWidth();
      lineWidth.value = String(width);
      lineWidthValue.textContent = String(Math.round(width));
    }

    // Sync line opacity
    if (lineOpacity && lineOpacityValue) {
      const opacity = this.viewer.getClusterLineOpacity();
      lineOpacity.value = String(opacity);
      lineOpacityValue.textContent = opacity.toFixed(2);
    }
  }

  /**
   * Check if panel is currently visible
   */
  public isVisible(): boolean {
    return this.elements.panel.classList.contains('visible');
  }

  /**
   * Show the panel
   */
  public show(): void {
    if (this.disposed) return;

    this.elements.panel.classList.add('visible');
    this.elements.toggleBtn.classList.add('active');
    this.syncFromViewer();
  }

  /**
   * Hide the panel
   */
  public hide(): void {
    if (this.disposed) return;

    this.elements.panel.classList.remove('visible');
    this.elements.toggleBtn.classList.remove('active');
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.detachListeners();
  }
}

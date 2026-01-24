/**
 * UI Configuration
 *
 * Defines all UI-related constants including size constraints,
 * chart parameters, and display thresholds.
 */

/**
 * Sidebar size constraints (in pixels)
 */
export interface SidebarConfig {
  /** Minimum width */
  minWidth: number;
  /** Maximum width */
  maxWidth: number;
  /** Default width */
  defaultWidth: number;
}

/**
 * Split pane constraints (in pixels)
 */
export interface SplitPaneConfig {
  /** Minimum canvas pane width */
  minCanvasWidth: number;
  /** Minimum conversation pane width */
  minConversationWidth: number;
  /** Handle width */
  handleWidth: number;
}

/**
 * Metrics chart configuration (in pixels)
 */
export interface ChartConfig {
  /** Minimum bar width */
  minBarWidth: number;
  /** Gap between bars */
  barGap: number;
  /** Chart padding */
  padding: number;
  /** Chart height */
  height: number;
  /** Minimum visible bar height */
  minBarHeight: number;
}

/**
 * Text display thresholds
 */
export interface TextDisplayConfig {
  /** Character count threshold for showing length indicator */
  lengthIndicatorThreshold: number;
  /** Minimum word length for word frequency analysis */
  minWordLength: number;
  /** Maximum words to display in frequency panel */
  maxFrequencyWords: number;
  /** Truncation threshold for file paths (characters) */
  pathTruncationLength: number;
}

/**
 * Scroll behavior configuration
 */
export interface ScrollConfig {
  /** Focus point as fraction of container height (0-1) */
  focusPointRatio: number;
  /** Truncation check buffer (pixels) */
  truncationBuffer: number;
  /** Max height for truncated content (pixels) */
  truncatedMaxHeight: number;
}

/**
 * Renderer configuration
 */
export interface RendererConfig {
  /** Maximum pixel ratio (for performance on high-DPI displays) */
  maxPixelRatio: number;
}

/**
 * Complete UI configuration
 */
export interface UIConfig {
  sidebar: SidebarConfig;
  splitPane: SplitPaneConfig;
  chart: ChartConfig;
  textDisplay: TextDisplayConfig;
  scroll: ScrollConfig;
  renderer: RendererConfig;
}

/**
 * Default sidebar configuration
 */
export const DEFAULT_SIDEBAR: SidebarConfig = {
  minWidth: 200,
  maxWidth: 400,
  defaultWidth: 280,
};

/**
 * Default split pane configuration
 */
export const DEFAULT_SPLIT_PANE: SplitPaneConfig = {
  minCanvasWidth: 300,
  minConversationWidth: 250,
  handleWidth: 6,
};

/**
 * Default chart configuration
 */
export const DEFAULT_CHART: ChartConfig = {
  minBarWidth: 4,
  barGap: 1,
  padding: 2,
  height: 24,
  minBarHeight: 3,
};

/**
 * Default text display configuration
 */
export const DEFAULT_TEXT_DISPLAY: TextDisplayConfig = {
  lengthIndicatorThreshold: 200,
  minWordLength: 3,
  maxFrequencyWords: 10,
  pathTruncationLength: 50,
};

/**
 * Default scroll configuration
 */
export const DEFAULT_SCROLL: ScrollConfig = {
  focusPointRatio: 1 / 3, // Upper third
  truncationBuffer: 10,
  truncatedMaxHeight: 120,
};

/**
 * Default renderer configuration
 */
export const DEFAULT_RENDERER: RendererConfig = {
  maxPixelRatio: 2,
};

/**
 * Complete default UI configuration
 */
export const DEFAULT_UI_CONFIG: UIConfig = {
  sidebar: DEFAULT_SIDEBAR,
  splitPane: DEFAULT_SPLIT_PANE,
  chart: DEFAULT_CHART,
  textDisplay: DEFAULT_TEXT_DISPLAY,
  scroll: DEFAULT_SCROLL,
  renderer: DEFAULT_RENDERER,
};

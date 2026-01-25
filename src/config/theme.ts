/**
 * Theme Configuration
 *
 * Defines all color and material properties for the visualization.
 * Colors are stored as hex numbers (0xRRGGBB) for Three.js compatibility.
 */

/**
 * Material properties for Three.js materials
 */
export interface MaterialProperties {
  /** Surface roughness (0 = mirror, 1 = diffuse) */
  roughness: number;
  /** Metalness (0 = non-metal, 1 = metal) */
  metalness?: number;
  /** Opacity for transparent materials (0-1) */
  opacity?: number;
  /** Whether material is transparent */
  transparent?: boolean;
  /** Emissive color for glow effects */
  emissive?: number;
  /** Emissive intensity */
  emissiveIntensity?: number;
}

/**
 * Node appearance configuration
 */
export interface NodeTheme {
  /** Primary color (hex) */
  color: number;
  /** Material properties */
  material: MaterialProperties;
}

/**
 * All node type themes
 */
export interface NodeThemes {
  user: NodeTheme;
  assistant: NodeTheme;
  thinking: NodeTheme;
  toolUse: NodeTheme;
  toolResult: NodeTheme;
  toolResultSuccess: NodeTheme;
  document: NodeTheme;
  cluster: NodeTheme;
}

/**
 * Highlight/selection theme
 */
export interface HighlightTheme {
  /** Highlight color */
  color: number;
  /** Material properties */
  material: MaterialProperties;
  /** Search result highlight color */
  searchColor: number;
}

/**
 * Connection line theme
 */
export interface LineTheme {
  /** Line color */
  color: number;
  /** Line opacity */
  opacity: number;
  /** Line width in pixels */
  width: number;
}

/**
 * Scene/environment theme
 */
export interface SceneTheme {
  /** Background color */
  background: number;
  /** Ambient light color */
  ambientLightColor: number;
  /** Ambient light intensity */
  ambientLightIntensity: number;
  /** Main directional light color */
  mainLightColor: number;
  /** Main directional light intensity */
  mainLightIntensity: number;
  /** Fill light color */
  fillLightColor: number;
  /** Fill light intensity */
  fillLightIntensity: number;
}

/**
 * Chart/metrics colors (CSS format)
 */
export interface ChartColors {
  totalTokens: string;
  outputTokens: string;
  inputTokens: string;
  thinkingCount: string;
  toolCount: string;
  contentLength: string;
  background: string;
}

/**
 * Word frequency highlight palette
 */
export type HighlightPalette = number[];

/**
 * UI text colors (CSS format)
 */
export interface UIColors {
  /** Muted/secondary text */
  muted: string;
  /** Placeholder text */
  placeholder: string;
  /** Success notification background */
  successBackground: string;
  /** Success notification text */
  successText: string;
}

/**
 * Complete theme configuration
 */
export interface ThemeConfig {
  nodes: NodeThemes;
  highlight: HighlightTheme;
  connectionLine: LineTheme;
  clusterLine: LineTheme;
  scene: SceneTheme;
  chart: ChartColors;
  wordHighlightPalette: HighlightPalette;
  ui: UIColors;
}

/**
 * Default node themes
 */
export const DEFAULT_NODE_THEMES: NodeThemes = {
  user: {
    color: 0x4a90d9, // Blue
    material: { roughness: 0.5 },
  },
  assistant: {
    color: 0x50c878, // Green
    material: { roughness: 0.5 },
  },
  thinking: {
    color: 0x9b59b6, // Purple
    material: { roughness: 0.3, opacity: 0.8, transparent: true },
  },
  toolUse: {
    color: 0xf39c12, // Orange
    material: { roughness: 0.4 },
  },
  toolResult: {
    color: 0xe74c3c, // Red (error)
    material: { roughness: 0.4 },
  },
  toolResultSuccess: {
    color: 0x27ae60, // Green (success)
    material: { roughness: 0.4 },
  },
  document: {
    color: 0xf1c40f, // Yellow
    material: { roughness: 0.3, metalness: 0.2 },
  },
  cluster: {
    color: 0x5a9a7a, // Teal (blend of user blue + assistant green)
    material: { roughness: 0.3, metalness: 0.1 },
  },
};

/**
 * Default highlight theme
 */
export const DEFAULT_HIGHLIGHT: HighlightTheme = {
  color: 0xffffff, // White
  material: {
    roughness: 0.2,
    emissive: 0x444444,
  },
  searchColor: 0xff6b6b, // Coral red
};

/**
 * Default connection line theme (within expanded clusters)
 */
export const DEFAULT_CONNECTION_LINE: LineTheme = {
  color: 0x666688, // Blue-gray
  opacity: 0.6,
  width: 2,
};

/**
 * Default cluster-to-cluster line theme
 */
export const DEFAULT_CLUSTER_LINE: LineTheme = {
  color: 0xb7410e, // Rusty red
  opacity: 0.4,
  width: 6,
};

/**
 * Default scene theme
 */
export const DEFAULT_SCENE: SceneTheme = {
  background: 0x1a1a2e, // Dark blue-gray
  ambientLightColor: 0xffffff,
  ambientLightIntensity: 0.6,
  mainLightColor: 0xffffff,
  mainLightIntensity: 0.8,
  fillLightColor: 0x8888ff, // Blue tint
  fillLightIntensity: 0.3,
};

/**
 * Default chart colors
 */
export const DEFAULT_CHART_COLORS: ChartColors = {
  totalTokens: '#4a90d9', // Blue
  outputTokens: '#50c878', // Green
  inputTokens: '#9b59b6', // Purple
  thinkingCount: '#9b59b6', // Purple
  toolCount: '#f39c12', // Orange
  contentLength: '#888888', // Gray
  background: '#2a2a40', // Dark
};

/**
 * Default word highlight palette (10 distinct colors)
 */
export const DEFAULT_WORD_HIGHLIGHT_PALETTE: HighlightPalette = [
  0xe6194b, // Red
  0x3cb44b, // Green
  0xffe119, // Yellow
  0x4363d8, // Blue
  0xf58231, // Orange
  0x911eb4, // Purple
  0x42d4f4, // Cyan
  0xf032e6, // Magenta
  0xbfef45, // Lime
  0xfabed4, // Pink
];

/**
 * Default UI colors
 */
export const DEFAULT_UI_COLORS: UIColors = {
  muted: '#666666',
  placeholder: '#666666',
  successBackground: 'rgba(80, 200, 120, 0.95)',
  successText: '#ffffff',
};

/**
 * Complete default theme configuration
 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  nodes: DEFAULT_NODE_THEMES,
  highlight: DEFAULT_HIGHLIGHT,
  connectionLine: DEFAULT_CONNECTION_LINE,
  clusterLine: DEFAULT_CLUSTER_LINE,
  scene: DEFAULT_SCENE,
  chart: DEFAULT_CHART_COLORS,
  wordHighlightPalette: DEFAULT_WORD_HIGHLIGHT_PALETTE,
  ui: DEFAULT_UI_COLORS,
};

/**
 * Convert hex number to CSS color string
 */
export function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/**
 * Convert CSS hex string to number
 */
export function cssToHex(css: string): number {
  return parseInt(css.replace('#', ''), 16);
}

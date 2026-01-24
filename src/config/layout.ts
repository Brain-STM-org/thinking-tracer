/**
 * Layout Configuration
 *
 * Defines all layout-related parameters for the 3D visualization.
 * These control the spiral/coil geometry, node sizing, and spacing.
 */

/**
 * Parameters controlling the coiled-coil spiral layout
 */
export interface CoilLayoutConfig {
  /** Radius of the tight inner spiral */
  spiralRadius: number;
  /** Angle step per cluster on the tight spiral (radians) */
  spiralAngleStep: number;
  /** Radius of the larger coil path that the spiral follows */
  coilRadius: number;
  /** Angle step for the outer coil rotation (radians) */
  coilAngleStep: number;
  /** Vertical distance per coil rotation unit */
  coilVerticalStep: number;
}

/**
 * Parameters controlling the "slinky" focus effect
 */
export interface FocusConfig {
  /** Minimum vertical spacing between clusters (compressed) */
  minVerticalSpacing: number;
  /** Maximum vertical spacing between clusters (expanded at focus) */
  maxVerticalSpacing: number;
  /** Number of clusters around focus that get expanded spacing */
  focusRadius: number;
}

/**
 * Size configurations for different node types
 */
export interface NodeSizeConfig {
  /** Base size for cluster nodes */
  clusterBase: number;
  /** Maximum size bonus for clusters based on content */
  clusterMaxBonus: number;
  /** User message node dimensions [width, height, depth] */
  user: [number, number, number];
  /** Assistant message node dimensions */
  assistant: [number, number, number];
  /** Thinking block sphere radius */
  thinkingRadius: number;
  /** Thinking block sphere segments */
  thinkingSegments: number;
  /** Tool use cone radius */
  toolUseRadius: number;
  /** Tool use cone height */
  toolUseHeight: number;
  /** Tool use cone segments */
  toolUseSegments: number;
  /** Tool result octahedron size */
  toolResultSize: number;
  /** Cluster sphere segments */
  clusterSegments: number;
}

/**
 * Spacing when clusters are expanded
 */
export interface ExpandedLayoutConfig {
  /** Vertical spacing between user/assistant nodes */
  turnSpacing: number;
  /** Vertical spacing between content blocks (thinking, tools) */
  blockSpacing: number;
  /** Thinking block position offset [x, z] from center */
  thinkingOffset: [number, number];
  /** Tool use position offset [x, z] from center */
  toolUseOffset: [number, number];
  /** Tool result position offset [x, z] from center */
  toolResultOffset: [number, number];
}

/**
 * Camera configuration
 */
export interface CameraConfig {
  /** Field of view in degrees */
  fov: number;
  /** Near clipping plane */
  near: number;
  /** Far clipping plane */
  far: number;
  /** Initial camera Z position */
  initialZ: number;
  /** Minimum zoom distance */
  minDistance: number;
  /** Maximum zoom distance */
  maxDistance: number;
  /** Camera damping factor (0-1) */
  dampingFactor: number;
  /** Blend factor for gentle camera adjustment (0-1) */
  lookAtBlendFactor: number;
  /** Camera offset multipliers for fit view [x, y, z] */
  fitViewOffset: [number, number, number];
}

/**
 * Selection and interaction config
 */
export interface SelectionConfig {
  /** Scale multiplier when node is selected */
  selectedScale: number;
  /** Minimum scale threshold for visibility */
  visibilityThreshold: number;
}

/**
 * Complete layout configuration
 */
export interface LayoutConfig {
  coil: CoilLayoutConfig;
  focus: FocusConfig;
  nodeSize: NodeSizeConfig;
  expanded: ExpandedLayoutConfig;
  camera: CameraConfig;
  selection: SelectionConfig;
}

/**
 * Default coil layout parameters
 */
export const DEFAULT_COIL: CoilLayoutConfig = {
  spiralRadius: 2.5,
  spiralAngleStep: Math.PI / 2.5,
  coilRadius: 6,
  coilAngleStep: Math.PI / 8,
  coilVerticalStep: 1.5,
};

/**
 * Default focus/slinky parameters
 */
export const DEFAULT_FOCUS: FocusConfig = {
  minVerticalSpacing: 0.2,
  maxVerticalSpacing: 1.5,
  focusRadius: 4,
};

/**
 * Default node sizes
 */
export const DEFAULT_NODE_SIZE: NodeSizeConfig = {
  clusterBase: 0.8,
  clusterMaxBonus: 0.5,
  user: [0.8, 0.8, 0.8],
  assistant: [1, 1, 1],
  thinkingRadius: 0.4,
  thinkingSegments: 16,
  toolUseRadius: 0.3,
  toolUseHeight: 0.6,
  toolUseSegments: 6,
  toolResultSize: 0.3,
  clusterSegments: 24,
};

/**
 * Default expanded layout spacing
 */
export const DEFAULT_EXPANDED: ExpandedLayoutConfig = {
  turnSpacing: 2,
  blockSpacing: 1.2,
  thinkingOffset: [1, 0.5],
  toolUseOffset: [0.8, -0.5],
  toolResultOffset: [1.2, -0.3],
};

/**
 * Default camera configuration
 */
export const DEFAULT_CAMERA: CameraConfig = {
  fov: 60,
  near: 0.1,
  far: 1000,
  initialZ: 10,
  minDistance: 1,
  maxDistance: 100,
  dampingFactor: 0.05,
  lookAtBlendFactor: 0.3,
  fitViewOffset: [0.8, 0.5, 1.2],
};

/**
 * Default selection configuration
 */
export const DEFAULT_SELECTION: SelectionConfig = {
  selectedScale: 1.25,
  visibilityThreshold: 0.01,
};

/**
 * Complete default layout configuration
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  coil: DEFAULT_COIL,
  focus: DEFAULT_FOCUS,
  nodeSize: DEFAULT_NODE_SIZE,
  expanded: DEFAULT_EXPANDED,
  camera: DEFAULT_CAMERA,
  selection: DEFAULT_SELECTION,
};

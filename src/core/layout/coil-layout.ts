/**
 * Coil Layout Calculator
 *
 * Pure math functions for calculating the helical coil layout.
 * Nodes sit directly on a single helical path.
 */

/**
 * Layout parameters for the coil visualization
 */
export interface CoilLayoutParams {
  // Helix parameters
  radius: number;
  angleStep: number;
  verticalStep: number;
  tiltAngle: number;       // axis tilt from vertical (radians)
  radiusGrowth: number;    // radius increase per unit of path progress

  // Slinky effect (focus-based spacing)
  focusIndex: number;
  minVerticalSpacing: number;
  maxVerticalSpacing: number;
  focusRadius: number;
}

/**
 * Default layout parameters
 */
export const DEFAULT_COIL_PARAMS: CoilLayoutParams = {
  radius: 6,
  angleStep: Math.PI / 8,
  verticalStep: 1.5,
  tiltAngle: Math.PI / 18,   // 10 degrees
  radiusGrowth: 0.1,
  focusIndex: 0,
  minVerticalSpacing: 0.2,
  maxVerticalSpacing: 1.5,
  focusRadius: 4,
};

/**
 * 3D position result
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculate vertical spacing for a cluster based on distance from focus.
 * Uses a smooth cosine falloff to create the "slinky" effect.
 */
export function getVerticalSpacing(
  index: number,
  params: CoilLayoutParams
): number {
  const distanceFromFocus = Math.abs(index - params.focusIndex);

  if (distanceFromFocus >= params.focusRadius) {
    return params.minVerticalSpacing;
  }

  // Smooth cosine falloff from max at focus to min at edge
  const t = distanceFromFocus / params.focusRadius;
  const falloff = (Math.cos(t * Math.PI) + 1) / 2; // 1 at center, 0 at edge

  return params.minVerticalSpacing +
    (params.maxVerticalSpacing - params.minVerticalSpacing) * falloff;
}

/**
 * Calculate the cumulative path progress up to a given index.
 * This is the sum of vertical spacings for all previous clusters.
 */
export function getPathProgress(
  index: number,
  params: CoilLayoutParams
): number {
  let progress = 0;
  for (let i = 0; i < index; i++) {
    progress += getVerticalSpacing(i, params);
  }
  return progress;
}

/**
 * Calculate position for a cluster on a single helix.
 * The helix expands in radius as it descends (cone) and the axis
 * is tilted from vertical by tiltAngle (lean).
 * Flows top-to-bottom to match conversation reading order.
 */
export function getSpiralPosition(
  index: number,
  params: CoilLayoutParams
): Position3D {
  const pathProgress = getPathProgress(index, params);

  const angle = pathProgress * params.angleStep;
  const currentRadius = params.radius + pathProgress * params.radiusGrowth;

  // Position on upright helix
  const lx = Math.cos(angle) * currentRadius;
  const ly = -pathProgress * params.verticalStep;
  const lz = Math.sin(angle) * currentRadius;

  // Tilt the axis: rotate around Z by tiltAngle
  const cosT = Math.cos(params.tiltAngle);
  const sinT = Math.sin(params.tiltAngle);

  return {
    x: lx * cosT - ly * sinT,
    y: lx * sinT + ly * cosT,
    z: lz,
  };
}

/**
 * Calculate positions for all clusters
 */
export function calculateAllPositions(
  count: number,
  params: CoilLayoutParams
): Position3D[] {
  const positions: Position3D[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(getSpiralPosition(i, params));
  }
  return positions;
}

/**
 * Calculate the bounding box of all positions
 */
export function getBoundingBox(positions: Position3D[]): {
  min: Position3D;
  max: Position3D;
  center: Position3D;
} {
  if (positions.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
    };
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const pos of positions) {
    min.x = Math.min(min.x, pos.x);
    min.y = Math.min(min.y, pos.y);
    min.z = Math.min(min.z, pos.z);
    max.x = Math.max(max.x, pos.x);
    max.y = Math.max(max.y, pos.y);
    max.z = Math.max(max.z, pos.z);
  }

  return {
    min,
    max,
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    },
  };
}

/**
 * Calculate expanded block positions within a cluster
 */
export function getExpandedBlockPositions(
  basePosition: Position3D,
  blockCount: number,
  blockSpacing: number
): Position3D[] {
  const positions: Position3D[] = [];
  const startOffset = -((blockCount - 1) * blockSpacing) / 2;

  for (let i = 0; i < blockCount; i++) {
    positions.push({
      x: basePosition.x + startOffset + i * blockSpacing,
      y: basePosition.y,
      z: basePosition.z,
    });
  }

  return positions;
}

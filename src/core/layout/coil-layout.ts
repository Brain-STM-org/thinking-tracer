/**
 * Coil Layout Calculator
 *
 * Pure math functions for calculating the "coiled coil" spiral layout.
 * The visualization creates a tight spiral that follows a larger helical path.
 */

/**
 * Layout parameters for the coil visualization
 */
export interface CoilLayoutParams {
  // Primary spiral (tight coil)
  spiralRadius: number;
  spiralAngleStep: number;

  // Secondary coil (larger path the spiral follows)
  coilRadius: number;
  coilAngleStep: number;
  coilVerticalStep: number;

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
  spiralRadius: 2.5,
  spiralAngleStep: Math.PI / 2.5,
  coilRadius: 6,
  coilAngleStep: Math.PI / 8,
  coilVerticalStep: 1.5,
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
 * Calculate spiral position for a cluster with slinky effect and secondary coiling.
 * Creates a "coiled coil" - a spiral that follows a larger helical path.
 * Flows top-to-bottom to match conversation reading order.
 */
export function getSpiralPosition(
  index: number,
  params: CoilLayoutParams
): Position3D {
  // Calculate progress along the path (for secondary coil)
  const pathProgress = getPathProgress(index, params);

  // Secondary coil (the larger path that the spiral center follows)
  const coilAngle = pathProgress * params.coilAngleStep;
  const coilCenterX = Math.cos(coilAngle) * params.coilRadius;
  const coilCenterZ = Math.sin(coilAngle) * params.coilRadius;
  // Negative Y so spiral flows downward (top-to-bottom like conversation)
  const coilCenterY = -pathProgress * params.coilVerticalStep;

  // Primary spiral (tight coil around the secondary coil path)
  const spiralAngle = index * params.spiralAngleStep;

  // Calculate the tangent direction of the coil path for proper orientation
  const tangentAngle = coilAngle + Math.PI / 2;
  const tangentX = Math.cos(tangentAngle);
  const tangentZ = Math.sin(tangentAngle);

  // Spiral offset perpendicular to the coil path
  // Use the tangent and up vector to create the spiral plane
  const spiralOffsetX = Math.cos(spiralAngle) * params.spiralRadius * tangentX;
  const spiralOffsetZ = Math.cos(spiralAngle) * params.spiralRadius * tangentZ;
  const spiralOffsetY = Math.sin(spiralAngle) * params.spiralRadius;

  return {
    x: coilCenterX + spiralOffsetX,
    y: coilCenterY + spiralOffsetY,
    z: coilCenterZ + spiralOffsetZ,
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

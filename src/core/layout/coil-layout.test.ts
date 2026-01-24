/**
 * Unit tests for coil layout calculations
 */

import { describe, it, expect } from 'vitest';
import {
  getVerticalSpacing,
  getPathProgress,
  getSpiralPosition,
  calculateAllPositions,
  getBoundingBox,
  getExpandedBlockPositions,
  DEFAULT_COIL_PARAMS,
  type CoilLayoutParams,
} from './coil-layout';

describe('getVerticalSpacing', () => {
  const params: CoilLayoutParams = {
    ...DEFAULT_COIL_PARAMS,
    focusIndex: 5,
    minVerticalSpacing: 0.2,
    maxVerticalSpacing: 1.5,
    focusRadius: 4,
  };

  it('returns max spacing at focus index', () => {
    const spacing = getVerticalSpacing(5, params);
    expect(spacing).toBe(params.maxVerticalSpacing);
  });

  it('returns min spacing beyond focus radius', () => {
    const spacing = getVerticalSpacing(10, params); // 5 away from focus
    expect(spacing).toBe(params.minVerticalSpacing);
  });

  it('returns min spacing far beyond focus radius', () => {
    const spacing = getVerticalSpacing(20, params);
    expect(spacing).toBe(params.minVerticalSpacing);
  });

  it('returns intermediate spacing within focus radius', () => {
    const spacing = getVerticalSpacing(7, params); // 2 away from focus
    expect(spacing).toBeGreaterThan(params.minVerticalSpacing);
    expect(spacing).toBeLessThan(params.maxVerticalSpacing);
  });

  it('is symmetric around focus', () => {
    const spacingBefore = getVerticalSpacing(3, params); // 2 before focus
    const spacingAfter = getVerticalSpacing(7, params); // 2 after focus
    expect(spacingBefore).toBeCloseTo(spacingAfter, 10);
  });

  it('decreases monotonically from focus', () => {
    const spacings = [5, 6, 7, 8, 9].map(i => getVerticalSpacing(i, params));
    for (let i = 1; i < spacings.length; i++) {
      expect(spacings[i]).toBeLessThanOrEqual(spacings[i - 1]);
    }
  });
});

describe('getPathProgress', () => {
  const params: CoilLayoutParams = {
    ...DEFAULT_COIL_PARAMS,
    focusIndex: 0,
    minVerticalSpacing: 1,
    maxVerticalSpacing: 1,
    focusRadius: 0,
  };

  it('returns 0 for index 0', () => {
    expect(getPathProgress(0, params)).toBe(0);
  });

  it('returns sum of spacings for uniform spacing', () => {
    const progress = getPathProgress(5, params);
    expect(progress).toBe(5); // 5 * 1.0 spacing
  });

  it('accumulates variable spacings correctly', () => {
    const varParams: CoilLayoutParams = {
      ...DEFAULT_COIL_PARAMS,
      focusIndex: 2,
      minVerticalSpacing: 0.5,
      maxVerticalSpacing: 2,
      focusRadius: 2,
    };

    const progress = getPathProgress(3, varParams);
    const expected =
      getVerticalSpacing(0, varParams) +
      getVerticalSpacing(1, varParams) +
      getVerticalSpacing(2, varParams);
    expect(progress).toBeCloseTo(expected, 10);
  });
});

describe('getSpiralPosition', () => {
  it('returns a position object with x, y, z', () => {
    const pos = getSpiralPosition(0, DEFAULT_COIL_PARAMS);
    expect(pos).toHaveProperty('x');
    expect(pos).toHaveProperty('y');
    expect(pos).toHaveProperty('z');
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
    expect(typeof pos.z).toBe('number');
  });

  it('returns different positions for different indices', () => {
    const pos0 = getSpiralPosition(0, DEFAULT_COIL_PARAMS);
    const pos1 = getSpiralPosition(1, DEFAULT_COIL_PARAMS);

    expect(pos0.x).not.toBe(pos1.x);
    expect(pos0.y).not.toBe(pos1.y);
  });

  it('positions flow downward (decreasing y)', () => {
    const positions = [0, 1, 2, 3, 4].map(i =>
      getSpiralPosition(i, DEFAULT_COIL_PARAMS)
    );

    // Overall trend should be downward
    expect(positions[4].y).toBeLessThan(positions[0].y);
  });

  it('positions stay within expected radius', () => {
    const params = DEFAULT_COIL_PARAMS;
    const maxRadius = params.coilRadius + params.spiralRadius + 1;

    for (let i = 0; i < 20; i++) {
      const pos = getSpiralPosition(i, params);
      const horizontalRadius = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      expect(horizontalRadius).toBeLessThan(maxRadius);
    }
  });

  it('respects spiral radius parameter', () => {
    const smallParams = { ...DEFAULT_COIL_PARAMS, spiralRadius: 1, coilRadius: 0 };
    const largeParams = { ...DEFAULT_COIL_PARAMS, spiralRadius: 5, coilRadius: 0 };

    const smallPos = getSpiralPosition(1, smallParams);
    const largePos = getSpiralPosition(1, largeParams);

    const smallRadius = Math.sqrt(smallPos.x ** 2 + smallPos.z ** 2 + smallPos.y ** 2);
    const largeRadius = Math.sqrt(largePos.x ** 2 + largePos.z ** 2 + largePos.y ** 2);

    expect(largeRadius).toBeGreaterThan(smallRadius);
  });
});

describe('calculateAllPositions', () => {
  it('returns empty array for count 0', () => {
    const positions = calculateAllPositions(0, DEFAULT_COIL_PARAMS);
    expect(positions).toHaveLength(0);
  });

  it('returns correct number of positions', () => {
    const positions = calculateAllPositions(10, DEFAULT_COIL_PARAMS);
    expect(positions).toHaveLength(10);
  });

  it('returns same positions as calling getSpiralPosition individually', () => {
    const count = 5;
    const positions = calculateAllPositions(count, DEFAULT_COIL_PARAMS);

    for (let i = 0; i < count; i++) {
      const individual = getSpiralPosition(i, DEFAULT_COIL_PARAMS);
      expect(positions[i].x).toBeCloseTo(individual.x, 10);
      expect(positions[i].y).toBeCloseTo(individual.y, 10);
      expect(positions[i].z).toBeCloseTo(individual.z, 10);
    }
  });
});

describe('getBoundingBox', () => {
  it('returns zero box for empty array', () => {
    const box = getBoundingBox([]);
    expect(box.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(box.max).toEqual({ x: 0, y: 0, z: 0 });
    expect(box.center).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('returns correct box for single position', () => {
    const positions = [{ x: 5, y: 10, z: -3 }];
    const box = getBoundingBox(positions);
    expect(box.min).toEqual({ x: 5, y: 10, z: -3 });
    expect(box.max).toEqual({ x: 5, y: 10, z: -3 });
    expect(box.center).toEqual({ x: 5, y: 10, z: -3 });
  });

  it('returns correct box for multiple positions', () => {
    const positions = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 30 },
      { x: -5, y: 5, z: 15 },
    ];
    const box = getBoundingBox(positions);

    expect(box.min).toEqual({ x: -5, y: 0, z: 0 });
    expect(box.max).toEqual({ x: 10, y: 20, z: 30 });
    expect(box.center).toEqual({ x: 2.5, y: 10, z: 15 });
  });

  it('calculates correct center', () => {
    const positions = [
      { x: -10, y: -10, z: -10 },
      { x: 10, y: 10, z: 10 },
    ];
    const box = getBoundingBox(positions);
    expect(box.center).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('getExpandedBlockPositions', () => {
  const base = { x: 0, y: 0, z: 0 };
  const spacing = 2;

  it('returns single position for count 1', () => {
    const positions = getExpandedBlockPositions(base, 1, spacing);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toEqual(base);
  });

  it('returns centered positions for multiple blocks', () => {
    const positions = getExpandedBlockPositions(base, 3, spacing);
    expect(positions).toHaveLength(3);

    // Should be centered: -2, 0, 2
    expect(positions[0].x).toBeCloseTo(-2, 10);
    expect(positions[1].x).toBeCloseTo(0, 10);
    expect(positions[2].x).toBeCloseTo(2, 10);
  });

  it('preserves y and z from base position', () => {
    const basePos = { x: 5, y: 10, z: -3 };
    const positions = getExpandedBlockPositions(basePos, 3, spacing);

    for (const pos of positions) {
      expect(pos.y).toBe(basePos.y);
      expect(pos.z).toBe(basePos.z);
    }
  });

  it('respects spacing parameter', () => {
    const positions = getExpandedBlockPositions(base, 2, 4);
    const distance = Math.abs(positions[1].x - positions[0].x);
    expect(distance).toBeCloseTo(4, 10);
  });

  it('returns evenly spaced positions', () => {
    const positions = getExpandedBlockPositions(base, 5, spacing);

    for (let i = 1; i < positions.length; i++) {
      const distance = positions[i].x - positions[i - 1].x;
      expect(distance).toBeCloseTo(spacing, 10);
    }
  });
});

describe('DEFAULT_COIL_PARAMS', () => {
  it('has all required properties', () => {
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('spiralRadius');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('spiralAngleStep');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('coilRadius');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('coilAngleStep');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('coilVerticalStep');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('focusIndex');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('minVerticalSpacing');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('maxVerticalSpacing');
    expect(DEFAULT_COIL_PARAMS).toHaveProperty('focusRadius');
  });

  it('has sensible default values', () => {
    expect(DEFAULT_COIL_PARAMS.spiralRadius).toBeGreaterThan(0);
    expect(DEFAULT_COIL_PARAMS.coilRadius).toBeGreaterThan(0);
    expect(DEFAULT_COIL_PARAMS.minVerticalSpacing).toBeLessThan(
      DEFAULT_COIL_PARAMS.maxVerticalSpacing
    );
    expect(DEFAULT_COIL_PARAMS.focusRadius).toBeGreaterThan(0);
  });
});

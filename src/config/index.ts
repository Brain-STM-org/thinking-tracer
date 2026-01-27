/**
 * Configuration Module
 *
 * Central configuration for the entire application.
 * All magic numbers and styling constants are defined here.
 */

// Re-export all configuration types and defaults
export * from './layout';
export * from './theme';
export * from './timing';
export * from './ui';
export * from './sources';

import {
  type LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from './layout';

import {
  type ThemeConfig,
  DEFAULT_THEME_CONFIG,
} from './theme';

import {
  type TimingConfig,
  DEFAULT_TIMING_CONFIG,
} from './timing';

import {
  type UIConfig,
  DEFAULT_UI_CONFIG,
} from './ui';

/**
 * Complete application configuration
 */
export interface AppConfig {
  /** Layout and 3D positioning */
  layout: LayoutConfig;
  /** Colors and materials */
  theme: ThemeConfig;
  /** Animation and timing */
  timing: TimingConfig;
  /** UI constraints and display */
  ui: UIConfig;
}

/**
 * Default application configuration
 *
 * This is the single source of truth for all application defaults.
 * Import this and override specific values as needed.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  layout: DEFAULT_LAYOUT_CONFIG,
  theme: DEFAULT_THEME_CONFIG,
  timing: DEFAULT_TIMING_CONFIG,
  ui: DEFAULT_UI_CONFIG,
};

/**
 * Create a custom config by merging with defaults
 */
export function createConfig(overrides: Partial<AppConfig>): AppConfig {
  return {
    layout: { ...DEFAULT_LAYOUT_CONFIG, ...overrides.layout },
    theme: { ...DEFAULT_THEME_CONFIG, ...overrides.theme },
    timing: { ...DEFAULT_TIMING_CONFIG, ...overrides.timing },
    ui: { ...DEFAULT_UI_CONFIG, ...overrides.ui },
  };
}

/**
 * Deep merge utility for nested config objects
 */
export function mergeConfig<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base };

  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const value = overrides[key];
    if (value !== undefined) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof base[key] === 'object' &&
        base[key] !== null
      ) {
        result[key] = mergeConfig(base[key] as object, value as object) as T[keyof T];
      } else {
        result[key] = value as T[keyof T];
      }
    }
  }

  return result;
}

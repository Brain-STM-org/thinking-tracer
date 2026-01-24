/**
 * Timing Configuration
 *
 * Defines all timing-related constants for animations, debouncing,
 * and periodic operations.
 */

/**
 * Animation duration configuration (in milliseconds)
 */
export interface AnimationTimingConfig {
  /** Layout transition animation */
  layoutTransition: number;
  /** Camera movement animation */
  cameraTransition: number;
  /** Scroll lock after programmatic scroll */
  scrollLock: number;
  /** Click-triggered scroll lock (shorter) */
  clickScrollLock: number;
  /** Scroll sync debounce */
  scrollDebounce: number;
}

/**
 * Debounce timing configuration (in milliseconds)
 */
export interface DebounceConfig {
  /** Search input debounce */
  search: number;
  /** Initial render delay after load */
  initialRender: number;
  /** State restoration delay */
  stateRestore: number;
}

/**
 * Periodic operation intervals (in milliseconds)
 */
export interface IntervalConfig {
  /** UI state autosave interval */
  autoSave: number;
  /** File watch poll interval */
  fileWatchPoll: number;
  /** Notification display duration */
  notificationDuration: number;
}

/**
 * Interaction timing (in milliseconds)
 */
export interface InteractionTimingConfig {
  /** Double-click detection window */
  doubleClickWindow: number;
  /** Maximum click duration to register as click (not drag) */
  maxClickDuration: number;
  /** Maximum click movement distance in pixels */
  maxClickDistance: number;
}

/**
 * Complete timing configuration
 */
export interface TimingConfig {
  animation: AnimationTimingConfig;
  debounce: DebounceConfig;
  interval: IntervalConfig;
  interaction: InteractionTimingConfig;
}

/**
 * Default animation timing
 */
export const DEFAULT_ANIMATION_TIMING: AnimationTimingConfig = {
  layoutTransition: 400,
  cameraTransition: 400,
  scrollLock: 600,
  clickScrollLock: 300,
  scrollDebounce: 150,
};

/**
 * Default debounce timing
 */
export const DEFAULT_DEBOUNCE: DebounceConfig = {
  search: 200,
  initialRender: 50,
  stateRestore: 100,
};

/**
 * Default interval timing
 */
export const DEFAULT_INTERVAL: IntervalConfig = {
  autoSave: 30000, // 30 seconds
  fileWatchPoll: 1000, // 1 second
  notificationDuration: 2000, // 2 seconds
};

/**
 * Default interaction timing
 */
export const DEFAULT_INTERACTION_TIMING: InteractionTimingConfig = {
  doubleClickWindow: 400,
  maxClickDuration: 300,
  maxClickDistance: 5,
};

/**
 * Complete default timing configuration
 */
export const DEFAULT_TIMING_CONFIG: TimingConfig = {
  animation: DEFAULT_ANIMATION_TIMING,
  debounce: DEFAULT_DEBOUNCE,
  interval: DEFAULT_INTERVAL,
  interaction: DEFAULT_INTERACTION_TIMING,
};

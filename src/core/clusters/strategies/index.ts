/**
 * Cluster Strategy Registry
 *
 * Manages pluggable cluster building strategies for different trace sources.
 * Each source can provide its own rules for how to group turns into clusters.
 */

import type { Turn, Entry } from '../../../data/types';
import { claudeCodeStrategy } from './claude-code';

/**
 * Timing data extracted from entries for a cluster
 */
export interface ClusterTimingData {
  /** Map of tool_use_id to timestamp when tool was called */
  toolUseTimestamps: Map<string, number>;
  /** Map of tool_use_id to timestamp when result was received */
  toolResultTimestamps: Map<string, number>;
  /** Thinking block timings in order */
  thinkingTimings: Array<{ text: string; durationMs?: number }>;
}

/**
 * Interface for cluster building strategies
 *
 * Different trace sources may have different conventions for how turns
 * should be grouped into clusters. A strategy encapsulates these rules.
 */
export interface ClusterStrategy {
  /**
   * Unique identifier for this strategy
   */
  id: string;

  /**
   * Check if a turn should be absorbed into the previous cluster
   * rather than starting a new one.
   *
   * For example, Claude Code logs tool results as "user" type turns,
   * but they should be merged with the assistant's turn, not treated
   * as new user input.
   *
   * @param turn The turn to check
   * @returns true if this turn should be absorbed into previous cluster
   */
  shouldAbsorbIntoPrevious(turn: Turn): boolean;

  /**
   * Extract timing data from entries for duration calculations.
   *
   * Different sources may store timestamps differently, so each strategy
   * can implement its own timing extraction logic.
   *
   * @param entries The raw entries from the trace file
   * @returns Timing data for tool and thinking duration calculations
   */
  extractTimingData(entries: Entry[] | undefined): ClusterTimingData;
}

/**
 * Strategy Registry - manages cluster building strategies
 */
class StrategyRegistry {
  private strategies: Map<string, ClusterStrategy> = new Map();
  private defaultStrategy: ClusterStrategy;

  constructor() {
    // Claude Code strategy is the default
    this.defaultStrategy = claudeCodeStrategy;
    this.register(claudeCodeStrategy);
  }

  /**
   * Register a cluster building strategy
   */
  register(strategy: ClusterStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Get a strategy by source ID
   */
  get(sourceId: string | undefined): ClusterStrategy {
    if (sourceId && this.strategies.has(sourceId)) {
      return this.strategies.get(sourceId)!;
    }
    return this.defaultStrategy;
  }

  /**
   * Set the default strategy
   */
  setDefault(strategy: ClusterStrategy): void {
    this.defaultStrategy = strategy;
    this.register(strategy);
  }

  /**
   * Get all registered strategy IDs
   */
  getIds(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// Create and export the singleton registry
export const strategyRegistry = new StrategyRegistry();

// Re-export built-in strategies
export { claudeCodeStrategy } from './claude-code';

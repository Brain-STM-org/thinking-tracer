/**
 * Source Registry - configuration for different trace sources
 */

import { claudeCodeSource } from './claude-code';

/**
 * Configuration for a trace source
 */
export interface SourceConfig {
  /** Unique identifier (e.g., 'claude-code') */
  id: string;

  /** Display name (e.g., 'Claude Code') */
  name: string;

  /** Description for UI display */
  description: string;

  /** Supported file extensions */
  fileExtensions: string[];

  /** UI customization */
  ui: {
    /** Icon identifier or path */
    icon?: string;

    /** Badge label mappings (e.g., { sidechain: 'Sub-agent' }) */
    badges: Record<string, string>;

    /** Which metadata fields to display in the UI */
    metadataFields: string[];

    /** Default session title format */
    defaultTitle: string;
  };

  /** Source capabilities */
  capabilities: {
    /** Has sub-agent/sidechain support */
    hasSubAgents: boolean;

    /** Has extended thinking blocks */
    hasThinking: boolean;

    /** Has tool/function calling */
    hasToolUse: boolean;

    /** Has summary/compaction entries */
    hasSummaries: boolean;
  };
}

/**
 * Source Registry - manages source configurations
 */
class SourceRegistry {
  private sources: Map<string, SourceConfig> = new Map();

  /**
   * Register a source configuration
   */
  register(config: SourceConfig): void {
    this.sources.set(config.id, config);
  }

  /**
   * Get a source configuration by ID
   */
  get(sourceId: string): SourceConfig | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Get all registered sources
   */
  getAll(): SourceConfig[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get all registered source IDs
   */
  getIds(): string[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Check if a source is registered
   */
  has(sourceId: string): boolean {
    return this.sources.has(sourceId);
  }

  /**
   * Get UI text for a source
   * Falls back to generic text if source not found
   */
  getUIText(sourceId: string | undefined, key: keyof SourceConfig['ui']['badges'], fallback: string): string {
    if (!sourceId) return fallback;
    const source = this.sources.get(sourceId);
    return source?.ui.badges[key] ?? fallback;
  }

  /**
   * Get metadata fields to display for a source
   */
  getMetadataFields(sourceId: string | undefined): string[] {
    if (!sourceId) return ['model', 'duration_ms'];
    const source = this.sources.get(sourceId);
    return source?.ui.metadataFields ?? ['model', 'duration_ms'];
  }

  /**
   * Check if a source has a specific capability
   */
  hasCapability(sourceId: string | undefined, capability: keyof SourceConfig['capabilities']): boolean {
    if (!sourceId) return false;
    const source = this.sources.get(sourceId);
    return source?.capabilities[capability] ?? false;
  }
}

// Create and export the singleton registry
export const sourceRegistry = new SourceRegistry();

// Register built-in sources
sourceRegistry.register(claudeCodeSource);

// Re-export source configs for direct access
export { claudeCodeSource };

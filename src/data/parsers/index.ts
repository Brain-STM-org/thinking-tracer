/**
 * Parser Registry - manages trace file parsers and auto-detection
 */

import type { Conversation, TraceParser } from '../types';
import { claudeCodeParser } from './claude-code';

/**
 * Result of parsing with source detection
 */
export interface ParseResult {
  conversation: Conversation;
  sourceId: string;
  confidence: number;
}

/**
 * Registered parser with metadata
 */
interface RegisteredParser {
  sourceId: string;
  parser: TraceParser;
  priority: number;
}

/**
 * Parser Registry - manages multiple parsers and auto-detection
 */
class ParserRegistry {
  private parsers: RegisteredParser[] = [];

  /**
   * Register a parser for a source
   * @param sourceId Unique identifier for the source (e.g., 'claude-code')
   * @param parser The parser implementation
   * @param priority Higher priority parsers are tried first (default: 0)
   */
  register(sourceId: string, parser: TraceParser, priority = 0): void {
    // Remove existing parser with same ID
    this.parsers = this.parsers.filter(p => p.sourceId !== sourceId);

    // Add new parser
    this.parsers.push({ sourceId, parser, priority });

    // Sort by priority (highest first)
    this.parsers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Unregister a parser
   */
  unregister(sourceId: string): void {
    this.parsers = this.parsers.filter(p => p.sourceId !== sourceId);
  }

  /**
   * Get all registered source IDs
   */
  getRegisteredSources(): string[] {
    return this.parsers.map(p => p.sourceId);
  }

  /**
   * Check if any registered parser can handle the data
   */
  canParse(data: unknown): boolean {
    return this.parsers.some(p => p.parser.canParse(data));
  }

  /**
   * Detect the source and parse the data
   * Tries each parser in priority order until one succeeds
   */
  detectAndParse(data: unknown): ParseResult {
    for (const { sourceId, parser } of this.parsers) {
      if (parser.canParse(data)) {
        const conversation = parser.parse(data);
        return {
          conversation,
          sourceId,
          confidence: 1.0, // Future: implement confidence scoring
        };
      }
    }

    throw new Error('No registered parser can handle this file format');
  }

  /**
   * Parse data with a specific parser
   */
  parseWithSource(data: unknown, sourceId: string): Conversation {
    const entry = this.parsers.find(p => p.sourceId === sourceId);
    if (!entry) {
      throw new Error(`Unknown source: ${sourceId}`);
    }
    if (!entry.parser.canParse(data)) {
      throw new Error(`Parser for ${sourceId} cannot handle this data`);
    }
    return entry.parser.parse(data);
  }

  /**
   * Get a specific parser
   */
  getParser(sourceId: string): TraceParser | undefined {
    return this.parsers.find(p => p.sourceId === sourceId)?.parser;
  }
}

// Create and export the singleton registry
export const parserRegistry = new ParserRegistry();

// Register the built-in Claude Code parser
parserRegistry.register('claude-code', claudeCodeParser, 100);

// Re-export for convenience
export { claudeCodeParser } from './claude-code';
export type { TraceParser } from '../types';

/**
 * Claude Code Cluster Strategy
 *
 * Implements cluster building rules specific to Claude Code trace files.
 */

import type { Turn, Entry } from '../../../data/types';
import type { ClusterStrategy, ClusterTimingData } from './index';

/**
 * Check if a turn contains only tool_result content blocks.
 * Such turns are system-generated tool responses (Claude Code logs them as
 * type "user"), not real user messages. They should be folded into the
 * assistant's content rather than starting a new cluster.
 */
function isToolResultOnly(turn: Turn): boolean {
  return (
    turn.role === 'user' &&
    turn.content.length > 0 &&
    turn.content.every((b) => b.type === 'tool_result')
  );
}

/**
 * Extract timing data from Claude Code entries
 */
function extractTimingData(entries: Entry[] | undefined): ClusterTimingData {
  const toolUseTimestamps = new Map<string, number>();
  const toolResultTimestamps = new Map<string, number>();
  const thinkingTimings: Array<{ text: string; durationMs?: number }> = [];

  if (!entries) return { toolUseTimestamps, toolResultTimestamps, thinkingTimings };

  // First pass: collect all entry timestamps
  const entryTimestamps: number[] = [];
  for (const entry of entries) {
    if (entry.timestamp) {
      const ts = new Date(entry.timestamp).getTime();
      if (!isNaN(ts)) entryTimestamps.push(ts);
    }
  }

  let entryIndex = 0;
  for (const entry of entries) {
    if (!entry.timestamp) continue;
    const entryTime = new Date(entry.timestamp).getTime();
    if (isNaN(entryTime)) {
      continue;
    }

    // Find next entry timestamp for duration calculation
    const nextEntryTime = entryIndex + 1 < entryTimestamps.length
      ? entryTimestamps[entryIndex + 1]
      : undefined;
    entryIndex++;

    // Extract tool_use ids and thinking blocks from assistant entries
    if (entry.type === 'assistant' && entry.parsedAssistantMessage?.content) {
      for (const block of entry.parsedAssistantMessage.content) {
        if (block.type === 'tool_use' && 'id' in block) {
          toolUseTimestamps.set(block.id as string, entryTime);
        }
        if (block.type === 'thinking' && 'thinking' in block) {
          // Calculate duration as time until next entry
          const durationMs = nextEntryTime !== undefined ? nextEntryTime - entryTime : undefined;
          thinkingTimings.push({
            text: block.thinking as string,
            durationMs: durationMs !== undefined && durationMs > 0 ? durationMs : undefined,
          });
        }
      }
    }

    // Extract tool_result tool_use_ids from user entries
    if (entry.type === 'user' && entry.parsedUserMessage?.content) {
      const content = entry.parsedUserMessage.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result' && 'tool_use_id' in block) {
            toolResultTimestamps.set(block.tool_use_id as string, entryTime);
          }
        }
      }
    }
  }

  return { toolUseTimestamps, toolResultTimestamps, thinkingTimings };
}

/**
 * Claude Code cluster building strategy
 */
export const claudeCodeStrategy: ClusterStrategy = {
  id: 'claude-code',

  shouldAbsorbIntoPrevious(turn: Turn): boolean {
    // Claude Code logs tool results as "user" turns, but they're not
    // real user messages — they're system-provided tool outputs.
    // These should be absorbed into the previous assistant's cluster.
    return isToolResultOnly(turn);
  },

  extractTimingData,
};

// Export helper for backward compatibility
export { isToolResultOnly };

/**
 * Cluster Builder
 *
 * Pure functions for building clusters from conversation turns.
 * A cluster groups a user message with its corresponding assistant response.
 */

import type { Conversation, Turn, ContentBlock, SearchableCluster } from '../../data/types';

/**
 * A cluster of turns (user + assistant pair)
 */
export interface TurnCluster {
  index: number;
  userTurn?: Turn;
  assistantTurn?: Turn;
  userTurnIndex?: number;
  assistantTurnIndex?: number;
  expanded: boolean;
  thinkingCount: number;
  toolCount: number;
}

/**
 * Searchable content extracted from a cluster
 * @deprecated Use SearchableCluster from data/types directly
 */
export type SearchableClusterContent = SearchableCluster;

/**
 * Cluster metrics for analytics
 */
export interface ClusterMetrics {
  index: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  thinkingCount: number;
  toolCount: number;
  contentLength: number;
}

/**
 * Build clusters from conversation turns.
 * Merges consecutive user turns and consecutive assistant turns into single clusters.
 */
export function buildClusters(conversation: Conversation | null): TurnCluster[] {
  if (!conversation) return [];

  const clusters: TurnCluster[] = [];
  const { turns } = conversation;
  let clusterIndex = 0;
  let i = 0;

  while (i < turns.length) {
    const turn = turns[i];

    if (turn.role === 'user') {
      // Collect all consecutive user turns and merge their content
      const mergedUserContent: ContentBlock[] = [...turn.content];
      const firstUserIndex = i;
      i++;

      while (i < turns.length && turns[i].role === 'user') {
        mergedUserContent.push(...turns[i].content);
        i++;
      }

      // Create merged user turn
      const mergedUserTurn: Turn = {
        ...turn,
        content: mergedUserContent,
      };

      // Start a new cluster with merged user turn
      const cluster: TurnCluster = {
        index: clusterIndex,
        userTurn: mergedUserTurn,
        userTurnIndex: firstUserIndex,
        expanded: false,
        thinkingCount: 0,
        toolCount: 0,
      };

      // Collect all consecutive assistant turns and merge their content
      if (i < turns.length && turns[i].role === 'assistant') {
        const firstAssistantTurn = turns[i];
        const mergedAssistantContent: ContentBlock[] = [...firstAssistantTurn.content];
        const firstAssistantIndex = i;
        i++;

        while (i < turns.length && turns[i].role === 'assistant') {
          mergedAssistantContent.push(...turns[i].content);
          i++;
        }

        // Create merged assistant turn
        const mergedAssistantTurn: Turn = {
          ...firstAssistantTurn,
          content: mergedAssistantContent,
        };

        cluster.assistantTurn = mergedAssistantTurn;
        cluster.assistantTurnIndex = firstAssistantIndex;

        // Count thinking and tool blocks
        for (const block of mergedAssistantContent) {
          if (block.type === 'thinking') cluster.thinkingCount++;
          if (block.type === 'tool_use') cluster.toolCount++;
        }
      }

      clusters.push(cluster);
      clusterIndex++;
    } else if (turn.role === 'assistant') {
      // Orphan assistant turn(s) - collect all consecutive
      const mergedContent: ContentBlock[] = [...turn.content];
      const firstIndex = i;
      i++;

      while (i < turns.length && turns[i].role === 'assistant') {
        mergedContent.push(...turns[i].content);
        i++;
      }

      const mergedTurn: Turn = {
        ...turn,
        content: mergedContent,
      };

      const cluster: TurnCluster = {
        index: clusterIndex,
        assistantTurn: mergedTurn,
        assistantTurnIndex: firstIndex,
        expanded: false,
        thinkingCount: 0,
        toolCount: 0,
      };

      for (const block of mergedContent) {
        if (block.type === 'thinking') cluster.thinkingCount++;
        if (block.type === 'tool_use') cluster.toolCount++;
      }

      clusters.push(cluster);
      clusterIndex++;
    } else {
      // Unknown role, skip
      i++;
    }
  }

  return clusters;
}

/**
 * Extract searchable content from clusters
 */
export function extractSearchableContent(clusters: TurnCluster[]): SearchableClusterContent[] {
  return clusters.map((cluster) => {
    // Extract user text
    let userText = '';
    if (cluster.userTurn) {
      userText = cluster.userTurn.content
        .filter((b): b is ContentBlock & { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
    }

    // Extract assistant text, thinking blocks, and tool info
    let assistantText = '';
    const thinkingBlocks: string[] = [];
    const toolUses: Array<{ name: string; input: string }> = [];
    const toolResults: Array<{ content: string; isError: boolean }> = [];

    if (cluster.assistantTurn) {
      for (const block of cluster.assistantTurn.content) {
        if (block.type === 'text' && 'text' in block) {
          assistantText += (assistantText ? '\n' : '') + block.text;
        } else if (block.type === 'thinking' && 'thinking' in block) {
          thinkingBlocks.push(block.thinking as string);
        } else if (block.type === 'tool_use' && 'name' in block) {
          toolUses.push({
            name: block.name as string,
            input: JSON.stringify((block as { input?: unknown }).input || {}, null, 2),
          });
        } else if (block.type === 'tool_result' && 'content' in block) {
          toolResults.push({
            content: String(block.content),
            isError: Boolean((block as { is_error?: boolean }).is_error),
          });
        }
      }
    }

    return {
      clusterIndex: cluster.index,
      userText,
      assistantText,
      thinkingBlocks,
      toolUses,
      toolResults,
    };
  });
}

/**
 * Calculate metrics for clusters
 */
export function calculateClusterMetrics(clusters: TurnCluster[]): ClusterMetrics[] {
  return clusters.map((cluster) => {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let contentLength = 0;

    // Calculate from user turn
    if (cluster.userTurn) {
      const usage = cluster.userTurn.usage;
      if (usage) {
        inputTokens += usage.input_tokens || 0;
      }

      // Calculate content length
      for (const block of cluster.userTurn.content) {
        if (block.type === 'text' && 'text' in block) {
          contentLength += (block.text as string).length;
        }
      }
    }

    // Calculate from assistant turn
    if (cluster.assistantTurn) {
      const usage = cluster.assistantTurn.usage;
      if (usage) {
        outputTokens += usage.output_tokens || 0;
        // Cache read/creation tokens count as input
        inputTokens += (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
      }

      // Calculate content length
      for (const block of cluster.assistantTurn.content) {
        if (block.type === 'text' && 'text' in block) {
          contentLength += (block.text as string).length;
        } else if (block.type === 'thinking' && 'thinking' in block) {
          contentLength += (block.thinking as string).length;
        }
      }
    }

    totalTokens = inputTokens + outputTokens;

    return {
      index: cluster.index,
      totalTokens,
      inputTokens,
      outputTokens,
      thinkingCount: cluster.thinkingCount,
      toolCount: cluster.toolCount,
      contentLength,
    };
  });
}

/**
 * Check if a cluster contains a word (case-insensitive)
 */
export function clusterContainsWord(
  searchable: SearchableClusterContent,
  word: string
): boolean {
  const lowerWord = word.toLowerCase();

  // Check user text
  if (searchable.userText.toLowerCase().includes(lowerWord)) {
    return true;
  }

  // Check assistant text
  if (searchable.assistantText.toLowerCase().includes(lowerWord)) {
    return true;
  }

  // Check thinking blocks
  for (const thinking of searchable.thinkingBlocks) {
    if (thinking.toLowerCase().includes(lowerWord)) {
      return true;
    }
  }

  // Check tool uses
  for (const tool of searchable.toolUses) {
    if (tool.name.toLowerCase().includes(lowerWord) ||
        tool.input.toLowerCase().includes(lowerWord)) {
      return true;
    }
  }

  // Check tool results
  for (const result of searchable.toolResults) {
    if (result.content.toLowerCase().includes(lowerWord)) {
      return true;
    }
  }

  return false;
}

/**
 * Find clusters that contain a word
 */
export function findClustersWithWord(
  searchableContent: SearchableClusterContent[],
  word: string
): number[] {
  return searchableContent
    .filter((cluster) => clusterContainsWord(cluster, word))
    .map((cluster) => cluster.clusterIndex);
}

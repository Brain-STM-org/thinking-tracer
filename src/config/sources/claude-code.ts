/**
 * Claude Code source configuration
 */

import type { SourceConfig } from './index';

export const claudeCodeSource: SourceConfig = {
  id: 'claude-code',
  name: 'Claude Code',
  description: 'Anthropic\'s official CLI for Claude - an AI coding assistant',

  fileExtensions: ['.jsonl', '.jsonl.gz', '.jsonl.zst', '.jsonl.zstd'],

  ui: {
    icon: 'claude',

    badges: {
      sidechain: 'sidechain',
      agent: 'agent',
      subAgent: 'Sub-agent',
      mainConversation: 'Main conversation',
    },

    metadataFields: [
      'model',
      'git_branch',
      'duration_ms',
      'cwd',
    ],

    defaultTitle: 'Claude Code Session',
  },

  capabilities: {
    hasSubAgents: true,
    hasThinking: true,
    hasToolUse: true,
    hasSummaries: true,
  },
};

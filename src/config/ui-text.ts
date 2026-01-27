/**
 * UI Text Configuration
 *
 * Source-aware UI text mappings for labels, badges, and descriptions.
 * This allows different sources to display appropriate terminology.
 */

import { sourceRegistry } from './sources';

/**
 * UI text keys for source-specific labels
 */
export interface UITextKeys {
  // Badge labels
  sidechainBadge: string;
  agentBadge: string;

  // Detail panel
  sidechainLabel: string;
  sidechainDescription: string;
  agentLabel: string;

  // Generic labels
  subAgentLabel: string;
  mainConversationLabel: string;
}

/**
 * Default UI text (generic/fallback)
 */
const DEFAULT_UI_TEXT: UITextKeys = {
  sidechainBadge: 'sidechain',
  agentBadge: 'agent',
  sidechainLabel: 'Sidechain',
  sidechainDescription: 'This turn is from a sub-agent',
  agentLabel: 'Agent',
  subAgentLabel: 'Sub-agent',
  mainConversationLabel: 'Main conversation',
};

/**
 * Source-specific UI text overrides
 */
const SOURCE_UI_TEXT: Record<string, Partial<UITextKeys>> = {
  'claude-code': {
    sidechainBadge: 'sidechain',
    agentBadge: 'agent',
    sidechainLabel: 'Sidechain',
    sidechainDescription: 'This turn is from a sub-agent',
    agentLabel: 'Agent',
    subAgentLabel: 'Sub-agent',
    mainConversationLabel: 'Main conversation',
  },
  // Future sources can override specific labels:
  // 'kimi-code': {
  //   sidechainBadge: 'subprocess',
  //   sidechainDescription: 'This turn is from a subprocess',
  // },
};

/**
 * Get UI text for a specific key, with source-specific overrides
 * @param sourceId The source identifier (e.g., 'claude-code')
 * @param key The UI text key
 * @returns The appropriate text for the source
 */
export function getUIText(sourceId: string | undefined, key: keyof UITextKeys): string {
  // Try source-specific text first
  if (sourceId && SOURCE_UI_TEXT[sourceId]?.[key]) {
    return SOURCE_UI_TEXT[sourceId][key]!;
  }

  // Fall back to source registry badges
  if (sourceId) {
    const source = sourceRegistry.get(sourceId);
    if (source?.ui.badges[key]) {
      return source.ui.badges[key];
    }
  }

  // Fall back to defaults
  return DEFAULT_UI_TEXT[key];
}

/**
 * Get all UI text for a source
 */
export function getAllUIText(sourceId: string | undefined): UITextKeys {
  const result = { ...DEFAULT_UI_TEXT };

  if (sourceId && SOURCE_UI_TEXT[sourceId]) {
    Object.assign(result, SOURCE_UI_TEXT[sourceId]);
  }

  return result;
}

/**
 * Register custom UI text for a source
 */
export function registerUIText(sourceId: string, text: Partial<UITextKeys>): void {
  SOURCE_UI_TEXT[sourceId] = { ...SOURCE_UI_TEXT[sourceId], ...text };
}

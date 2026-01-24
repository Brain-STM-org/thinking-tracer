/**
 * UI Panels
 */

export { MetricsPanel } from './MetricsPanel';
export { DetailPanel, truncate, buildTurnText } from './DetailPanel';
export {
  WordFrequencyPanel,
  extractWords,
  getWordFrequencies,
  hexToCSS,
  getHighlightColor,
} from './WordFrequencyPanel';
export { ConversationPanel } from './ConversationPanel';
export { CoilControlsPanel } from './CoilControlsPanel';
export type { WordFrequencyPanelElements, WordFrequencySource } from './WordFrequencyPanel';
export type { ConversationPanelElements, ConversationFilterState } from './ConversationPanel';
export type {
  CoilControlsPanelElements,
  CoilControllableViewer,
  CoilParams,
} from './CoilControlsPanel';

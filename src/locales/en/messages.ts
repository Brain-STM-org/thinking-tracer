/**
 * English translations
 */

export const messages = {
  // App title
  'app.title': 'Thinking Tracer',
  'app.tagline': 'Explore AI reasoning processes in 3D',

  // Landing page
  'landing.dropTitle': 'Thinking Tracer',
  'landing.dropIntro': 'Explore AI reasoning processes in 3D. Visualize conversation traces to understand thinking patterns, tool usage, and response flow. Export conversations to HTML or Markdown.',
  'landing.dropText': 'Drop a conversation file',
  'landing.dropSubtext': 'Supports .jsonl trace files from AI coding assistants',
  'landing.selectFile': 'Select File',
  'landing.loadUrl': 'Load URL',
  'landing.urlPlaceholder': 'https://example.com/trace.jsonl',
  'landing.orLoadFromUrl': 'or load from URL',
  'landing.recentTraces': 'Recent Traces',
  'landing.exampleTraces': 'Example Traces',
  'landing.seeHowBuilt': 'See How This Was Built',
  'landing.loading': 'Loading...',
  'landing.loadingFromServer': 'Loading from local server...',
  'landing.connectingToCli': 'Connecting to CLI',
  'landing.watch': 'Watch',
  'landing.watching': 'Watching',

  // Toolbar
  'toolbar.back': 'Back to file selection',
  'toolbar.toggleSidebar': 'Toggle Sidebar',
  'toolbar.view3d': '3D View Only',
  'toolbar.viewSplit': 'Split View',
  'toolbar.viewConversation': 'Conversation Only',
  'toolbar.export': 'Export Conversation',
  'toolbar.exportHtml': 'Export as HTML',
  'toolbar.exportMarkdown': 'Export as Markdown',

  // Search
  'search.placeholder': 'Search conversation...',
  'search.regexToggle': 'Toggle regex mode (case-insensitive)',
  'search.user': 'User',
  'search.assistant': 'Asst',
  'search.thinking': 'Think',
  'search.tool': 'Tool',
  'search.result': 'Result',
  'search.prev': 'Previous (Shift+Enter)',
  'search.prevShort': '↑ Prev',
  'search.next': 'Next (Enter)',
  'search.nextShort': 'Next ↓',
  'search.clear': 'Clear (Esc)',
  'search.clearShort': 'Clear',
  'search.noResults': 'No results',
  'search.resultCount': '{current} of {total}',
  'search.typeToSearch': 'Type to search',

  // Sidebar - Metrics
  'sidebar.metrics': 'Metrics',
  'sidebar.tokens': 'Tokens',
  'sidebar.output': 'Output',
  'sidebar.input': 'Input',
  'sidebar.thinking': 'Thinking',
  'sidebar.tools': 'Tools',

  // Sidebar - Word Frequency
  'sidebar.topWords': 'Top Words',
  'sidebar.allContent': 'All Content',
  'sidebar.userOnly': 'User Only',
  'sidebar.assistantOnly': 'Assistant Only',
  'sidebar.thinkingOnly': 'Thinking Only',
  'sidebar.noWordsFound': 'No words found',

  // Sidebar - Details
  'sidebar.details': 'Details',
  'sidebar.noSelection': '<no selection>',
  'sidebar.type': 'Type',
  'sidebar.turn': 'Turn',
  'sidebar.actions': 'Actions',
  'sidebar.collapse': 'Collapse',
  'sidebar.expand': 'Expand',
  'sidebar.focus': 'Focus',
  'sidebar.copy': 'Copy',
  'sidebar.copied': 'Copied!',
  'sidebar.failed': 'Failed',
  'sidebar.prevTurn': '← Prev',
  'sidebar.nextTurn': 'Next →',
  'sidebar.collapseTurn': '↩ Collapse Turn',
  'sidebar.showRawData': 'Show Raw Data',
  'sidebar.hideRawData': 'Hide Raw Data',
  'sidebar.error': 'Error',
  'sidebar.sidechain': 'Sidechain',
  'sidebar.sidechainDesc': 'This turn is from a sub-agent',
  'sidebar.agent': 'Agent',
  'sidebar.stopReason': 'Stop Reason',
  'sidebar.thinkingConfig': 'Thinking Config',
  'sidebar.user': 'User',
  'sidebar.assistant': 'Assistant',
  'sidebar.thinkingBlocks': 'Thinking ({count})',
  'sidebar.toolCalls': 'Tool Calls ({count})',
  'sidebar.toolResults': 'Tool Results ({count})',
  'sidebar.contains': 'Contains',
  'sidebar.text': 'Text',
  'sidebar.toolInput': 'Input',
  'sidebar.toolResult': 'Result',
  'sidebar.toolResultError': 'Result (Error)',

  // Legend
  'legend.title': 'Legend',
  'legend.nodeTypes': 'Node Types',
  'legend.user': 'User',
  'legend.assistant': 'Assistant',
  'legend.thinking': 'Thinking',
  'legend.toolCall': 'Tool call',
  'legend.toolSuccess': 'Tool ✓',
  'legend.toolError': 'Tool ✗',

  // Conversation panel
  'conversation.noConversation': 'No conversation loaded',
  'conversation.turns': '{count} turns',
  'conversation.userLabel': 'User',
  'conversation.thinkingLabel': 'Thinking',
  'conversation.outputLabel': 'Output',
  'conversation.resultSuccess': '✓ Result',
  'conversation.resultError': '✗ Error',
  'conversation.more': 'More',
  'conversation.chars': '{count} chars',
  'conversation.thinkingSummary': '{count} thinking ({chars} chars · {duration})',
  'conversation.thinkingSummaryNoTime': '{count} thinking ({chars} chars)',
  'conversation.toolsSummary': '{count} tools ({duration})',
  'conversation.toolsSummaryNoTime': '{count} tools',

  // Filters
  'filter.user': 'User',
  'filter.output': 'Output',
  'filter.thinking': 'Thinking',
  'filter.tools': 'Tools',
  'filter.documents': 'Docs',

  // Coil Controls
  'coil.title': 'Coil Settings',
  'coil.geometry': 'Geometry',
  'coil.radius': 'Radius',
  'coil.angle': 'Angle',
  'coil.verticalStep': 'V-Step',
  'coil.slinky': 'Slinky Effect',
  'coil.focusRadius': 'Focus R',
  'coil.minSpacing': 'Min Space',
  'coil.maxSpacing': 'Max Space',
  'coil.lineStyle': 'Line Style',
  'coil.lineColor': 'Color',
  'coil.lineWidth': 'Width',
  'coil.lineOpacity': 'Opacity',
  'coil.reset': 'Reset',

  // Canvas Controls
  'canvas.autoRotate': 'Auto-rotate',
  'canvas.coilSettings': 'Coil Settings',

  // Toast messages
  'toast.invalidUrl': 'Invalid URL',
  'toast.invalidUrlMessage': 'Please enter a valid URL (e.g., https://example.com/trace.jsonl)',
  'toast.failedToLoad': 'Failed to load',
  'toast.invalidJsonl': 'The URL did not return a valid JSONL file',
  'toast.fetchFailed': 'Could not fetch the URL (check if it exists and allows cross-origin requests)',
  'toast.localServerFailed': 'Could not connect to local server. Make sure the CLI is still running.',
  'toast.authFailed': 'Authentication failed - invalid or missing token',

  // File watcher
  'watch.stopped': 'Stopped watching',
  'watch.fileUpdated': 'File updated',
  'watch.watchingStopped': 'Watch stopped: {error}',
  'watch.watchingFile': 'Watching: {filename}',

  // Time/duration formatting
  'time.ms': '{value}ms',
  'time.seconds': '{value}s',
  'time.minutes': '{minutes}m {seconds}s',

  // Misc
  'misc.github': 'GitHub',
  'misc.of': 'of',
  'misc.browseFiles': 'Browse your files',
  'misc.urlHint': 'Supports GitHub URLs and CORS-enabled URLs',
  'misc.storedLocally': 'Stored locally in your browser',
  'misc.clearAll': 'Clear All',
  'misc.clearConfirm': 'Clear all recent traces?',
  'misc.removeFromHistory': 'Remove from history',
  'misc.errorOccurred': 'Error occurred',

  // Document types
  'document.label': 'Document',
  'document.image': 'Image',
  'document.pdf': 'PDF',
  'document.textFile': 'Text File',
  'document.sourceUrl': 'URL',
  'document.sourceFile': 'File',
  'document.sourceBase64': 'Base64',
  'document.open': 'Open {type}',
  'document.fileId': 'File ID:',
  'document.downloadPdf': 'Download PDF',
  'document.base64Data': 'Base64 data ({size} KB)',
  'document.noPreview': 'No preview available',

  // Recent traces
  'recent.turns': '{count} turns',
  'recent.clusters': '{count} clusters',

  // Detail panel actions
  'detail.collapseToSingle': 'Collapse to single node',
  'detail.expandAll': 'Expand to show all blocks',
  'detail.centerCamera': 'Center camera on this turn',
  'detail.copyContent': 'Copy turn content to clipboard',
  'detail.prevTurn': 'Go to previous turn',
  'detail.nextTurn': 'Go to next turn',

  // Metrics
  'metrics.turnNumber': 'Turn {number}',

  // Legend sections
  'legend.camera': 'Camera',
  'legend.navigation': 'Navigation',
  'legend.rotate': 'Rotate',
  'legend.pan': 'Pan',
  'legend.forwardBack': 'Forward/Back',
  'legend.zoom': 'Zoom',
  'legend.homeView': 'Home view',
  'legend.resetView': 'Reset view',
  'legend.prevNextTurn': 'Prev/Next turn',
  'legend.expandCollapse': 'Expand/Collapse',
  'legend.firstLast': 'First/Last',

  // Coil controls (additional)
  'coil.tilt': 'Tilt',
  'coil.cone': 'Cone',
  'coil.expandAngle': 'Expand ∠',
  'coil.focus': 'Focus',
  'coil.minGap': 'Min Gap',
  'coil.maxGap': 'Max Gap',
  'coil.showClusterLines': 'Show cluster lines',
  'coil.parameters': 'Coil Parameters',

  // Watch
  'watch.requiresChromium': 'File watching requires Chromium-based browser',
};

/**
 * Chinese (Simplified) translations
 * 中文（简体）翻译
 */

export const messages = {
  // App title
  'app.title': '思维追踪器',
  'app.tagline': '以3D方式探索AI推理过程',

  // Landing page
  'landing.dropTitle': '思维追踪器',
  'landing.dropIntro': '以3D方式探索AI推理过程。可视化对话轨迹，理解思维模式、工具使用和响应流程。支持导出为HTML或Markdown格式。',
  'landing.dropText': '拖放对话文件到此处',
  'landing.dropSubtext': '支持AI编程助手的.jsonl轨迹文件',
  'landing.selectFile': '选择文件',
  'landing.loadUrl': '加载链接',
  'landing.urlPlaceholder': 'https://example.com/trace.jsonl',
  'landing.orLoadFromUrl': '或从链接加载',
  'landing.recentTraces': '最近的轨迹',
  'landing.exampleTraces': '示例轨迹',
  'landing.seeHowBuilt': '查看构建过程',
  'landing.loading': '加载中...',
  'landing.loadingFromServer': '正在从本地服务器加载...',
  'landing.connectingToCli': '正在连接CLI',
  'landing.watch': '监视',
  'landing.watching': '监视中',

  // Toolbar
  'toolbar.back': '返回文件选择',
  'toolbar.toggleSidebar': '切换侧边栏',
  'toolbar.view3d': '仅3D视图',
  'toolbar.viewSplit': '分屏视图',
  'toolbar.viewConversation': '仅对话视图',
  'toolbar.export': '导出对话',
  'toolbar.exportHtml': '导出为HTML',
  'toolbar.exportMarkdown': '导出为Markdown',

  // Search
  'search.placeholder': '搜索对话...',
  'search.regexToggle': '切换正则模式（不区分大小写）',
  'search.user': '用户',
  'search.assistant': '助手',
  'search.thinking': '思考',
  'search.tool': '工具',
  'search.result': '结果',
  'search.prev': '上一个 (Shift+Enter)',
  'search.prevShort': '↑ 上一个',
  'search.next': '下一个 (Enter)',
  'search.nextShort': '下一个 ↓',
  'search.clear': '清除 (Esc)',
  'search.clearShort': '清除',
  'search.noResults': '无结果',
  'search.resultCount': '{current} / {total}',
  'search.typeToSearch': '输入以搜索',

  // Sidebar - Metrics
  'sidebar.metrics': '指标',
  'sidebar.tokens': 'Token数',
  'sidebar.output': '输出',
  'sidebar.input': '输入',
  'sidebar.thinking': '思考',
  'sidebar.tools': '工具',

  // Sidebar - Word Frequency
  'sidebar.topWords': '高频词汇',
  'sidebar.allContent': '全部内容',
  'sidebar.userOnly': '仅用户',
  'sidebar.assistantOnly': '仅助手',
  'sidebar.thinkingOnly': '仅思考',
  'sidebar.noWordsFound': '未找到词汇',

  // Sidebar - Details
  'sidebar.details': '详情',
  'sidebar.noSelection': '<未选择>',
  'sidebar.type': '类型',
  'sidebar.turn': '轮次',
  'sidebar.actions': '操作',
  'sidebar.collapse': '折叠',
  'sidebar.expand': '展开',
  'sidebar.focus': '聚焦',
  'sidebar.copy': '复制',
  'sidebar.copied': '已复制！',
  'sidebar.failed': '失败',
  'sidebar.prevTurn': '← 上一轮',
  'sidebar.nextTurn': '下一轮 →',
  'sidebar.collapseTurn': '↩ 折叠轮次',
  'sidebar.showRawData': '显示原始数据',
  'sidebar.hideRawData': '隐藏原始数据',
  'sidebar.error': '错误',
  'sidebar.sidechain': '子链',
  'sidebar.sidechainDesc': '此轮来自子代理',
  'sidebar.agent': '代理',
  'sidebar.stopReason': '停止原因',
  'sidebar.thinkingConfig': '思考配置',
  'sidebar.user': '用户',
  'sidebar.assistant': '助手',
  'sidebar.thinkingBlocks': '思考 ({count})',
  'sidebar.toolCalls': '工具调用 ({count})',
  'sidebar.toolResults': '工具结果 ({count})',
  'sidebar.contains': '包含',
  'sidebar.text': '文本',
  'sidebar.toolInput': '输入',
  'sidebar.toolResult': '结果',
  'sidebar.toolResultError': '结果（错误）',

  // Legend
  'legend.title': '图例',
  'legend.nodeTypes': '节点类型',
  'legend.user': '用户',
  'legend.assistant': '助手',
  'legend.thinking': '思考',
  'legend.toolCall': '工具调用',
  'legend.toolSuccess': '工具 ✓',
  'legend.toolError': '工具 ✗',

  // Conversation panel
  'conversation.noConversation': '未加载对话',
  'conversation.turns': '{count} 轮',
  'conversation.userLabel': '用户',
  'conversation.thinkingLabel': '思考',
  'conversation.outputLabel': '输出',
  'conversation.resultSuccess': '✓ 结果',
  'conversation.resultError': '✗ 错误',
  'conversation.more': '更多',
  'conversation.chars': '{count} 字符',
  'conversation.thinkingSummary': '{count} 次思考 ({chars} 字符 · {duration})',
  'conversation.thinkingSummaryNoTime': '{count} 次思考 ({chars} 字符)',
  'conversation.toolsSummary': '{count} 个工具 ({duration})',
  'conversation.toolsSummaryNoTime': '{count} 个工具',

  // Filters
  'filter.user': '用户',
  'filter.output': '输出',
  'filter.thinking': '思考',
  'filter.tools': '工具',
  'filter.documents': '文档',

  // Coil Controls
  'coil.title': '螺旋设置',
  'coil.geometry': '几何',
  'coil.radius': '半径',
  'coil.angle': '角度',
  'coil.verticalStep': '垂直步长',
  'coil.slinky': '弹簧效果',
  'coil.focusRadius': '聚焦半径',
  'coil.minSpacing': '最小间距',
  'coil.maxSpacing': '最大间距',
  'coil.lineStyle': '线条样式',
  'coil.lineColor': '颜色',
  'coil.lineWidth': '宽度',
  'coil.lineOpacity': '不透明度',
  'coil.reset': '重置',

  // Canvas Controls
  'canvas.autoRotate': '自动旋转',
  'canvas.coilSettings': '螺旋设置',

  // Toast messages
  'toast.invalidUrl': '无效链接',
  'toast.invalidUrlMessage': '请输入有效的链接（例如：https://example.com/trace.jsonl）',
  'toast.failedToLoad': '加载失败',
  'toast.invalidJsonl': '该链接未返回有效的JSONL文件',
  'toast.fetchFailed': '无法获取该链接（请检查链接是否存在并允许跨域请求）',
  'toast.localServerFailed': '无法连接到本地服务器。请确保CLI仍在运行。',
  'toast.authFailed': '认证失败 - 令牌无效或缺失',

  // File watcher
  'watch.stopped': '已停止监视',
  'watch.fileUpdated': '文件已更新',
  'watch.watchingStopped': '监视已停止：{error}',
  'watch.watchingFile': '正在监视：{filename}',

  // Time/duration formatting
  'time.ms': '{value}毫秒',
  'time.seconds': '{value}秒',
  'time.minutes': '{minutes}分{seconds}秒',

  // Misc
  'misc.github': 'GitHub',
  'misc.of': '/',
  'misc.browseFiles': '浏览文件',
  'misc.urlHint': '支持GitHub链接和允许跨域的链接',
  'misc.storedLocally': '存储在本地浏览器中',
  'misc.clearAll': '清除全部',
  'misc.clearConfirm': '清除所有最近的轨迹？',
  'misc.removeFromHistory': '从历史中移除',
  'misc.errorOccurred': '发生错误',

  // Document types
  'document.label': '文档',
  'document.image': '图片',
  'document.pdf': 'PDF',
  'document.textFile': '文本文件',
  'document.sourceUrl': '链接',
  'document.sourceFile': '文件',
  'document.sourceBase64': 'Base64',
  'document.open': '打开{type}',
  'document.fileId': '文件ID：',
  'document.downloadPdf': '下载PDF',
  'document.base64Data': 'Base64数据 ({size} KB)',
  'document.noPreview': '无法预览',

  // Recent traces
  'recent.turns': '{count} 轮',
  'recent.clusters': '{count} 个集群',

  // Detail panel actions
  'detail.collapseToSingle': '折叠为单个节点',
  'detail.expandAll': '展开显示所有块',
  'detail.centerCamera': '将相机对准此轮',
  'detail.copyContent': '复制轮次内容到剪贴板',
  'detail.prevTurn': '转到上一轮',
  'detail.nextTurn': '转到下一轮',

  // Metrics
  'metrics.turnNumber': '轮次 {number}',

  // Legend sections
  'legend.camera': '相机',
  'legend.navigation': '导航',
  'legend.rotate': '旋转',
  'legend.pan': '平移',
  'legend.forwardBack': '前进/后退',
  'legend.zoom': '缩放',
  'legend.homeView': '主视图',
  'legend.resetView': '重置视图',
  'legend.prevNextTurn': '上一轮/下一轮',
  'legend.expandCollapse': '展开/折叠',
  'legend.firstLast': '第一个/最后一个',

  // Coil controls (additional)
  'coil.tilt': '倾斜',
  'coil.cone': '锥度',
  'coil.expandAngle': '展开角',
  'coil.focus': '焦点',
  'coil.minGap': '最小间隙',
  'coil.maxGap': '最大间隙',
  'coil.showClusterLines': '显示集群线',
  'coil.parameters': '螺旋参数',

  // Watch
  'watch.requiresChromium': '文件监视需要基于Chromium的浏览器',
};

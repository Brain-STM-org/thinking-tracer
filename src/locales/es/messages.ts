/**
 * Spanish translations
 * Traducciones al español
 */

export const messages = {
  // App title
  'app.title': 'Thinking Tracer',
  'app.tagline': 'Explora los procesos de razonamiento de IA en 3D',

  // Landing page
  'landing.dropTitle': 'Thinking Tracer',
  'landing.dropIntro': 'Explora los procesos de razonamiento de IA en 3D. Visualiza trazas de conversación para entender patrones de pensamiento, uso de herramientas y flujo de respuestas. Exporta conversaciones a HTML o Markdown.',
  'landing.dropText': 'Arrastra un archivo de conversación',
  'landing.dropSubtext': 'Compatible con archivos .jsonl de asistentes de código IA',
  'landing.selectFile': 'Seleccionar archivo',
  'landing.loadUrl': 'Cargar URL',
  'landing.urlPlaceholder': 'https://ejemplo.com/trace.jsonl',
  'landing.orLoadFromUrl': 'o cargar desde URL',
  'landing.recentTraces': 'Trazas recientes',
  'landing.exampleTraces': 'Trazas de ejemplo',
  'landing.seeHowBuilt': 'Ver cómo se construyó',
  'landing.loading': 'Cargando...',
  'landing.loadingFromServer': 'Cargando desde servidor local...',
  'landing.connectingToCli': 'Conectando al CLI',
  'landing.watch': 'Vigilar',
  'landing.watching': 'Vigilando',

  // Toolbar
  'toolbar.back': 'Volver a selección de archivo',
  'toolbar.toggleSidebar': 'Alternar barra lateral',
  'toolbar.view3d': 'Solo vista 3D',
  'toolbar.viewSplit': 'Vista dividida',
  'toolbar.viewConversation': 'Solo conversación',
  'toolbar.export': 'Exportar conversación',
  'toolbar.exportHtml': 'Exportar como HTML',
  'toolbar.exportMarkdown': 'Exportar como Markdown',

  // Search
  'search.placeholder': 'Buscar en conversación...',
  'search.regexToggle': 'Alternar modo regex (sin distinción de mayúsculas)',
  'search.user': 'Usuario',
  'search.assistant': 'Asist',
  'search.thinking': 'Pensar',
  'search.tool': 'Herram',
  'search.result': 'Result',
  'search.prev': 'Anterior (Shift+Enter)',
  'search.prevShort': '↑ Ant',
  'search.next': 'Siguiente (Enter)',
  'search.nextShort': 'Sig ↓',
  'search.clear': 'Limpiar (Esc)',
  'search.clearShort': 'Limpiar',
  'search.noResults': 'Sin resultados',
  'search.resultCount': '{current} de {total}',
  'search.typeToSearch': 'Escribe para buscar',

  // Sidebar - Metrics
  'sidebar.metrics': 'Métricas',
  'sidebar.tokens': 'Tokens',
  'sidebar.output': 'Salida',
  'sidebar.input': 'Entrada',
  'sidebar.thinking': 'Pensamiento',
  'sidebar.tools': 'Herramientas',

  // Sidebar - Word Frequency
  'sidebar.topWords': 'Palabras frecuentes',
  'sidebar.allContent': 'Todo el contenido',
  'sidebar.userOnly': 'Solo usuario',
  'sidebar.assistantOnly': 'Solo asistente',
  'sidebar.thinkingOnly': 'Solo pensamiento',
  'sidebar.noWordsFound': 'No se encontraron palabras',

  // Sidebar - Details
  'sidebar.details': 'Detalles',
  'sidebar.noSelection': '<sin selección>',
  'sidebar.type': 'Tipo',
  'sidebar.turn': 'Turno',
  'sidebar.actions': 'Acciones',
  'sidebar.collapse': 'Contraer',
  'sidebar.expand': 'Expandir',
  'sidebar.focus': 'Enfocar',
  'sidebar.copy': 'Copiar',
  'sidebar.copied': '¡Copiado!',
  'sidebar.failed': 'Falló',
  'sidebar.prevTurn': '← Anterior',
  'sidebar.nextTurn': 'Siguiente →',
  'sidebar.collapseTurn': '↩ Contraer turno',
  'sidebar.showRawData': 'Mostrar datos crudos',
  'sidebar.hideRawData': 'Ocultar datos crudos',
  'sidebar.error': 'Error',
  'sidebar.sidechain': 'Subcadena',
  'sidebar.sidechainDesc': 'Este turno es de un subagente',
  'sidebar.agent': 'Agente',
  'sidebar.stopReason': 'Razón de parada',
  'sidebar.thinkingConfig': 'Config. de pensamiento',
  'sidebar.user': 'Usuario',
  'sidebar.assistant': 'Asistente',
  'sidebar.thinkingBlocks': 'Pensamiento ({count})',
  'sidebar.toolCalls': 'Llamadas a herramientas ({count})',
  'sidebar.toolResults': 'Resultados de herramientas ({count})',
  'sidebar.contains': 'Contiene',
  'sidebar.text': 'Texto',
  'sidebar.toolInput': 'Entrada',
  'sidebar.toolResult': 'Resultado',
  'sidebar.toolResultError': 'Resultado (Error)',

  // Legend
  'legend.title': 'Leyenda',
  'legend.nodeTypes': 'Tipos de nodo',
  'legend.user': 'Usuario',
  'legend.assistant': 'Asistente',
  'legend.thinking': 'Pensamiento',
  'legend.toolCall': 'Llamada a herramienta',
  'legend.toolSuccess': 'Herramienta ✓',
  'legend.toolError': 'Herramienta ✗',

  // Conversation panel
  'conversation.noConversation': 'No hay conversación cargada',
  'conversation.turns': '{count} turnos',
  'conversation.userLabel': 'Usuario',
  'conversation.thinkingLabel': 'Pensamiento',
  'conversation.outputLabel': 'Salida',
  'conversation.resultSuccess': '✓ Resultado',
  'conversation.resultError': '✗ Error',
  'conversation.more': 'Más',
  'conversation.chars': '{count} caracteres',
  'conversation.thinkingSummary': '{count} pensamientos ({chars} car. · {duration})',
  'conversation.thinkingSummaryNoTime': '{count} pensamientos ({chars} car.)',
  'conversation.toolsSummary': '{count} herramientas ({duration})',
  'conversation.toolsSummaryNoTime': '{count} herramientas',

  // Filters
  'filter.user': 'Usuario',
  'filter.output': 'Salida',
  'filter.thinking': 'Pensam.',
  'filter.tools': 'Herram.',
  'filter.documents': 'Docs',

  // Coil Controls
  'coil.title': 'Ajustes de espiral',
  'coil.geometry': 'Geometría',
  'coil.radius': 'Radio',
  'coil.angle': 'Ángulo',
  'coil.verticalStep': 'Paso V',
  'coil.slinky': 'Efecto resorte',
  'coil.focusRadius': 'Radio de enfoque',
  'coil.minSpacing': 'Espacio mín.',
  'coil.maxSpacing': 'Espacio máx.',
  'coil.lineStyle': 'Estilo de línea',
  'coil.lineColor': 'Color',
  'coil.lineWidth': 'Ancho',
  'coil.lineOpacity': 'Opacidad',
  'coil.reset': 'Restablecer',

  // Canvas Controls
  'canvas.autoRotate': 'Rotación automática',
  'canvas.coilSettings': 'Ajustes de espiral',

  // Toast messages
  'toast.invalidUrl': 'URL inválida',
  'toast.invalidUrlMessage': 'Por favor ingresa una URL válida (ej: https://ejemplo.com/trace.jsonl)',
  'toast.failedToLoad': 'Error al cargar',
  'toast.invalidJsonl': 'La URL no devolvió un archivo JSONL válido',
  'toast.fetchFailed': 'No se pudo obtener la URL (verifica que exista y permita solicitudes de origen cruzado)',
  'toast.localServerFailed': 'No se pudo conectar al servidor local. Asegúrate de que el CLI esté ejecutándose.',
  'toast.authFailed': 'Autenticación fallida - token inválido o faltante',

  // File watcher
  'watch.stopped': 'Vigilancia detenida',
  'watch.fileUpdated': 'Archivo actualizado',
  'watch.watchingStopped': 'Vigilancia detenida: {error}',
  'watch.watchingFile': 'Vigilando: {filename}',

  // Time/duration formatting
  'time.ms': '{value}ms',
  'time.seconds': '{value}s',
  'time.minutes': '{minutes}m {seconds}s',

  // Misc
  'misc.github': 'GitHub',
  'misc.of': 'de',
  'misc.browseFiles': 'Explorar archivos',
  'misc.urlHint': 'Compatible con URLs de GitHub y URLs con CORS habilitado',
  'misc.storedLocally': 'Almacenado localmente en tu navegador',
  'misc.clearAll': 'Borrar todo',
  'misc.clearConfirm': '¿Borrar todas las trazas recientes?',
  'misc.removeFromHistory': 'Eliminar del historial',
  'misc.errorOccurred': 'Ocurrió un error',

  // Document types
  'document.label': 'Documento',
  'document.image': 'Imagen',
  'document.pdf': 'PDF',
  'document.textFile': 'Archivo de texto',
  'document.sourceUrl': 'URL',
  'document.sourceFile': 'Archivo',
  'document.sourceBase64': 'Base64',
  'document.open': 'Abrir {type}',
  'document.fileId': 'ID de archivo:',
  'document.downloadPdf': 'Descargar PDF',
  'document.base64Data': 'Datos Base64 ({size} KB)',
  'document.noPreview': 'Vista previa no disponible',

  // Recent traces
  'recent.turns': '{count} turnos',
  'recent.clusters': '{count} grupos',

  // Detail panel actions
  'detail.collapseToSingle': 'Contraer a un solo nodo',
  'detail.expandAll': 'Expandir para mostrar todos los bloques',
  'detail.centerCamera': 'Centrar cámara en este turno',
  'detail.copyContent': 'Copiar contenido del turno al portapapeles',
  'detail.prevTurn': 'Ir al turno anterior',
  'detail.nextTurn': 'Ir al siguiente turno',

  // Metrics
  'metrics.turnNumber': 'Turno {number}',

  // Legend sections
  'legend.camera': 'Cámara',
  'legend.navigation': 'Navegación',
  'legend.rotate': 'Rotar',
  'legend.pan': 'Desplazar',
  'legend.forwardBack': 'Adelante/Atrás',
  'legend.zoom': 'Zoom',
  'legend.homeView': 'Vista inicial',
  'legend.resetView': 'Restablecer vista',
  'legend.prevNextTurn': 'Turno anterior/siguiente',
  'legend.expandCollapse': 'Expandir/Contraer',
  'legend.firstLast': 'Primero/Último',

  // Coil controls (additional)
  'coil.tilt': 'Inclinación',
  'coil.cone': 'Cono',
  'coil.expandAngle': 'Ángulo ∠',
  'coil.focus': 'Enfoque',
  'coil.minGap': 'Espacio mín',
  'coil.maxGap': 'Espacio máx',
  'coil.showClusterLines': 'Mostrar líneas de grupo',
  'coil.parameters': 'Parámetros de espiral',

  // Watch
  'watch.requiresChromium': 'La vigilancia de archivos requiere un navegador basado en Chromium',
};

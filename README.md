# thinking-trace-viewer

A WebGL/WebGPU visualization tool for exploring LLM conversations in 3D environments.

## Overview

`thinking-trace-viewer` provides an interactive way to dissect and visualize LLM conversation "traces" - including prompts, thinking processes, outputs, and metadata. Designed as an embeddable UI component, it can be integrated into other applications or run standalone for local exploration.

## Features

- **3D Visualization**: Render conversation traces using WebGL (with WebGPU support planned)
- **Trace Dissection**: Explore prompts, thinking, outputs, and metadata
- **Drag-and-Drop**: Load conversation files directly in the standalone viewer
- **Embeddable Component**: Use as a UI component in larger applications
- **Claude Code Support**: Initial support for Claude Code conversation files (more agents planned)

## Getting Started

### Standalone Usage

1. Clone the repository
2. Open the viewer in your browser
3. Drag and drop your conversation files to visualize them

### As an Embedded Component

```javascript
// Integration documentation coming soon
```

## Supported Formats

- Claude Code conversation files (`.json`)
- Additional agent formats planned

## License

Released under the MIT License. See [LICENSE.txt](./LICENSE.txt) for details.

Copyright 2026 Neomantra Corp

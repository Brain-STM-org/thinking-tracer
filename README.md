# thinking-trace-viewer

A WebGL/WebGPU visualization tool for exploring LLM conversations in 3D environments.

## Why This Tool?

Current LLM tooling falls into two camps:

| Category | Examples | Focus |
|----------|----------|-------|
| **Workflow tools** | Amp, ChatGPT history | Thread persistence, sharing, search |
| **Interpretability tools** | Anthropic research | Neural network internals |

**The gap**: Neither helps users navigate the *structure within* a conversation—understanding how prompts lead to thinking, how thinking connects to outputs, and how tool calls fit into the flow.

`thinking-trace-viewer` fills this gap by treating conversation structure as a first-class visualization problem. Research shows that users find reasoning processes often more valuable than final outputs, yet current tools present conversations as "walls of text" that create cognitive barriers.

## Overview

`thinking-trace-viewer` provides an interactive way to dissect and visualize LLM conversation "traces"—including prompts, thinking processes, tool calls, outputs, and metadata. Designed as an embeddable UI component, it can be integrated into other applications or run standalone for local exploration.

## Key Features

### Structural Navigation
- **Hierarchical visualization**: Tree/graph layout reveals conversation structure (not just linear text)
- **Breadth-first exploration**: See the overview first, drill into details on demand
- **Traceability**: Link outputs back to the prompts and thinking that produced them

### Trace Dissection
- **Thinking blocks**: Explore model reasoning as first-class content
- **Tool calls**: Visualize when and why tools were invoked
- **Metadata**: Token counts, timestamps, model info at each turn

### 3D Visualization
- **Spatial layout**: Use depth and position to convey relationships
- **WebGL rendering**: Hardware-accelerated graphics (WebGPU planned)
- **Progressive disclosure**: Collapsible sections for long conversations

### Practical
- **Drag-and-drop**: Load conversation files directly
- **Embeddable**: Use as a component in IDEs, dashboards, or debugging tools
- **Claude Code support**: Parse Claude Code conversation files (more agents planned)

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

## Design Principles

Based on research into how users interact with LLM reasoning:

1. **Structure over text**: Hierarchical display beats linear "wall of text"
2. **Overview first**: Users prefer breadth-first exploration
3. **Reasoning is content**: Thinking blocks deserve equal attention to outputs
4. **Show connections**: Trace outputs back to their source reasoning

## License

Released under the MIT License. See [LICENSE.txt](./LICENSE.txt) for details.

Copyright 2026 Neomantra Corp

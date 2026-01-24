# thinking-tracer

A 3D visualization tool for exploring LLM conversation traces. Navigate complex conversations with thinking blocks, tool calls, and multi-turn interactions in an interactive WebGL environment.

**[Live Demo](https://brain-stm-org.github.io/thinking-tracer/)** | [Documentation](#documentation)

<p align="center">
  <a href="etc/images/screenshot.png" target="_blank">
    <img src="etc/images/screenshot.png" alt="Thinking Tracer Screenshot" width="60%">
  </a>
</p>

## Features

### Spiral Cluster Layout
Conversations are organized as a **spiral helix** of turn clusters, providing a compact overview while maintaining spatial relationships. Each cluster represents a user+assistant turn pair.

- **Slinky effect**: The spiral compresses at the ends and expands around your focus point
- **Click to navigate**: Select any cluster to focus on it
- **Expand/collapse**: Double-click or press Enter to expand clusters and see individual blocks
- **Configurable coiling**: Adjust spiral parameters in real-time via the Coil controls panel

### Interactive 3D Navigation
- **Orbit controls**: Drag to rotate, scroll to zoom, Shift+drag to pan
- **Keyboard navigation**: Arrow keys to move between nodes, Home/End for first/last
- **Click selection**: Click any node to see its details
- **Connection lines**: Visualize the path through clusters with customizable lines

### Metrics Dashboard
A resizable panel shows per-turn metrics as stacked bar charts:
- **Total Tokens** / **Input Tokens** / **Output Tokens**
- **Thinking Blocks** count
- **Tool Calls** count
- **Content Length**

Click any bar to jump directly to that turn. Toggle metrics on/off with checkboxes.

### Detail Panel
View full content of any selected node:
- **Turn summary**: Block type counts, text previews
- **Thinking content**: Full reasoning with copy button
- **Tool calls**: Tool name and JSON input with copy button
- **Tool results**: Output content with success/error status
- **Raw JSON**: Toggle to see the underlying data structure

### Session Metadata
Displays conversation context:
- Model name and version
- Git branch (if available)
- Session duration
- Working directory

### Recent Traces
Automatically saves recently viewed traces (IndexedDB) for quick access. Supports custom naming.

### View Modes
Switch between three viewing modes:
- **3D View**: Full spatial visualization
- **Split View**: 3D canvas alongside conversation panel
- **Conversation View**: Linear text display with filtering

### Conversation Filters
In conversation and split views, filter content by type:
- User messages
- Assistant output
- Thinking blocks
- Tool calls/results

### Export
Export conversations in two formats for sharing or documentation:
- **HTML**: Self-contained styled document with collapsible sections
- **Markdown**: Clean text format for documentation, GitHub issues, or further processing

### File Watching
Watch files for live updates during active Claude Code sessions (Chromium browsers with File System Access API).

### Compression Support
Load compressed trace files directly:
- Gzip (`.gz`)
- Zstandard (`.zst`, `.zstd`)

## Getting Started

### Online
Visit the [live demo](https://brain-stm-org.github.io/thinking-tracer/) and drag-and-drop a Claude Code `.jsonl` file.

### Try the Sample
A sample trace file is included - this is the actual conversation trace from building this tool with Claude! Click "See How This Was Built" on the live demo to load it instantly.

### Local Development

```bash
# Clone the repository
git clone https://github.com/brain-stm-org/thinking-tracer
cd thinking-tracer

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 and drop a conversation file.

### Building

```bash
# Production build
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
```

## Supported Formats

| Format | Extension | Source |
|--------|-----------|--------|
| Claude Code | `.jsonl` | `~/.claude/projects/*/*.jsonl` |

Additional agent formats planned (Amp, ChatGPT).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow Right/Down` | Select next node |
| `Arrow Left/Up` | Select previous node |
| `Home` | Select first node |
| `End` | Select last node |
| `Enter` / `Space` | Expand/collapse selected cluster |
| `Backspace` | Collapse current cluster |
| `Escape` | Clear selection |
| `H` | Home view (restore saved camera position) |
| `R` | Reset view (initial camera position) |
| `/` | Focus search box |

## Architecture

```
src/
├── core/           # 3D rendering (Three.js scene, controls, viewer)
├── data/           # Data types and parsers
│   ├── types.ts    # TypeScript interfaces
│   └── parsers/    # Format-specific parsers
└── utils/          # File handling, storage utilities
```

### Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| 3D Rendering | Three.js (WebGL) |
| Line Rendering | Line2/LineMaterial |
| Build Tool | Vite |
| Testing | Vitest |
| Compression | fzstd |
| Markdown | marked |

## Deployment

The project includes GitHub Actions workflow for automatic deployment to GitHub Pages.

To enable:
1. Go to repo Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to `main` branch

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](./AGENTS.md) | Project overview and research |
| [MEMORY.md](./MEMORY.md) | Architecture decisions |
| [PLAN.md](./PLAN.md) | Implementation roadmap |
| [etc/reports/](./etc/reports/) | Research notes |

## License

Released under the MIT License. See [LICENSE.txt](./LICENSE.txt) for details.

Copyright 2026 Neomantra Corp

# PLAN: Implementation Planning

This document tracks the implementation roadmap for `thinking-tracer`.

## Design Goals (from research)

Before implementation, these research-backed principles guide feature decisions:

| Principle | Implementation Impact | Status |
|-----------|----------------------|--------|
| Hierarchy > linear | Use tree/graph layout, not scrolling text | Done |
| Breadth-first exploration | Overview mode with drill-down | Done |
| Thinking = first-class | Visible by default, equal visual weight | Done |
| Traceability | Selection highlights source reasoning | Done |
| Progressive disclosure | Collapse/expand with summaries | Done |

---

## Phase 1: Foundation - COMPLETE

### 1.1 Project Setup
- [x] Initialize project structure (TypeScript, bundler, dev server)
- [x] Set up WebGL rendering context with Three.js
- [x] Create basic HTML shell for standalone viewer
- [x] Configure build pipeline (Vite)
- [x] Set up testing infrastructure (Vitest)
- [x] Create Taskfile.yml for common operations

### 1.2 Data Layer
- [x] Define TypeScript interfaces for trace data model
  - Conversation, Turn, ContentBlock, ToolCall, ThinkingBlock
- [x] Implement Claude Code file parser
  - [x] Handle JSONL format (line-by-line JSON)
  - [x] Parse extended thinking blocks
  - [x] Parse tool calls and results
  - [x] Extract metadata (tokens, timestamps, model, git branch, cwd)
- [x] Create data normalization layer for future agent support
- [x] Add file drag-and-drop handler
- [x] Add file select button

### 1.3 Basic 3D Scene
- [x] Implement camera controls (orbit, pan, zoom)
- [x] Create scene graph structure for conversation
- [x] Basic lighting and materials
- [x] Responsive canvas sizing
- [x] Node color coding by type (user, assistant, thinking, tool_use, tool_result)

---

## Phase 2: Core Visualization - COMPLETE

### 2.1 Clustering & Layout Engine
*Research: Users prefer tree structure over linear text*

- [x] Implement turn-pair clustering (user + assistant grouped)
- [x] Spiral/helix layout for clusters
- [x] "Slinky" focus effect (compress ends, expand focus area)
- [x] Animated layout transitions (400ms easing)
- [x] Expand/collapse clusters with animation

### 2.2 Node Rendering
*Research: Different content types need distinct visual treatment*

- [x] Visual encoding for turn types:
  - User prompts (blue cube)
  - Assistant outputs (green cube)
  - Thinking blocks (purple sphere)
  - Tool calls (orange cone)
  - Tool results (red octahedron)
  - Clusters (teal sphere, sized by content)
- [x] Color legend panel (collapsible)

### 2.3 Thinking Block Visualization
*Research: Reasoning is often more valuable than output*

- [x] Render thinking blocks as expandable nodes
- [x] Show thinking content in detail panel
- [x] Copy button for thinking content

### 2.4 Tool Call Visualization
*Research: "Tool usage makes an agent come to life"*

- [x] Render tool calls as distinct node type
- [x] Show tool name, arguments in detail panel
- [x] Show tool results with error status
- [x] Copy buttons for tool input/output

---

## Phase 3: Interaction & Navigation - COMPLETE

### 3.1 Selection & Focus
*Research: Traceability—link outputs to source reasoning*

- [x] Click to select nodes (raycasting)
- [x] Detail panel shows full content of selected node
- [x] Keyboard navigation (arrow keys, Home/End, Escape)
- [x] Double-click to expand/collapse clusters
- [x] Enter/Space to toggle selected cluster
- [x] Backspace to collapse

### 3.2 Breadth-First Overview Mode
*Research: Users want to see structure first, then drill down*

- [x] Default spiral layout showing all clusters
- [x] Collapsed cluster state with preview
- [x] Click to expand/drill into clusters
- [x] Fit camera to show all nodes on load

### 3.3 Progressive Disclosure
*Research: Collapse complexity while preserving context*

- [x] Collapse/expand individual clusters
- [x] Summary info on collapsed clusters (thinking count, tool count)
- [x] Visual sizing based on content amount
- [x] Animated transitions preserve mental map

### 3.4 Metrics Charts
- [x] Stacked bar charts for per-turn metrics
- [x] Metrics: total tokens, input/output tokens, thinking count, tool count, content length
- [x] Click chart bars to navigate to cluster
- [x] Toggle individual metrics on/off
- [x] Resizable metrics panel

---

## Phase 4: Context & Metadata - COMPLETE

### 4.1 Token Visualization
*Research: Users care about context capacity*

- [x] Show token count per turn in metrics chart
- [x] Token breakdown (input, output) selectable

### 4.2 Session Metadata Panel
- [x] Model info display
- [x] Git branch display
- [x] Session duration
- [x] Working directory

### 4.3 Detail Panel
- [x] Content block type summary
- [x] Text content preview
- [x] Thinking preview
- [x] Tool names used
- [x] Copy buttons for all content
- [x] Raw JSON toggle

---

## Phase 5: Polish & UX - COMPLETE

### 5.1 Recent Traces
- [x] IndexedDB storage for recent traces
- [x] List in drop overlay
- [x] Click to reload
- [x] Delete individual / clear all
- [x] Custom naming for traces

### 5.2 Deployment
- [x] GitHub Actions workflow for GitHub Pages
- [x] Vite base path configuration
- [x] Production build tested

### 5.3 UI Chrome
- [x] Control panel (info, legend, detail, metrics)
- [x] Back button to file selector
- [x] Collapsible legend
- [x] View mode switcher (3D / Split / Conversation)

### 5.4 Export
- [x] Export to HTML (styled, collapsible sections)
- [x] Export to Markdown
- [x] Markdown rendering in conversation view

### 5.5 File Handling
- [x] Gzip compression support (.gz)
- [x] Zstd compression support (.zst, .zstd)
- [x] File watching for live updates (File System Access API)

### 5.6 Conversation View
- [x] Linear conversation display
- [x] Filter toggles (User, Output, Thinking, Tools)
- [x] Collapsible content blocks
- [x] Markdown rendering

---

## Phase 6: Advanced Visualization - COMPLETE

### 6.1 Coil Parameter Controls
- [x] Interactive sliders for spiral layout tuning
  - Primary spiral: radius, angle step
  - Secondary coil: radius, angle step, vertical step
  - Slinky effect: focus radius, min/max spacing
- [x] Reset to defaults button
- [x] Real-time animated updates

### 6.2 Cluster Connection Lines
- [x] Toggle for cluster-to-cluster connection lines
- [x] Line2 rendering (triangle strips) for proper width support
- [x] Customizable color picker with hex display
- [x] Width slider (1-50 pixels)
- [x] Opacity slider
- [x] All lines use Line2 for cross-platform compatibility

---

## Phase 7: Expansion - PLANNED

### 7.1 Additional Agent Formats
- [ ] Abstract parser interface (partially done)
- [ ] Amp thread format support
- [ ] ChatGPT export format support
- [ ] Document format specification for contributors

### 7.2 Sub-Agent Visualization
*Research: Amp sub-agents "execute parallel tasks and report results back"*

- [ ] Detect sub-agent spawning in traces
- [ ] Render sub-agents as nested hierarchies
- [ ] Show parallel execution visually

### 7.3 Embedding API
- [ ] Define public component API
- [ ] React wrapper component
- [ ] Publish as npm package

### 7.4 Advanced Search & Filter
- [x] Text search across all content (basic)
- [x] Regex search support
- [x] Filter by content type
- [x] Highlight search matches in 3D view
- [ ] Advanced query syntax

### 7.5 Performance Optimization
- [ ] Instanced rendering for many nodes
- [ ] Level-of-detail (simplify distant nodes)
- [ ] Lazy loading for large conversations

### 7.6 Accessibility
- [x] Keyboard navigation
- [ ] 2D fallback mode (no WebGL required)
- [ ] Screen reader descriptions
- [ ] High contrast mode

---

## Current Status

**Phases 1-6 Complete**: Full-featured viewer with:
- Spiral cluster layout with configurable coil parameters
- Slinky focus effect with adjustable spacing
- Full expand/collapse interaction
- Cluster-to-cluster connection lines with customization
- Metrics dashboard with click-to-navigate
- Detail panel with copy buttons
- Session metadata display
- Recent traces storage with custom naming
- GitHub Pages deployment
- Export to HTML and Markdown
- Compression support (gzip, zstd)
- File watching for live updates
- Conversation view with filters

**Next priorities**:
1. Additional agent format support (Amp, ChatGPT)
2. Sub-agent visualization
3. Performance optimization for large traces
4. npm package publishing

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | Type safety, IDE support |
| Rendering | Three.js (WebGL) | Mature, well-documented |
| Lines | Line2/LineMaterial | Proper width on all platforms |
| Build | Vite | Fast dev server, good defaults |
| Testing | Vitest | Fast, Vite-compatible |
| Storage | IndexedDB | Recent traces persistence |
| Compression | fzstd | Zstd format support |
| Markdown | marked | Content rendering |
| Deployment | GitHub Pages | Free static hosting |

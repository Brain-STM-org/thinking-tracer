# PLAN: Implementation Planning

This document tracks the implementation roadmap for `thinking-trace-viewer`.

## Design Goals (from research)

Before implementation, these research-backed principles guide feature decisions:

| Principle | Implementation Impact |
|-----------|----------------------|
| Hierarchy > linear | Use tree/graph layout, not scrolling text |
| Breadth-first exploration | Overview mode with drill-down |
| Thinking = first-class | Visible by default, equal visual weight |
| Traceability | Selection highlights source reasoning |
| Progressive disclosure | Collapse/expand with summaries |

---

## Phase 1: Foundation

### 1.1 Project Setup
- [ ] Initialize project structure (TypeScript, bundler, dev server)
- [ ] Set up WebGL rendering context with Three.js
- [ ] Create basic HTML shell for standalone viewer
- [ ] Configure build pipeline (Vite)
- [ ] Set up testing infrastructure (Vitest)

### 1.2 Data Layer
- [ ] Define TypeScript interfaces for trace data model
  - Conversation, Turn, ContentBlock, ToolCall, ThinkingBlock
- [ ] Implement Claude Code file parser
  - Handle extended thinking blocks
  - Parse tool calls and results
  - Extract metadata (tokens, timestamps)
- [ ] Create data normalization layer for future agent support
- [ ] Add file drag-and-drop handler

### 1.3 Basic 3D Scene
- [ ] Implement camera controls (orbit, pan, zoom)
- [ ] Create scene graph structure for conversation
- [ ] Basic lighting and materials
- [ ] Responsive canvas sizing

---

## Phase 2: Core Visualization

### 2.1 Hierarchical Layout Engine
*Research: Users prefer tree structure over linear text*

- [ ] Implement tree layout algorithm for turns
- [ ] Position nodes spatially (X: sequence, Y: branching, Z: depth/detail)
- [ ] Handle conversation branching (edit/retry scenarios)
- [ ] Animate layout transitions

### 2.2 Node Rendering
*Research: Different content types need distinct visual treatment*

- [ ] Design visual encoding for turn types:
  - User prompts (input nodes)
  - Assistant outputs (response nodes)
  - Thinking blocks (reasoning nodes)
  - Tool calls (action nodes)
  - Tool results (data nodes)
- [ ] Implement node meshes/sprites
- [ ] Add labels and previews
- [ ] Color coding by type/role

### 2.3 Thinking Block Visualization
*Research: Reasoning is often more valuable than output*

- [ ] Render thinking blocks as expandable nodes
- [ ] Show token count indicator
- [ ] Handle redacted thinking blocks gracefully
- [ ] Text rendering for thinking content (SDF text or HTML overlay)

### 2.4 Tool Call Visualization
*Research: "Tool usage makes an agent come to life"*

- [ ] Render tool calls as distinct node type
- [ ] Show tool name, arguments preview
- [ ] Connect tool calls to their results
- [ ] Indicate tool execution duration

---

## Phase 3: Interaction & Navigation

### 3.1 Selection & Focus
*Research: Traceability—link outputs to source reasoning*

- [ ] Click to select nodes
- [ ] Selection highlights related nodes (prompt → thinking → output chain)
- [ ] Detail panel shows full content of selected node
- [ ] Keyboard navigation (arrow keys, enter to select)

### 3.2 Breadth-First Overview Mode
*Research: Users want to see structure first, then drill down*

- [ ] Default "overview" camera position showing full conversation
- [ ] Collapsed node state showing summary/preview only
- [ ] Click to expand/drill into subtrees
- [ ] "Fit all" button to return to overview

### 3.3 Progressive Disclosure
*Research: Collapse complexity while preserving context*

- [ ] Collapse/expand individual nodes
- [ ] Collapse/expand subtrees
- [ ] Auto-summarize collapsed content (first N chars or AI summary)
- [ ] Visual indicator for collapsed state

### 3.4 Search & Filter
- [ ] Text search across all content
- [ ] Filter by node type (show only thinking, only tool calls, etc.)
- [ ] Highlight search matches in 3D view
- [ ] Jump to next/previous match

---

## Phase 4: Context & Metadata

### 4.1 Token Visualization
*Research: Users care about context capacity (Amp shows warnings at 80%)*

- [ ] Show token count per turn
- [ ] Cumulative token usage indicator
- [ ] Visual warning at high context usage
- [ ] Token breakdown by type (prompt, thinking, output)

### 4.2 Timeline View
- [ ] Optional timeline mode (X = time)
- [ ] Show duration of thinking/tool execution
- [ ] Timestamp display on hover

### 4.3 Metadata Panel
- [ ] Model info display
- [ ] Conversation stats (total turns, tokens, duration)
- [ ] Export metadata as JSON

---

## Phase 5: Polish & UX

### 5.1 Performance Optimization
- [ ] Instanced rendering for many nodes
- [ ] Level-of-detail (simplify distant nodes)
- [ ] Lazy loading for large conversations
- [ ] Virtual scrolling for text content
- [ ] Memory profiling and optimization

### 5.2 Accessibility
- [ ] 2D fallback mode (no WebGL required)
- [ ] Keyboard-only navigation
- [ ] Screen reader descriptions
- [ ] High contrast mode

### 5.3 UI Chrome
- [ ] Control panel (zoom, filter, layout options)
- [ ] Settings/preferences persistence
- [ ] Help overlay / keyboard shortcuts guide
- [ ] Loading states and error handling

---

## Phase 6: Expansion

### 6.1 Additional Agent Formats
- [ ] Abstract parser interface
- [ ] Amp thread format support
- [ ] ChatGPT export format support
- [ ] Document format specification for contributors

### 6.2 Sub-Agent Visualization
*Research: Amp sub-agents "execute parallel tasks and report results back"*

- [ ] Detect sub-agent spawning in traces
- [ ] Render sub-agents as nested hierarchies
- [ ] Show parallel execution visually
- [ ] Collapse sub-agent details by default

### 6.3 Embedding API
- [ ] Define public component API
- [ ] React wrapper component
- [ ] Vue wrapper component
- [ ] Create integration examples
- [ ] Publish as npm package

### 6.4 Sharing & Export
*Research: Amp users value sharing threads in code reviews*

- [ ] Export view as image (PNG/SVG)
- [ ] Generate shareable link (if hosted)
- [ ] Export filtered/annotated trace

---

## Current Focus

**Active**: Phase 1.1 - Project Setup

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | Type safety, IDE support |
| Rendering | Three.js (WebGL) | Mature, well-documented, WebGPU path available |
| Build | Vite | Fast dev server, good defaults |
| Testing | Vitest | Fast, Vite-compatible |
| Text rendering | troika-three-text | SDF text in Three.js |
| UI overlay | Preact or vanilla | Minimal footprint for embedding |

---

## Notes

- Keep bundle size minimal for embedding use case (<500KB ideal)
- Mobile/touch support from the start (pinch zoom, tap select)
- Design render abstraction to allow WebGPU migration later
- Consider WASM for layout computation if performance-critical

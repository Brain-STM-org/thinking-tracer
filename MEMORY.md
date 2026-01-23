# MEMORY: Long-term Concepts and Decisions

This document captures architectural decisions, design patterns, and persistent knowledge for the `thinking-tracer` project.

## Core Concepts

### Trace Structure

A "trace" represents a complete LLM conversation, containing:

- **Prompts**: User inputs and system instructions
- **Thinking**: The model's reasoning process (when available)
- **Tool Calls**: Invocations of external tools (file reads, searches, commands)
- **Outputs**: Generated responses and content
- **Metadata**: Timestamps, model info, token counts, etc.

### The Problem We Solve

Current tools present conversations as linear text, creating what research calls "significant cognitive barriers." Users struggle to:
- Understand how prompts led to specific outputs
- Navigate long reasoning chains
- See relationships between tool calls and decisions
- Find specific parts of complex conversations

### Our Approach

Treat conversation structure as a **visualization problem**, not a text display problem. Use spatial layout and hierarchy to reveal relationships that linear text obscures.

## Research-Backed Design Decisions

### 1. Hierarchical Over Linear Display

**Decision**: Use tree/graph visualization instead of linear text

**Research basis**: Hippo (UIST 2025) found that tree structure "significantly improved comprehension" vs. linear display. Users described linear reasoning as a "wall of text" that prevented meaningful engagement.

**Implementation**: Render turns as nodes in a spatial hierarchy. Parent-child relationships show prompt→response connections. Sibling relationships show alternative branches or parallel tool calls.

### 2. Breadth-First Exploration

**Decision**: Show overview first, allow drilling into details

**Research basis**: Hippo study participants "expressed interest in breadth-first exploration (seeing conceptual frameworks first, then drilling down) rather than the depth-first traversal." This matches how humans reason about complex information.

**Implementation**: Default view shows conversation structure at a glance. Clicking/selecting reveals details. Support collapse/expand for sections.

### 3. Thinking as First-Class Content

**Decision**: Treat thinking blocks with equal importance to outputs

**Research basis**: Hippo found that "for complex decisions, the thinking process was often more valuable than the output." Some users gained "sufficient confidence to decide independently after reviewing reasoning."

**Implementation**: Thinking blocks are visible by default (not hidden behind a toggle). Visual treatment gives them equal prominence to outputs.

### 4. Traceability / Provenance

**Decision**: Visually link outputs back to their source prompts and reasoning

**Research basis**: Hippo's "visual highlighting connects sentences in the final response back to the reasoning nodes they originated from." Users valued understanding where conclusions came from.

**Implementation**: Selection of an output highlights the prompts and thinking that contributed to it. Hover states show connections.

### 5. Progressive Disclosure

**Decision**: Collapsible sections with summaries for long content

**Research basis**: Hippo allows users to "collapse tree" with "summary of the collapsed subtree below the parent node." This reduces visual complexity while maintaining context.

**Implementation**: Long thinking blocks and tool outputs can be collapsed. Collapsed state shows a summary or preview.

## Architecture Decisions

### Rendering Engine

**Decision**: Start with WebGL, plan WebGPU migration path

**Rationale**: WebGL has broader browser support while WebGPU is still gaining adoption. Design abstractions to allow future migration.

**Implementation**: Using Three.js which provides both WebGL and WebGPU renderers.

### Component Design

**Decision**: Build as embeddable UI component

**Rationale**: Enables both standalone usage and integration into larger applications (IDEs, dashboards, debugging tools). Amp research shows users value having trace access in code reviews and other contexts.

### Agent Support

**Decision**: Start with Claude Code, expand to other agents

**Rationale**: Claude Code provides a well-documented format to build initial implementation. Abstract data ingestion to support additional formats (Amp, ChatGPT, etc.).

**Implementation**: `TraceParser` interface allows pluggable parsers. Currently implemented: `claudeCodeParser` for JSONL format.

### Clustering Layout

**Decision**: Use turn-pair clustering with spiral/helix arrangement

**Rationale**: Long conversations create overwhelming linear layouts. Grouping user+assistant turns into clusters reduces visual complexity while maintaining conversation structure.

**Implementation**:
- Each cluster = user message + assistant response pair
- Clusters arranged in a spiral helix (DNA-like structure)
- Cluster size varies based on content (thinking blocks, tool calls)

### Slinky Focus Effect

**Decision**: Variable vertical spacing based on focus distance

**Rationale**: Compress less-relevant parts of the conversation while expanding the area of interest. This "focus+context" technique from visualization research maintains overview while providing detail.

**Implementation**:
- Clusters near focus point have `maxVerticalSpacing` (2.0)
- Distant clusters have `minVerticalSpacing` (0.3)
- Smooth cosine falloff over `focusRadius` (3 clusters)
- Focus follows selection, animates smoothly

### Animation Strategy

**Decision**: 400ms eased animations for layout changes

**Rationale**: Preserves user's "mental map" during transitions. Research shows animated transitions help users track changes in spatial visualizations.

**Implementation**:
- Cubic ease-out for smooth deceleration
- Store start positions, interpolate to targets
- Selection transfers to parent cluster when child collapses

### Recent Traces Storage

**Decision**: Use IndexedDB for recent trace persistence

**Rationale**: Need to store potentially large JSONL files (multi-MB). localStorage has 5MB limit. IndexedDB handles larger data and is async.

**Implementation**:
- Store up to 10 recent traces
- LRU eviction when limit exceeded
- Store full file content for instant reload

## Data Model

### Conversation

```
Conversation
├── id: string
├── metadata: ConversationMetadata
│   ├── model: string
│   ├── startTime: Date
│   ├── totalTokens: number
│   └── source: "claude-code" | "amp" | ...
└── turns: Turn[]
```

### Turn

```
Turn
├── id: string
├── role: "user" | "assistant" | "system"
├── content: ContentBlock[]
├── thinking?: ThinkingBlock[]
├── toolCalls?: ToolCall[]
├── toolResults?: ToolResult[]
└── metadata: TurnMetadata
    ├── timestamp: Date
    ├── tokenCount: number
    └── duration?: number
```

### ContentBlock

```
ContentBlock
├── type: "text" | "code" | "image" | ...
├── content: string
└── language?: string  // for code blocks
```

### ToolCall

```
ToolCall
├── id: string
├── name: string
├── arguments: Record<string, any>
└── result?: ToolResult
```

### ThinkingBlock

```
ThinkingBlock
├── content: string
├── tokenCount: number
└── redacted: boolean  // for safety-flagged content
```

## Design Principles

1. **Structure over text**: Spatial layout reveals relationships linear text obscures
2. **Overview first**: Breadth-first exploration matches human cognition
3. **Reasoning is content**: Thinking blocks deserve equal visual treatment
4. **Show connections**: Trace outputs to their source prompts and reasoning
5. **Progressive disclosure**: Collapse complexity, preserve context with summaries
6. **Performance**: Handle large conversations without degrading UX
7. **Accessibility**: Provide 2D fallbacks and keyboard navigation

## Answered Questions (from research)

### What 3D representation best conveys conversation structure?
**Answer**: Hierarchical tree/graph with spatial depth. Breadth on X/Y axes shows turn sequence and branching. Depth (Z) can show detail levels or time. Research strongly supports hierarchy over linear layout.

### How to handle very long thinking blocks?
**Answer**: Progressive disclosure with collapse/expand. Show summary or preview when collapsed. Full content on expansion. Don't hide by default—users value seeing reasoning.

### What metadata is most useful to surface?
**Answer**: Token counts (users care about context capacity), timestamps, model info. Amp research shows context usage warnings (e.g., "80% capacity") are valued.

## Answered Questions

### What visual encoding best distinguishes thinking vs. output vs. tool calls?
**Answer**: Combination of color and geometry:
- User: Blue cube
- Assistant: Green cube
- Thinking: Purple sphere (semi-transparent)
- Tool use: Orange cone
- Tool result: Red octahedron
- Cluster: Teal sphere (sized by content)

### How to handle very long conversations?
**Answer**: Spiral clustering with slinky focus effect. Compress distant turns, expand around selection. Click metrics chart bars to jump to any turn.

## Open Questions

- [ ] How to represent sub-agents and parallel execution?
- [ ] Should we support annotation/commenting on traces?
- [ ] What export formats would be useful (image, PDF, shareable link)?
- [ ] How to handle branching conversations (edit/retry)?

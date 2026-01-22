# MEMORY: Long-term Concepts and Decisions

This document captures architectural decisions, design patterns, and persistent knowledge for the `thinking-trace-viewer` project.

## Core Concepts

### Trace Structure

A "trace" represents a complete LLM conversation, containing:

- **Prompts**: User inputs and system instructions
- **Thinking**: The model's reasoning process (when available)
- **Outputs**: Generated responses and content
- **Metadata**: Timestamps, model info, token counts, etc.

### Architecture Decisions

#### Rendering Engine

**Decision**: Start with WebGL, plan WebGPU migration path

**Rationale**: WebGL has broader browser support while WebGPU is still gaining adoption. Design abstractions to allow future migration.

#### Component Design

**Decision**: Build as embeddable UI component

**Rationale**: Enables both standalone usage and integration into larger applications (IDEs, dashboards, debugging tools).

#### Agent Support

**Decision**: Start with Claude Code, expand to other agents

**Rationale**: Claude Code provides a well-documented format to build initial implementation. Abstract data ingestion to support additional formats.

## Data Model

### Conversation

```
Conversation
├── id: string
├── metadata: ConversationMetadata
└── turns: Turn[]
```

### Turn

```
Turn
├── role: "user" | "assistant" | "system"
├── content: Content[]
├── thinking?: ThinkingBlock[]
└── metadata: TurnMetadata
```

## Design Principles

1. **Progressive Disclosure**: Show overview first, allow drilling into details
2. **Spatial Organization**: Use 3D space to represent conversation flow and relationships
3. **Performance**: Handle large conversations without degrading UX
4. **Accessibility**: Provide 2D fallbacks and keyboard navigation

## Open Questions

- [ ] What 3D representation best conveys conversation structure?
- [ ] How to handle very long thinking blocks in the visualization?
- [ ] What metadata is most useful to surface in the UI?

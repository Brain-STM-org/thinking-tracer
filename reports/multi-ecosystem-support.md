# Multi-Source Support Analysis

**Date:** January 2026
**Status:** Planning
**Purpose:** Document the changes required to support trace files from multiple AI coding assistants (Claude Code, Kimi Code, etc.)

---

## Executive Summary

The thinking-trace-viewer is currently built specifically for Claude Code JSONL trace files. To support additional sources like Kimi Code, we need to abstract source-specific logic into a pluggable architecture. This report identifies all affected areas and proposes an implementation plan.

---

## 1. Parser Layer (Critical)

### Current State

**Files:**
- `src/data/parsers/claude-code.ts` (554 lines) - Claude-specific parser
- `src/core/Viewer.ts:643-665` - Hardcoded to use only `claudeCodeParser`

```typescript
// Viewer.ts - only one parser is tried
this.conversation = claudeCodeParser.parse(content);
```

### Issues
- No parser registry or auto-detection
- Adding a new source requires modifying Viewer.ts
- No fallback or error handling for unknown formats

### Recommendation
Create a parser registry pattern that:
- Registers parsers by source ID
- Auto-detects source from file content
- Falls back gracefully for unknown formats

---

## 2. Data Types (Critical)

### Current State

**File:** `src/data/types.ts`

### Claude-Specific Fields

| Field | Location | Description |
|-------|----------|-------------|
| `EntryType` | types.ts | Values like `'file-history-snapshot'`, `'summary'`, `'queue-operation'` are Claude Code specific |
| `ConversationMeta.source` | types.ts | Hardcoded to `'claude-code'` in parser |
| `Turn.isSidechain` | types.ts | Sub-agent concept specific to Claude Code |
| `Turn.agentId` | types.ts | Sub-agent ID specific to Claude Code |
| `ConversationMeta.cwd` | types.ts | Working directory (Claude Code environment) |
| `ConversationMeta.git_branch` | types.ts | Git branch (Claude Code environment) |
| `ConversationMeta.summaries` | types.ts | Summary entries (Claude Code feature) |

### Recommendation
- Add `sourceId: string` field to `ConversationMeta`
- Make source-specific fields optional
- Create source-specific type extensions

---

## 3. UI Text & Labels (High Priority)

### Current State

**Hardcoded Strings:**

| File | Line | Text |
|------|------|------|
| `index.html` | 341 | "Explore Claude's reasoning process in 3D..." |
| `index.html` | 363 | "Supports Claude Code .jsonl trace files" |
| `ConversationPanel.ts` | ~95-99 | "sidechain", "agent" badge labels |
| `DetailPanel.ts` | ~242-254 | "This turn is from a sub-agent" |
| `exporter.ts` | ~144-148 | Hardcoded badge classes and labels in HTML export |
| `exporter.ts` | ~225-228 | Hardcoded labels in Markdown export |

### Recommendation
Create an source-aware UI text configuration system that maps source IDs to appropriate labels and descriptions.

---

## 4. Cluster Building (High Priority)

### Current State

**File:** `src/core/clusters/cluster-builder.ts`

### Claude-Specific Logic

```typescript
// isToolResultOnly() - lines 16-22
// Comment: "Claude Code logs them as type 'user'"
export function isToolResultOnly(turn: Turn): boolean {
  return (
    turn.role === 'user' &&
    turn.content.length > 0 &&
    turn.content.every((b) => b.type === 'tool_result')
  );
}
```

- Tool-result absorption logic (lines 147-159) handles Claude Code's specific JSONL structure
- Timing extraction assumes Claude Code entry timestamp format
- Cluster merging logic based on Claude Code's turn patterns

### Recommendation
Make cluster building strategy pluggable per source, allowing each parser to provide its own clustering rules.

---

## 5. Example Traces (Medium Priority)

### Current State

**File:** `src/ui/loaders/RecentTracesManager.ts`

```typescript
const EXAMPLE_TRACES: ExampleTrace[] = [
  {
    id: 'example-thinking-tracer',
    name: 'Thinking Tracer',
    description: 'See how this app was built with Claude',
    url: 'samples/sample-trace.jsonl.zstd',
    // ...
  },
  // ...
];
```

### Issues
- Examples are Claude Code specific
- No source field in `ExampleTrace` interface
- Description references Claude specifically

### Recommendation
- Add `source: string` field to `ExampleTrace`
- Create source-specific example sections in UI
- Store example traces per source in `public/samples/{source}/`

---

## 6. Metadata Display (Medium Priority)

### Current State

**File:** `src/main.ts:354-365`

```typescript
// Current metadata display
if (meta?.model) { /* ... */ }
if (meta?.git_branch) { /* ... */ }  // Claude Code specific
if (meta?.duration_ms) { /* ... */ }
if (meta?.cwd) { /* ... */ }  // Claude Code specific
```

**Title Generation** (`claude-code.ts:502`):
```typescript
title: sessionId ? `Session ${sessionId.slice(0, 8)}...` : 'Claude Code Session'
```

### Recommendation
Create source-specific metadata formatters that know which fields to display and how to format them.

---

## 7. Files Requiring No Changes

These components are already source-agnostic:

| Directory/File | Reason |
|----------------|--------|
| `src/core/layout/` | 3D geometry calculations are generic |
| `src/core/Scene.ts` | Three.js rendering is generic |
| `src/core/Controls.ts` | Camera controls are generic |
| `src/search/searcher.ts` | Operates on generic `SearchableCluster` |
| `src/utils/hash.ts` | Content hashing is generic |
| `src/utils/file-drop.ts` | File I/O is generic |
| `src/ui/panels/WordFrequencyPanel.ts` | Text analysis is generic |
| `src/ui/panels/MetricsPanel.ts` | Token metrics are generic |

---

## Proposed Architecture

### New Directory Structure

```
src/
├── data/
│   ├── parsers/
│   │   ├── index.ts           # Parser registry & auto-detection
│   │   ├── base.ts            # Base parser class/interface
│   │   ├── claude-code.ts     # Claude Code parser (existing)
│   │   └── kimi-code.ts       # Kimi Code parser (future)
│   └── types.ts               # Add sourceId, keep generic
│
├── config/
│   ├── sources/
│   │   ├── index.ts           # Source registry
│   │   ├── claude-code.ts     # Claude Code config
│   │   └── kimi-code.ts       # Kimi Code config (future)
│   └── theme.ts               # Existing (no changes)
│
├── core/
│   └── clusters/
│       ├── cluster-builder.ts # Generic orchestrator
│       └── strategies/
│           ├── index.ts       # Strategy registry
│           ├── claude-code.ts # Claude Code clustering
│           └── kimi-code.ts   # Kimi Code clustering (future)
```

### Source Configuration Interface

```typescript
interface SourceConfig {
  id: string;                    // 'claude-code', 'kimi-code'
  name: string;                  // 'Claude Code', 'Kimi Code'
  description: string;           // For UI display
  fileExtensions: string[];      // ['.jsonl']

  // Parser
  parser: TraceParser;

  // Cluster building strategy
  clusterStrategy?: ClusterStrategy;

  // UI customization
  ui: {
    icon?: string;               // Source icon
    badges: Record<string, string>;  // Badge label mappings
    metadataFields: string[];    // Which meta fields to display
  };

  // Capabilities
  capabilities: {
    hasSubAgents: boolean;       // Claude Code has sidechains
    hasThinking: boolean;        // Extended thinking support
    hasToolUse: boolean;         // Tool/function calling
  };
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Create the abstraction layer without breaking existing functionality.

1. **Create Parser Registry** (`src/data/parsers/index.ts`)
   - Define `ParserRegistry` class
   - Register `claudeCodeParser` as default
   - Implement `detectAndParse(content)` method
   - Update `Viewer.ts` to use registry

2. **Create Source Config** (`src/config/sources/`)
   - Define `SourceConfig` interface
   - Create `claude-code.ts` config
   - Create source registry

3. **Add Source ID to Types**
   - Add `sourceId?: string` to `ConversationMeta`
   - Update `claudeCodeParser` to set `sourceId: 'claude-code'`

### Phase 2: UI Abstraction (Week 2)

**Goal:** Remove hardcoded UI text and make it source-aware.

1. **Create UI Text System** (`src/config/ui-text.ts`)
   - Define text mappings per source
   - Create `getUIText(sourceId, key)` helper

2. **Update HTML**
   - Make landing page text generic or source-aware
   - Update file format description

3. **Update Panels**
   - `ConversationPanel.ts` - Use source config for badges
   - `DetailPanel.ts` - Use source config for labels
   - `exporter.ts` - Use source config for export

### Phase 3: Cluster Strategy (Week 3)

**Goal:** Make cluster building pluggable.

1. **Define Cluster Strategy Interface**
   ```typescript
   interface ClusterStrategy {
     shouldMergeWithPrevious(turn: Turn, prevTurn?: Turn): boolean;
     isToolResultTurn(turn: Turn): boolean;
     extractTiming(entries: Entry[]): TimingMaps;
   }
   ```

2. **Extract Claude Code Strategy**
   - Move Claude-specific logic to `strategies/claude-code.ts`
   - Keep `cluster-builder.ts` as generic orchestrator

3. **Update Cluster Builder**
   - Accept strategy as parameter
   - Default to Claude Code strategy for backward compatibility

### Phase 4: Kimi Code Support (Week 4)

**Goal:** Add first additional source.

1. **Analyze Kimi Code Format**
   - Document JSONL structure differences
   - Identify unique fields and patterns

2. **Create Kimi Code Parser**
   - Implement `kimi-code.ts` parser
   - Register in parser registry

3. **Create Kimi Code Config**
   - Define source config
   - Create cluster strategy if needed

4. **Add Example Traces**
   - Add Kimi Code sample trace
   - Update example traces UI

### Phase 5: Polish & Testing (Week 5)

1. **Comprehensive Testing**
   - Test both sources end-to-end
   - Test auto-detection accuracy
   - Test edge cases (empty files, malformed data)

2. **Documentation**
   - Update README with supported sources
   - Document how to add new sources
   - Create source integration guide

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Claude Code support | High | Keep Claude Code as default, extensive testing |
| Parser auto-detection conflicts | Medium | Implement confidence scoring, allow manual override |
| UI complexity increase | Medium | Hide source details when only one is loaded |
| Performance impact | Low | Lazy-load source configs, optimize parser detection |

---

## Success Criteria

1. Existing Claude Code traces continue to work without changes
2. Kimi Code traces load and visualize correctly
3. Auto-detection correctly identifies source in >95% of cases
4. UI adapts appropriately to each source's capabilities
5. Adding a new source requires only:
   - New parser file
   - New source config
   - Optional: new cluster strategy

---

## Appendix: Files Summary

### Must Change (Critical)
- `src/data/parsers/claude-code.ts`
- `src/core/Viewer.ts`
- `src/data/types.ts`

### Must Change (High Priority)
- `index.html`
- `src/main.ts`
- `src/ui/panels/ConversationPanel.ts`
- `src/ui/panels/DetailPanel.ts`
- `src/export/exporter.ts`
- `src/core/clusters/cluster-builder.ts`

### Should Change (Medium Priority)
- `src/ui/loaders/RecentTracesManager.ts`
- `src/config/theme.ts`
- `src/styles/main.css`

### New Files Required
- `src/data/parsers/index.ts`
- `src/data/parsers/base.ts`
- `src/config/sources/index.ts`
- `src/config/sources/claude-code.ts`
- `src/config/ui-text.ts`
- `src/core/clusters/strategies/index.ts`
- `src/core/clusters/strategies/claude-code.ts`

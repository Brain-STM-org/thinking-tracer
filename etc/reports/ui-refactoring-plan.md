# UI Panel Refactoring Plan

## Current State Analysis

### Panel Inventory in main.ts

| Panel | Lines | Location | Primary Function |
|-------|-------|----------|------------------|
| Detail Panel | ~250 | 1059-1310 | `renderDetail()` - shows selection info |
| Metrics Charts | ~160 | 1387-1545 | `drawCharts()` - bar charts per cluster |
| Word Frequency | ~200 | 1677-1879 | `analyzeWordFrequency()` - text analysis |
| Conversation View | ~275 | 1933-2210 | `renderConversation()` - linear display |
| Coil Controls | ~120 | scattered | Slider event handlers |

Total: ~1000+ lines of UI-specific code that could be modularized.

### Data Flow Analysis

```
                    ┌─────────────┐
                    │   Viewer    │
                    │  (3D Scene) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Selection  │   │   Metrics   │   │  Searchable │
│  Callback   │   │   Data      │   │   Content   │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
│Detail Panel │   │Metrics Panel│   │Conversation View│
│             │   │             │   │Search, Export   │
│             │   │             │   │Word Frequency   │
└─────────────┘   └─────────────┘   └─────────────────┘
```

### Shared Dependencies

All panels depend on:
1. **viewer** instance - for data and actions
2. **DOM elements** - panel containers
3. **Utility functions** - `escapeHtml`, `renderMarkdown`, `truncate`
4. **Shared state** - `currentFocusIndex`, `viewMode`, etc.

### Key Concern: Bidirectional Data Flow

Panels both **read from** and **write to** the viewer:

| Panel | Reads | Writes |
|-------|-------|--------|
| Detail | selection data, cluster count | toggleCluster, selectCluster, focusOnCluster |
| Metrics | getClusterMetrics | selectClusterByIndex |
| Conversation | getSearchableContent | (scroll sync only) |
| Word Freq | getSearchableContent | highlightCluster |
| Coil Controls | getCoilParams | setCoilParam, setShowClusterLines |

---

## Proposed Architecture

### Option A: Controller Pattern (Recommended)

Create a central `UIController` that:
1. Holds references to viewer and shared state
2. Instantiates panel modules with necessary callbacks
3. Manages inter-panel communication

```
src/
  ui/
    UIController.ts      # Orchestrates all panels
    panels/
      DetailPanel.ts     # Selection details
      MetricsPanel.ts    # Bar charts
      ConversationPanel.ts
      WordFrequencyPanel.ts
      CoilControlsPanel.ts
    types.ts             # Shared UI types
    index.ts             # Public exports
```

**Pros:**
- Clear ownership of state
- Easy to test panels in isolation
- Viewer interactions go through controller

**Cons:**
- Slightly more boilerplate
- Controller can become a "god object" if not careful

### Option B: Event-Based (Alternative)

Panels communicate via custom events on a shared event bus.

**Pros:**
- Very loose coupling
- Easy to add/remove panels

**Cons:**
- Harder to trace data flow
- Event debugging is tricky
- Type safety is harder

### Option C: Direct Viewer Injection

Pass viewer directly to each panel module.

**Pros:**
- Simple, minimal abstraction
- Panels are self-contained

**Cons:**
- Tight coupling to Viewer API
- Testing requires mocking entire Viewer
- Inter-panel coordination is ad-hoc

---

## Recommended Implementation Plan

### Phase 1: Extract Panel Interfaces (No Breaking Changes)

Define interfaces that panels will implement:

```typescript
// src/ui/types.ts
interface PanelContext {
  viewer: Viewer;
  elements: {
    container: HTMLElement;
    // panel-specific elements
  };
}

interface Panel {
  init(context: PanelContext): void;
  update(selection?: Selection): void;
  dispose(): void;
}
```

### Phase 2: Extract Metrics Panel First

Metrics is the most self-contained:
- Reads: `viewer.getClusterMetrics()`
- Writes: `viewer.selectClusterByIndex()`
- No inter-panel dependencies

```typescript
// src/ui/panels/MetricsPanel.ts
export class MetricsPanel implements Panel {
  private viewer: Viewer;
  private container: HTMLElement;
  private focusIndex: number = 0;

  constructor(container: HTMLElement, viewer: Viewer) { ... }

  draw(focusIndex?: number): void { ... }

  private handleClick(clusterIndex: number): void {
    this.viewer.selectClusterByIndex(clusterIndex);
  }
}
```

### Phase 3: Extract Conversation Panel

Next most isolated:
- Reads: `viewer.getSearchableContent()`
- Uses: `renderMarkdown`, `escapeHtml`
- Receives: filter state from search

### Phase 4: Extract Detail Panel

More complex due to many viewer interactions:
- Multiple button handlers
- Copy functionality
- Prev/next navigation

### Phase 5: Extract Word Frequency

Similar to metrics but with cluster highlighting.

### Phase 6: Create UIController

Finally, wire everything together:

```typescript
// src/ui/UIController.ts
export class UIController {
  private viewer: Viewer;
  private panels: Map<string, Panel> = new Map();

  constructor(viewer: Viewer, elements: UIElements) {
    this.viewer = viewer;

    // Initialize panels
    this.panels.set('metrics', new MetricsPanel(...));
    this.panels.set('detail', new DetailPanel(...));
    // etc.

    // Wire up viewer callbacks
    viewer.onSelect((selection) => {
      this.panels.forEach(p => p.update(selection));
    });
  }

  dispose(): void {
    this.panels.forEach(p => p.dispose());
  }
}
```

---

## Data Flow After Refactoring

```
┌─────────────────────────────────────────────────┐
│                  main.ts                         │
│  - DOM element lookup                           │
│  - UIController instantiation                   │
│  - File handling (drag/drop, watch)             │
│  - Keyboard shortcuts                           │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│               UIController                       │
│  - Holds Viewer reference                       │
│  - Manages panel lifecycle                      │
│  - Routes selection events                      │
│  - Coordinates inter-panel state                │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Detail  │   │ Metrics │   │ Convo   │
   │  Panel  │   │  Panel  │   │  Panel  │
   └─────────┘   └─────────┘   └─────────┘
```

---

## Migration Strategy

1. **Non-breaking extraction**: Move code to new files, import back into main.ts
2. **Incremental testing**: Add tests for each extracted panel
3. **One panel at a time**: Don't try to extract everything at once
4. **Keep main.ts working**: At each step, the app should still function

---

## Risk Mitigation

### Concern: Breaking existing functionality
**Mitigation**: Extract pure rendering functions first, keep event wiring in main.ts until stable

### Concern: Circular dependencies
**Mitigation**: Panels only depend on Viewer interface, not each other. Use controller for coordination.

### Concern: Performance regression
**Mitigation**: Profile before/after. The refactoring is structural, not algorithmic.

### Concern: Type safety across module boundaries
**Mitigation**: Define clear interfaces in `types.ts`, use strict TypeScript

---

## Recommended Starting Point

**Start with MetricsPanel** because:
1. Self-contained (~160 lines)
2. Clear inputs (cluster metrics) and outputs (selection)
3. No dependencies on other panels
4. Easy to unit test (mock viewer.getClusterMetrics)

After MetricsPanel works, the pattern is established for other panels.

---

## Questions to Consider

1. Should panels have their own CSS modules, or keep styles in index.html?
2. Do we want to support dynamic panel loading (for future extensibility)?
3. Should UIController be a class or a set of functions?

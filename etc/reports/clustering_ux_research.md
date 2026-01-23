# Clustering & Collapse/Expand UX Research

*Research conducted: 2026-01-22*

## Problem Statement

The current linear layout of conversation traces creates a long horizontal line that's hard to navigate. We need a way to:
1. Group related nodes into clusters
2. Collapse clusters to reduce visual complexity
3. Expand clusters on demand to see details
4. Maintain spatial context ("mental map") during expand/collapse

---

## Research Findings

### 1. Progressive Disclosure & Semantic Zoom

The dominant paradigm is [Shneiderman's mantra](https://dl.acm.org/doi/10.1145/3148011.3148015): **"Overview first, zoom and filter, then details-on-demand."**

Key techniques:
- **Semantic Zoom**: Change structure/detail based on zoom level, not just scale
- **Three-layer approach**: Topology → Aggregation → Visual Appearance
- **Map-like navigation**: Like Google Maps showing cities→streets→buildings

### 2. Clustering Algorithms for Graphs

| Algorithm | Approach | Best For |
|-----------|----------|----------|
| **Hierarchical/Agglomerative** | Bottom-up merging of similar nodes | Pre-defined structure (our case) |
| **Edge Betweenness** | Remove high-traffic edges to find clusters | Discovery of natural groupings |
| **Force-in-a-Box** | Force-directed within cluster bounds | Spatial clustering |

For conversation traces, we have **natural clustering** by:
- Turn (user/assistant pair)
- Content type (thinking blocks, tool calls)
- Time windows
- Topic/task (if we parse content)

### 3. Expand/Collapse Interaction Patterns

From [yWorks](https://www.yworks.com/pages/clustering-graphs-and-networks) and [Cambridge Intelligence](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/):

**Collapse operation:**
1. Replace cluster nodes with a single "meta-node"
2. Aggregate edges between clusters into "meta-edges"
3. Show summary info on collapsed node (count, preview)

**Expand operation:**
1. Replace meta-node with child nodes
2. Animate expansion to maintain mental map
3. Push surrounding nodes outward proportionally

**Critical UX principle:** Preserve the user's mental map during transitions using:
- Animated transitions (not instant)
- Proximity-based displacement (push neighbors out)
- Consistent node positions within clusters

### 4. 3D-Specific Techniques

From [clustering-based force-directed research](https://link.springer.com/article/10.1007/s11227-020-03226-w):

- **Weighted meta-nodes**: Collapsed clusters become spheres sized by content
- **Hierarchical embedding**: Clusters positioned first, then internal layout
- **Fisheye/focus+context**: Expand area around cursor, compress distant areas

---

## Proposed Implementation for Trace Viewer

### Clustering Model

```
Conversation
├── Turn Cluster (User + Assistant pair)
│   ├── User Node
│   └── Assistant Node
│       ├── Thinking Block(s)
│       └── Tool Call Cluster
│           ├── Tool Use
│           └── Tool Result
```

### Three Levels of Detail

| Level | Shows | Layout |
|-------|-------|--------|
| **Overview** | One sphere per turn-pair | Spiral/helix arrangement |
| **Turn** | User + Assistant nodes | Vertical stack |
| **Full** | All blocks (thinking, tools) | Current linear + depth |

### Visual Design for Collapsed Clusters

**Turn Cluster (collapsed):**
- Sphere with gradient showing user→assistant colors
- Size based on token count or content length
- Label: Turn number + preview text
- Glow/ring indicates presence of thinking/tools inside

**Tool Cluster (collapsed):**
- Octahedron combining tool_use + tool_result colors
- Badge showing tool count
- Tooltip: List of tool names

### Interaction Design

1. **Double-click** to expand/collapse a cluster
2. **Scroll wheel on cluster** for gradual expand (semantic zoom)
3. **Keyboard**: `Enter` expands selected, `Backspace` collapses
4. **Expand all / Collapse all** buttons in UI

### Layout Algorithm

**Collapsed state (Overview):**
```
Arrange turn-clusters in a helix/spiral:
- X = turn_index * spacing * cos(turn_index * angle)
- Y = turn_index * spacing * sin(turn_index * angle)
- Z = turn_index * vertical_spacing

This creates a "DNA helix" or "spiral staircase" shape.
```

**Expanded state:**
```
When a cluster expands:
1. Animate meta-node splitting into children
2. Children emerge from center, settle into positions
3. Neighboring clusters push outward with spring force
4. Camera optionally zooms to fit expanded cluster
```

### Animation

- **Collapse**: Children fly toward center, merge into sphere
- **Expand**: Sphere splits, children emerge and settle
- **Duration**: 300-500ms with easing
- **Maintain selection**: If selected node is inside collapsing cluster, select the cluster

---

## Implementation Phases

### Phase 1: Turn-pair Clustering
- Group user+assistant into turn clusters
- Add collapse/expand for turn level
- Spiral layout for collapsed view

### Phase 2: Content Clustering
- Collapse thinking blocks within a turn
- Collapse tool call chains
- Show summary badges

### Phase 3: Semantic Zoom
- Automatic collapse based on camera distance
- Fisheye effect around selection
- Smooth LOD transitions

### Phase 4: Smart Clustering
- Auto-detect task boundaries
- Cluster by topic similarity
- Time-gap based clustering

---

## Sources

- [Cambridge Intelligence: Graph Visualization UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/)
- [yWorks: Clustering Graphs and Networks](https://www.yworks.com/pages/clustering-graphs-and-networks)
- [Clustering-based Force-directed 3D Algorithms](https://link.springer.com/article/10.1007/s11227-020-03226-w)
- [Force Directed Embedding of Hierarchical Cluster Graphs](https://www.researchgate.net/publication/264887393_Force_Directed_Embedding_of_Hierarchical_Cluster_Graphs)
- [Semantic Zooming for Ontology Graphs](https://dl.acm.org/doi/10.1145/3148011.3148015)
- [Multi-level Tree Visualization with Semantic Zoom](https://arxiv.org/abs/1906.05996)
- [3d-force-graph Clustering Discussion](https://github.com/vasturiano/3d-force-graph/issues/124)

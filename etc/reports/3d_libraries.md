# 3D Library Research for thinking-tracer

*Research conducted: 2026-01-22*

## Executive Summary

**Recommendation**: Three.js with WebGPU renderer, supported by troika-three-text for text rendering and custom/3d-force-graph for layout.

Three.js is the clear choice for this project due to its dominant ecosystem (270x more npm downloads than alternatives), production-ready WebGPU support, smaller bundle size ideal for embedding, and excellent supporting libraries for text and graph visualization.

---

## Framework Comparison

### Three.js

| Attribute | Details |
|-----------|---------|
| **npm downloads** | 11M+ monthly (270x more than Babylon.js) |
| **GitHub stars** | ~18 new stars/day |
| **Bundle size** | Core ~150KB minified |
| **WebGPU** | Production-ready since r171 (`import { WebGPURenderer } from 'three/webgpu'`) |
| **Philosophy** | Minimal core, flexible toolbox |

**Strengths:**
- Lightweight and modular
- Massive ecosystem of add-ons
- Excellent for data visualization
- WebGPU ready with zero-config imports
- Best choice for embeddable components

**Weaknesses:**
- More assembly required (no built-in physics, etc.)
- Less opinionated (more decisions to make)

**Best for:** Data visualization, artistic visualizations, embeddable UI components

### Babylon.js

| Attribute | Details |
|-----------|---------|
| **npm downloads** | ~40K monthly |
| **GitHub stars** | 24,754 |
| **Bundle size** | 500KB+ (full engine) |
| **WebGPU** | Supported |
| **Philosophy** | Complete game engine |

**Strengths:**
- Full-featured game engine
- Built-in physics, VR/AR, animation systems
- Excellent documentation
- Visual scene inspector
- Active Microsoft backing

**Weaknesses:**
- Larger bundle size
- Opinionated architecture
- Overkill for visualization projects

**Best for:** Games, VR/AR experiences, complex simulations, configurators

### React Three Fiber

| Attribute | Details |
|-----------|---------|
| **Relationship** | React renderer for Three.js |
| **Performance** | Matches or exceeds plain Three.js |
| **Features** | All Three.js features supported |

**Strengths:**
- Declarative React syntax
- Excellent for React-based applications
- Large community momentum
- Hooks-based API

**Weaknesses:**
- Requires React
- Additional abstraction layer

**Best for:** React applications requiring 3D

### Other Notable Options

| Library | Focus | Notes |
|---------|-------|-------|
| **deck.gl** | Data visualization | WebGL2/WebGPU, great for large datasets, geospatial focus |
| **PlayCanvas** | Game engine | WebGL-based, smaller than Babylon |
| **Orillusion** | WebGPU-native | Pure WebGPU engine, newer/less mature |
| **PixiJS** | 2D/3D graphics | Used by Google, BBC, Disney; modular |

---

## WebGPU Status (2026)

### Browser Support

As of September 2025, WebGPU is supported across all major browsers:

| Browser | Status |
|---------|--------|
| Chrome/Edge (Windows, macOS, ChromeOS) | Stable |
| Chrome (Android) | Stable |
| Firefox (Windows, macOS) | Stable |
| Safari (macOS, iOS, iPadOS, visionOS) | Stable (Safari 26+) |

Safari was the last holdout, shipping WebGPU support in September 2025.

### Performance Benefits

- Up to **10x improvement** in draw-call-heavy scenarios
- Compute shaders for general-purpose GPU work (physics, ML inference)
- Better resource management with explicit GPU memory control
- Reduced CPU overhead
- Multi-threading support

### Three.js WebGPU Integration

```javascript
// Zero-config WebGPU usage in Three.js r171+
import { WebGPURenderer } from 'three/webgpu';

const renderer = new WebGPURenderer();
```

---

## Text Rendering: troika-three-text

### Overview

troika-three-text provides high-quality text rendering in Three.js using Signed Distance Fields (SDF).

### Key Features

| Feature | Description |
|---------|-------------|
| **On-the-fly SDF** | Parses .ttf/.otf/.woff directly, generates SDF atlas as needed |
| **Full Unicode** | Automatic fallback fonts for complete coverage |
| **Bidirectional** | RTL, Arabic joined scripts, proper kerning/ligatures |
| **Web Worker** | Font parsing and SDF generation in worker thread |
| **GPU Acceleration** | Optional WebGL-accelerated SDF generation |
| **Material Support** | Works with all Three.js materials (lighting, PBR, shadows) |

### Usage

```javascript
import { Text } from 'troika-three-text';

const text = new Text();
text.text = 'Hello World';
text.fontSize = 0.5;
text.color = 0xffffff;
text.sync();
scene.add(text);
```

### Bundle Size

~50KB minified (excluding font files)

---

## Graph Layout Options

### 3d-force-graph

A web component for 3D force-directed graph visualization built on Three.js.

**Features:**
- Uses d3-force-3d or ngraph physics engine
- Trackball, orbit, or fly camera controls
- Available in 2D, VR, and AR versions
- React bindings available

**GitHub:** https://github.com/vasturiano/3d-force-graph

### d3-force

The underlying physics simulation library from D3.js.

**Features:**
- Velocity Verlet numerical integrator
- Configurable forces (centering, collision, links, many-body)
- Can run in 1D, 2D, or 3D

### Custom Layout

For tree/hierarchical layouts (more appropriate for conversation structure), a custom layout algorithm may be preferable:

- **Tree layouts**: d3-hierarchy provides Reingold-Tilford algorithm
- **Radial layouts**: Good for showing depth/levels
- **Force-directed**: Better for showing relationships/clusters

---

## Recommended Stack for thinking-tracer

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **3D Engine** | Three.js | Dominant ecosystem, small bundle, WebGPU ready |
| **Renderer** | WebGPURenderer (fallback to WebGLRenderer) | Future-proof, better performance |
| **Text** | troika-three-text | Best SDF text for Three.js |
| **Layout** | Custom tree + d3-hierarchy | Conversation structure is hierarchical |
| **Build** | Vite | Fast dev server, good defaults |
| **Language** | TypeScript | Type safety for complex data models |
| **Testing** | Vitest | Fast, Vite-compatible |
| **UI Overlay** | Preact or vanilla | Minimal footprint for embedding |

### Bundle Size Target

| Component | Estimated Size |
|-----------|---------------|
| Three.js core | ~150KB |
| troika-three-text | ~50KB |
| Custom code | ~50KB |
| **Total** | **~250KB** (well under 500KB goal) |

---

## Sources

### Framework Comparisons
- [Babylon.js vs Three.js: Team Scalability](https://dev.to/devin-rosario/babylonjs-vs-threejs-choosing-the-right-3d-framework-for-long-term-team-scalability-col)
- [Babylon.js vs React Three Fiber](https://aircada.com/blog/babylon-js-vs-react-three-fiber)
- [Three.js vs Babylon.js - LogRocket](https://blog.logrocket.com/three-js-vs-babylon-js/)
- [Babylon.js vs Three.js - JavaScript in Plain English](https://javascript.plainenglish.io/babylon-js-vs-three-js-which-should-you-choose-14faef9f7d78)

### WebGPU
- [What's New in Three.js 2026](https://www.utsubo.com/blog/threejs-2026-what-changed)
- [WebGPU Supported by All Major Browsers](https://videocardz.com/newz/webgpu-is-now-supported-by-all-major-browsers)
- [WebGPU Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- [WebGPU API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

### Text Rendering
- [Troika Three Text Documentation](https://protectwise.github.io/troika/troika-three-text/)
- [troika-three-text npm](https://www.npmjs.com/package/troika-three-text)
- [Troika GitHub](https://github.com/protectwise/troika/tree/main/packages/troika-three-text)

### Graph Visualization
- [3d-force-graph GitHub](https://github.com/vasturiano/3d-force-graph)
- [d3-force Documentation](https://d3js.org/d3-force)
- [Graph Drawing Libraries Comparison](https://github.com/anvaka/graph-drawing-libraries)
- [Cytoscape.js](https://js.cytoscape.org/)

### General Resources
- [WebGL/WebGPU Frameworks Collection](https://gist.github.com/dmnsgn/76878ba6903cf15789b712464875cfdc)
- [deck.gl](https://deck.gl/)
- [Babylon.js](https://www.babylonjs.com/)

## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| **GraphViewportComponent** | [components/graph-viewport/graph-viewport.ts](/components/graph-viewport/graph-viewport.ts) |

This component is responsible for rendering and managing the interactive 3D visualization of the graph data using the `3d-force-graph` library. Its primary responsibility is to translate the abstract graph state—including node positions, links, selection status, and styling configurations—into a dynamic, performant visual representation within a canvas element. It handles the complex physics simulation and visual transitions (fades) between different states.

Architecturally, `GraphViewportComponent` acts as the primary presentation layer for the graph visualization. It subscribes to state changes from [GraphStateService](/src/services/graph-state.service.md) and styling configurations from [GraphStyleService](/src/services/graph-style.service.md). It integrates several sub-components, such as [GraphHudComponent](/components/graph-hud/graph-hud.md) and [GraphStylePanelComponent](/components/graph-style-panel/graph-style-panel.md), to provide a complete user interface around the visualization canvas.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `resetCamera()` | Method | Resets the camera position of the 3D graph instance to a default view. |
| `getScreenCoords(x: number, y: number, z: number)` | Method | Converts 3D world coordinates (x, y, z) into 2D screen coordinates relative to the viewport. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The component initializes the `ForceGraph3D` instance in `ngOnInit`, running the setup outside of Angular's zone to maintain performance. It subscribes to various state streams (e.g., `graphData$`, `focusedNode$`) to trigger visual updates. Visual changes are managed via a fading mechanism (`retargetFades` and `fadeStep`), which uses `requestAnimationFrame` to smoothly transition node colors, link colors, and link widths based on the current selection intensity (`selectionIntensity`). Physics settings are dynamically applied based on the configuration from [GraphStyleService](/src/services/graph-style.service.md), allowing toggling between DAG mode and force-directed simulation.
- **Side Effects:** Mutates the external state managed by `ForceGraph3D` instance (`this.graphInstance`). It uses `requestAnimationFrame` for rendering loops and interacts with the DOM to measure element positions when calculating camera offsets (`offsetForInspector`).
- **Error Handling:** Fallback mechanisms exist for camera targeting when the `.inspector-panel` is not yet rendered, using a frame-counting approach to ensure the panel is available before adjusting the camera view.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** `@angular/core`, `rxjs`, `3d-force-graph`
- **Internal:** [GraphStateService](/src/services/graph-state.service.md), [GraphHierarchyService](/src/services/graph-hierarchy.service.md), [GraphStyleService](/src/services/graph-style.service.md), [GraphNode](/src/core/graph.model.md), [GraphLink](/src/core/graph.model.md), [GraphHudComponent](/components/graph-hud/graph-hud.md), [GraphStylePanelComponent](/components/graph-style-panel/graph-style-panel.md)
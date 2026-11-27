## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| **GraphHudComponent** | [src/components/graph-hud/graph-hud.ts](/src/components/graph-hud/graph-hud.ts) |

This component is responsible for rendering the Heads-Up Display (HUD) elements overlaid on the knowledge graph visualization area. Its primary function is to project dynamic visual indicators—such as badges for clusters and pills for individual nodes—onto the 2D screen space based on the 3D positions of graph elements. It manages the display state, including filtering via search queries and highlighting based on user focus or selection.

Architecturally, `GraphHudComponent` acts as a presentation layer component that consumes state from the [GraphStateService](/src/components/graph-hud/graph-hud.ts). It relies heavily on the [GraphViewportComponent](/src/components/graph-hud/graph-hud.ts) to perform the necessary 3D-to-2D coordinate projections. It integrates styling information from the [GraphStyleService](/src/components/components/graph-hud/graph-hud.ts) to determine the visual appearance of the projected elements.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `GraphHudComponent` | Class | Manages the HUD visualization, subscribing to graph state changes and running a continuous projection loop. |
| `displayTitle` | Getter | Returns the component's title, defaulting to `DEFAULT_HUD_TITLE` if no title is provided. |
| `switchTab(tabId: string)` | Method | Changes the active tab within the HUD inspector panel and triggers a change detection check. |
| `toggleInspectorPanel()` | Method | Toggles the collapsed state of the inspector panel and triggers a change detection check. |
| `onSearchInput(event: Event)` | Method | Processes user input from the search field, filtering nodes and updating the `searchMatchingNodes` state. |
| `resetCamera()` | Method | Instructs the bound `viewport` component to reset its camera position. |
| `goBackInspectorSelection()` | Method | Clears the currently selected node in the graph state. |
| `onClusterClick(clusterName: string, event: MouseEvent)` | Method | Handles clicks on cluster badges, triggering a state change to focus on that cluster. |
| `onNodeClick(nodeId: string, event: MouseEvent)` | Method | Handles clicks on node pills, triggering a state change to focus on that specific node. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The component operates a continuous rendering loop (`startProjectionLoop`) running outside of Angular's zone using `requestAnimationFrame`. In each frame, `updateProjections` calculates the screen coordinates for all visible clusters (badges) and nodes (pills). Visibility and opacity are determined based on the current focus state (`focusedNode`, `focusedClusterPrefix`), search results (`searchMatchingNodes`), and the calculated level of the cluster.
- **Side Effects:** It interacts with external state management via `GraphStateService` (subscribing to `clusterGroups$`, `graphData$`, etc.) and mutates the component's internal state (`visibleBadges`, `visiblePills`). It also calls methods on the injected `GraphViewportComponent` to perform coordinate transformations.
- **Error Handling:** Fallbacks are implemented for the display title (`DEFAULT_HUD_TITLE`) and for projection calculations where coordinate retrieval (`viewport.getScreenCoords`) might return null.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** `rxjs`, `@angular/core`
- **Internal:** [GraphStateService](/src/components/graph-hud/graph-hud.ts), [GraphStyleService](/src/components/graph-hud/graph-hud.ts), [GraphViewportComponent](/src/components/graph-hud/graph-hud.ts), [GraphSearchComponent](/src/components/graph-hud/graph-hud.ts)
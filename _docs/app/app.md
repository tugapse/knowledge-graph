## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| AppComponent | [app/app.ts](/app/app.ts) |

This component serves as the root container for the entire application, responsible for initializing and managing the core graph visualization and inspection features. Its primary responsibility is to fetch the necessary graph data, process it into a usable state, and orchestrate the display of the graph using specialized sub-components.

Architecturally, `AppComponent` acts as the main controller layer for the graph visualization module. It consumes data from the [GraphStateService](/src/services/graph-state.service.md) and utilizes the [GraphHierarchyService](/src/services/graph-hierarchy.service.md) to perform structural analysis. It integrates the visualization via [GraphViewportComponent](/src/components/graph-viewport/graph-viewport.md) and provides inspection capabilities through [GraphInspectorComponent](/src/components/graph-inspector/graph-inspector.md).

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `AppComponent` | Class | The main component class managing graph lifecycle, data loading, and state synchronization. |
| `onResetCamera()` | Method | Triggers a camera movement reset within the graph viewport, setting specific coordinates for the view. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The component initializes by calling `loadGraphData()`. This method attempts to fetch graph data from a local resource (`data.json`); if that fails, it falls back to an API endpoint (`api/data`). Upon successful data retrieval, `initGraphPayload` normalizes the data using `normalizeGraphData`, calculates cluster groups using `buildClusterGroups`, counts connections using `countConnections`, and finally updates the application state via `GraphStateService`.
- **Side Effects:** Interacts with the network via `HttpClient` to fetch `data.json` and `api/data`. Mutates external state managed by `GraphStateService` by calling `setClusterGroups` and `setGraphData`.
- **Error Handling:** Implements a fallback mechanism in `loadGraphData`: if the initial HTTP GET fails, it attempts a secondary GET request to the API endpoint. If the secondary request also fails, it logs the error to the console.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** `@angular/core`, `@angular/common/http`, `rxjs`
- **Internal:** [GraphData](/src/core/graph.model.md), [GraphViewportComponent](/src/components/graph-viewport/graph-viewport.md), [GraphInspectorComponent](/src/components/graph-inspector/graph-inspector.md), [GraphHierarchyService](/src/services/graph-hierarchy.service.md), [GraphStateService](/src/services/graph-state.service.md), [countConnections](/src/core/graph-normalize.md), [normalizeGraphData](/src/core/graph-normalize.md)
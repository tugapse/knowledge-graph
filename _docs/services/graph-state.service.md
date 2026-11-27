## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| **GraphStateService** | [src/services/graph-state.service.ts](/src/services/graph-state.service.ts) |

This service manages the entire state of the graph visualization and interaction within the application. Its primary responsibility is to hold, expose, and manage observable streams for critical graph data, including the overall graph structure (`GraphData`), groupings (`ClusterGroup`), focused elements (nodes/clusters), and various selection/highlighting states. It acts as the central source of truth for the graph's current configuration.

It functions as a core state management service, similar to a centralized store. It provides reactive interfaces (`Observable`) for components to subscribe to changes in the graph state, allowing UI elements to react automatically when data is updated via methods like `setGraphData` or `selectNode`. It integrates data models from [../core/graph.model](/../core/graph.model.md) to maintain type safety across the application.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `NeighborRelation` | Interface | Defines the structure for a relationship between two nodes, including direction and inferred status. |
| `GraphStateService` | Class | Manages all observable state related to the graph, providing methods to update and query the current state. |
| `graphData` | Getter | Returns the current `GraphData` object held by the service. |
| `clusterGroups` | Getter | Returns the current map of cluster groups. |
| `setGraphData(data: GraphData)` | Method | Updates the internal state with new graph data. |
| `setClusterGroups(groups: Record<string, ClusterGroup>)` | Method | Updates the internal state with a new map of cluster groups. |
| `setSelectionIntensity(val: number)` | Method | Sets the intensity value used for visual selection feedback. |
| `setSearchMatchingNodes(nodes: Set<string>)` | Method | Updates the set of nodes currently matching a search query. |
| `triggerCameraMove(...)` | Method | Initiates a camera movement animation to focus on a specific point in the 3D space. |
| `selectNode(node: GraphNode | null)` | Method | Selects a specific node, updating highlights, neighbors, and triggering a camera move to focus on it. |
| `selectCluster(clusterName: string, badgeYOffset: Record<number, number>, baseDistance: Record<number, number>, distanceScale: number)` | Method | Selects an entire cluster, updating search matches and triggering a camera move to center on the cluster's average position. |
| `setSearchResults(matches: GraphNode[])` | Method | Sets the results of a search operation, updating the matching nodes state. |
| `clearSelection()` | Method | Resets all selection, highlighting, and focus states within the service. |
| `goBack()` | Method | Placeholder method intended for navigation history management. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The service relies heavily on `BehaviorSubject` instances to maintain and broadcast the current state of various graph aspects. State transitions are managed by dedicated setter methods. The `selectNode` method contains complex logic to calculate highlights, semi-highlights, root cluster nodes, and neighbor relations by iterating through all links connected to the selected node. The `selectCluster` method calculates the average position of nodes within a cluster to determine the target camera coordinates.
- **Side Effects:** The service mutates its internal state via `BehaviorSubject.next()`. It triggers external visual changes by calling `triggerCameraMove`, which sets the `cameraTargetSub`.
- **Error Handling:** The `selectNode` method includes checks for `data` and `groups` being present before attempting to process links or clusters, providing graceful fallback if the underlying data is null.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** `rxjs`
- **Internal:** [../core/graph.model](/../core/graph.model.md)
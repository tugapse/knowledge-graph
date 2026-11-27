## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| GraphHierarchyService | [src/services/graph-hierarchy.service.ts](/src/services/graph-hierarchy.service.ts) |

This service is responsible for analyzing a set of `GraphNode` objects to determine their structural relationships and hierarchical placement within a dependency graph. Its primary function is to parse complex node identifiers to derive a sequence of conceptual levels, which are then used to build a structured representation of clusters and a corresponding hierarchy object.

It acts as a core data processing service within the application architecture. It consumes raw graph nodes and transforms them into a structured `Record<string, ClusterGroup>` representation, which is essential for rendering the graph visualization, likely feeding into components that rely on [GraphStyleService](/src/services/graph-style.service.ts) for visual styling.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `parseNodeLevels(node: GraphNode \| null): string[]` | Method | Parses a `GraphNode` ID to determine its conceptual hierarchy levels. Returns an array of strings representing the node's path. |
| `buildClusterGroups(nodes: GraphNode[]): Record<string, ClusterGroup>` | Method | Processes an array of nodes, calculates their hierarchy, collapses redundant paths, and structures them into cluster groups keyed by their path. |
| `calculateClusterCenters(clusterGroups: Record<string, ClusterGroup>, hierarchyObj: Record<string, any>, parentCenter: { x: number, y: number, z: number }, currentLevel: number, currentPath: string, parentAngle: number): void` | Method | Recursively calculates the spatial coordinates (center) for each cluster group based on the graph's hierarchy and styling parameters. |
| `getNodeBaseColor(node: GraphNode): ColorRgb` | Method | Determines the base color for a node based on its assigned group (`node.group`), utilizing the [GraphStyleService](/src/services/graph-style.service.ts). |
| `getLinkBaseColor(link: GraphLink): ColorRgb` | Method | Determines the base color for a link based on its relation type (`link.relation`), utilizing the [GraphStyleService](/src/services/graph-style.service.ts). |
| `getLevelColor(node: GraphNode): ColorHexRgb` | Method | Returns a color based on the number of levels found in the node's hierarchy (`node._levels.length`), using the [GraphStyleService](/src/services/graph-style.service.ts). |

## 3. Implementation Details & Side Effects
- **Core Logic:** The `buildClusterGroups` method iteratively refines node level paths by collapsing paths that only contain a single node (unless that node is 'CORE'). It then builds a nested `hierarchy` object mirroring the path structure and populates `clusterGroups` for every prefix of a node's path. The `calculateClusterCenters` method uses a recursive traversal of the `hierarchyObj` to position clusters in 3D space, influenced by node count and predefined orbital parameters from the styling service.
- **Side Effects:** Mutates the input `GraphNode` objects by adding temporary properties (`_tempLevels`, `_levels`) and final properties (`subsystem`). It also mutates the `clusterGroups` object by adding `targetCenter` properties.
- **Error Handling:** The `parseNodeLevels` method includes checks for null/empty nodes and specific ID prefixes (`@external/`) to provide predictable fallback values (`['CORE']` or `['EXTERNAL']`).

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** None
- **Internal:** [GraphNode](/src/core/graph.model.ts), [ClusterGroup](/src/core/graph.model.ts), [ColorRgb](/src/core/graph.model.ts), [GraphLink](/src/core/graph.model.ts), [ColorHexRgb](/src/core/graph.model.ts), [GraphStyleService](/src/services/graph-style.service.ts)
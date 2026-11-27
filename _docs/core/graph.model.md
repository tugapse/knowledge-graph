## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| Graph Data Models | [core/graph.model.ts](/core/graph.model.ts) |

This component defines the comprehensive data structures necessary for representing a graph, which is intended to visualize relationships between entities like modules, classes, and functions. It establishes the blueprint for nodes, links, and the overall configuration required to render and manipulate this graph structure, particularly when integrated with visualization libraries like 3d-force-graph.

This file serves as the core data model layer for the application. It defines interfaces such as `GraphNode`, `GraphLink`, and `GraphData`, which are consumed by graph processing and rendering services. Furthermore, it provides `GraphConfig`, which dictates rendering parameters, physics simulation settings, and color mapping rules for the graph visualization.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `ColorHexRgb` | Interface | Defines a color using both hexadecimal and RGB string representations. |
| `ColorRgb` | Interface | Defines a color using its red, green, and blue integer components. |
| `NodeColorMap` | Interface | Maps different types of graph elements (module, class, function, etc.) to specific `ColorRgb` values. |
| `LinkColorMap` | Interface | Maps different types of relationships (imports, calls, inherits) to specific `ColorRgb` values. |
| `GraphNode` | Interface | Defines the structure for a single node in the graph, including positional, semantic, and metadata fields. |
| `GraphLink` | Interface | Defines the structure for a directed or undirected connection between two nodes. |
| `GraphData` | Interface | The container object holding arrays of `GraphNode` and `GraphLink`. |
| `ClusterGroup` | Type | An intersection type extending `GraphNode` to include cluster-specific metadata like `level` and `targetCenter`. |
| `GraphConfig` | Interface | Holds the complete configuration object for the graph, including physics settings, color definitions, and camera parameters. |

## 3. Implementation Details & Side Effects
Structural definitions only; no complex logic or side effects.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** None
- **Internal:** None
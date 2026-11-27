## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| **DEFAULT_GRAPH_CONFIG** | [src/core/graph.config.ts](/src/core/graph.config.ts) |

This component defines the comprehensive default configuration object, `DEFAULT_GRAPH_CONFIG`, which dictates the visual and structural parameters for graph rendering and simulation within the application. It centralizes settings for graph layout (DAG mode, radial settings), color mapping for nodes and links, opacity levels based on relationship proximity, and physics simulation parameters.

This configuration serves as the foundational blueprint for graph visualization components. It is consumed by rendering services to ensure a consistent and predictable appearance across different graph instances, providing sensible defaults for complex visual attributes like node colors (e.g., L1 Cyan, L2 Purple) and physics behaviors (e.g., `charge: -800`).

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `DEFAULT_GRAPH_CONFIG` | Constant | A complete configuration object adhering to the `GraphConfig` structure, containing defaults for DAG, physics, camera, and labeling settings. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The configuration object is a static data structure initialized with predefined values for various graph properties. It maps specific visual elements (like node types or level numbers) to concrete color values (hex/RGB) and defines numerical parameters for physics simulation (e.g., link distances, gravity alpha).
- **Side Effects:** None. The component is purely declarative data initialization.
- **Error Handling:** None.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** None.
- **Internal:** [./graph.model](/src/core/graph.model.md)
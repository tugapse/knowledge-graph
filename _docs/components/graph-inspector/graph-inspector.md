## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| **GraphInspectorComponent** | [components/graph-inspector/graph-inspector.ts](/components/graph-inspector/graph-inspector.ts) |

This component serves as the primary UI panel for inspecting detailed information about a selected node or cluster within the application's graph visualization. Its core responsibility is to aggregate data from various services—such as graph state, hierarchy, and styling—to present a comprehensive view, including metadata, related neighbors, and associated documentation.

It acts as a sophisticated presentation layer component, consuming state streams from [GraphStateService](/src/services/graph-state.service.md) and [GraphHierarchyService](/src/services/graph-hierarchy.service.md). It manages user interactions like navigation history, panel resizing, and filtering of relational data, providing a rich, interactive inspection experience for graph elements.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `GraphInspectorComponent` | Class | Manages the state and rendering logic for the graph inspection panel. Implements `OnInit` and `OnDestroy`. |
| `onFocusCluster(clusterName: string)` | Method | Triggers the focus mechanism on a specific cluster via the state service. |
| `onFocusNode(nodeId: string)` | Method | Selects a specific node, updating the component's focus and navigation history. |
| `onMarkdownClick(event: MouseEvent)` | Method | Event handler that intercepts clicks within rendered documentation to navigate to linked nodes or clusters. |
| `toggleCollapse()` | Method | Toggles the collapsed state of the inspector panel. |
| `onResizeStart(event: MouseEvent)` | Method | Initiates the drag-and-drop resizing of the inspector panel, persisting the width to local storage. |
| `onBack()` | Method | Navigates back in the component's internal history stack. |
| `getLinkRgb(relation: string)` | Method | Calculates the RGB color string associated with a given relation type using the hierarchy service. |
| `isRelationShown(relation: string)` | Method | Checks if a specific relation type is currently visible based on user filters. |
| `toggleRelation(relation: string)` | Method | Adds or removes a relation type from the set of hidden relations, updating the filter state. |
| `toggleExternal()` | Method | Toggles the visibility of external dependencies in the displayed relations. |
| `showAllRelations()` | Method | Resets all relation filters, making all relations and external dependencies visible. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The component subscribes to several state observables (`clusterGroups$`, `focusedNode$`, `focusedCluster$`, etc.) to maintain its internal state. When a node is focused, it attempts to render its documentation (`renderDocs`), which involves parsing raw Markdown using the `marked` library. Crucially, `annotateDocLinks` parses the resulting HTML and rewrites all anchor tags (`<a>`) to include `data-kgNode` or `data-kgCluster` attributes, allowing the `onMarkdownClick` listener to correctly route user clicks back into the graph state. Relation filtering (`applyRelationFilters`) sorts and filters neighbors based on user-defined hidden lists and external visibility settings.
- **Side Effects:** The component interacts heavily with external state management via `GraphStateService` and `GraphHierarchyService`. It reads and writes configuration settings (panel width, collapsed sections, hidden relations) to `localStorage`. It also uses `console.log` during initialization.
- **Error Handling:** It employs `try...catch` blocks extensively when interacting with `localStorage` to handle potential storage unavailability. The Markdown parsing uses a `Promise.resolve().catch()` structure to handle potential parsing failures gracefully by setting `docsHtml` to an empty string.

## 4. Dependencies & Configuration
**Environment & Configuration:**
- `PANEL_WIDTH_KEY` — Key used in `localStorage` to persist the inspector panel's width.
- `COLLAPSED_SECTIONS_KEY` — Key used in `localStorage` to persist the collapsed state of various sections.
- `HIDDEN_RELATIONS_KEY` — Key used in `localStorage` to persist a set of relation types that should be hidden from view.
- `SHOW_EXTERNAL_KEY` — Key used in `localStorage` to persist a boolean flag determining if external relations should be visible.

**Module Dependencies:**
- **Standard/External:** `rxjs`, `marked`
- **Internal:** [GraphStateService](/src/services/graph-state.service.md), [GraphHierarchyService](/src/services/graph-hierarchy.service.md), [GraphStyleService](/src/services/graph-style.service.md), [CommonModule](/src/components/common/common.module.md), [DomSanitizer](/src/platform-browser/dom-sanitizer.ts), [GraphStateService](/src/services/graph-state.service.md), [GraphHierarchyService](/src/services/graph-hierarchy.service.md), [GraphStyleService](/src/services/graph-style.service.md), [createNodeResolver](/src/core/graph-normalize.ts), [refSegments](/src/core/graph-normalize.ts)
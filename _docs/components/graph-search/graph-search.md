## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| **GraphSearchComponent** | [components/graph-search/graph-search.ts](/components/graph-search/graph-search.ts) |

This component is responsible for providing a sophisticated, interactive search interface for nodes within the application's graph data. It handles user input, filters the entire graph dataset based on the query, and displays ranked results to the user. Its primary function is to allow users to quickly locate specific nodes using text input, providing visual feedback on where the search term matched within the node's properties.

Architecturally, this component acts as a presentation layer UI component that consumes state from services like [GraphStateService](/src/services/graph-state.service.md) and [GraphHierarchyService](/src/services/graph-hierarchy.service.md). It manages its own local state for the search results, active index, and visibility, coordinating selection actions back into the application state via the provided services.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `SearchResult` | Interface | Defines the structure for a single search result, including the matched `GraphNode`, a calculated `score`, and detailed `nameParts` indicating where the query matched. |
| `TextPart` | Interface | Represents a segment of text, indicating whether it contains a match (`hit: true`) or not. |
| `highlight` | Function | Takes a string `text` and a query string `q`, returning an array of `TextPart` objects that highlight every occurrence of `q` within `text`. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The component's core logic revolves around the `runSearch` method, which iterates over all available `GraphNode`s. For each node, the private `score` method calculates a relevance score based on matching criteria (exact name match, prefix match, keyword presence, etc.). Results are then sorted by score, limited to `MAX_RESULTS` (30), and displayed. Keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`) is managed via `onInputKeydown` to select results, and the `scrollActiveIntoView` method ensures the selected item is visible within the results container.
- **Side Effects:** The component mutates external state by calling methods on `GraphStateService` (e.g., `setSearchResults`, `selectNode`, `clearSelection`) when a selection is made or the search is cleared. It also interacts with the DOM via `@HostListener` methods to capture global key presses and mouse events.
- **Error Handling:** The search logic includes fallbacks for missing data (e.g., `node.name` or `node.id`) when calculating the name for scoring. The `highlight` function handles an empty query string gracefully by returning a single non-hit part.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** `rxjs`
- **Internal:** [GraphStateService](/src/services/graph-state.service.md), [GraphHierarchyService](/src/services/graph-hierarchy.service.md), [GraphNode](/src/core/graph.model.md)
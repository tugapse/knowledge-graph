## 1. Overview & Purpose
| Component | Source File |
| :--- | :--- |
| GraphStylePanelComponent | [src/components/graph-style-panel/graph-style-panel.ts](/src/components/graph-style-panel/graph-style-panel.ts) |

This component is responsible for providing a user interface panel that allows users to configure various visual and behavioral aspects of a graph visualization. It manages a complex configuration object, `GraphStyleConfig`, which dictates properties like node colors, link widths, and physics simulation parameters.

It acts as a primary UI controller for style settings, interacting with the [GraphStyleService](/src/services/graph-style.service.md) to load initial state, apply changes live, and persist the configuration to local storage. It structures settings into logical groups (Appearance, Physics & Layout) for user navigation.

## 2. Public API & Interfaces
| Entity | Type | Description |
| :--- | :--- | :--- |
| `GraphStylePanelComponent` | Class | Manages the state and UI interaction for graph style configuration. |
| `toggle()` | Method | Toggles the visibility state of the panel. |
| `toggleSection(id: string)` | Method | Adds or removes a section ID from the set of currently open sections. |
| `get(path: Path)` | Method | Retrieves a deeply nested value from the current draft configuration using a path array. |
| `set(path: Path, value: unknown)` | Method | Updates a deeply nested value in the draft configuration using a path array and commits the change. |
| `commit()` | Method | Pushes the current draft configuration to the [GraphStyleService](/src/services/graph-style.service.md) and persists it. |
| `resetAll()` | Method | Resets the entire configuration to the service's default state and updates the draft. |
| `resetSection(section: Section)` | Method | Resets all configurable items within a specific section to their default values defined in the service. |
| `fmt(value: number, step: number)` | Method | Formats a numeric value to a string, intelligently determining the required decimal precision based on the step size. |
| `trackSection(_: number, s: Section)` | Method | Returns the ID of a section, used for tracking purposes. |

## 3. Implementation Details & Side Effects
- **Core Logic:** The component initializes its state by cloning the current configuration from the [GraphStyleService](/src/services/graph-style.service.md). It uses path arrays (`Path`) to navigate and modify the nested `GraphStyleConfig` object (`draft`). Changes made via `set()` trigger an immediate `commit()` which updates the service and persists the state. The `resetSection` method iterates over defined items in a section, fetches the corresponding default value from the service, and applies it to the draft.
- **Side Effects:** Mutates external state by calling `this.styleService.update()` and `this.styleService.reset()`, which implies interaction with the service's internal state and potentially local storage.
- **Error Handling:** No explicit try/catch blocks are present; data access relies on optional chaining (`obj?.[k]`) within `get` and `reduce` operations to prevent runtime errors during path traversal.

## 4. Dependencies & Configuration
**Environment & Configuration:**
No environment variables or external configurations required.

**Module Dependencies:**
- **Standard/External:** `@angular/core`, `@angular/common`, `@angular/forms`
- **Internal:** [GraphStyleService](/src/services/graph-style.service.md)
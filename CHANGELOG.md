# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-11-27

### Added

- **Knowledge viewer**: a prebuilt, standalone build of the graph viewer in
  `knowledge_viewer/`, loaded with the project's own knowledge graph (`data.json`).
- **Project knowledge**: per-file knowledge entries in `_knowledge/`.
- **Docs**: Markdown documentation for every app, component, core and service
  file in `_docs/`.

### Changed

- Style panel: "Max node labels" now sits at the top of the Labels section, and
  the node label size slider goes up to 16 (was 22).
- Angular CLI analytics turned off.

## [1.1.0] - 2026-11-27

### Added

- **Smooth selection fades**: selecting or deselecting a node now fades the rest
  of the graph in and out instead of switching instantly.
- **Camera avoids the inspector**: when you focus a node, the camera offsets so
  the node isn't hidden behind the inspector panel.
- **New README**: why the project exists, what it does, getting started, a quick
  tour, the input format and screenshots.

## [1.0.0] - 2026-11-11

First release of the Angular/TypeScript app.

### Added

- Angular app with standalone components for the 3D knowledge graph viewer.
- Redesigned HUD, search with results list, and a richer node inspector with
  navigation history.
- Style panel for tuning the graph's look.
- Graph normalization and subsystem clustering.

### Changed

- The Python runner now drives the Angular production build.

[Unreleased]: https://github.com/tugapse/knowledge-graph/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/tugapse/knowledge-graph/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/tugapse/knowledge-graph/compare/589183b...v1.1.0
[1.0.0]: https://github.com/tugapse/knowledge-graph/tree/589183b

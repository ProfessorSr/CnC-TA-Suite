# Changelog

Notable changes to CnC-TA-Suite are recorded here. The project follows semantic versioning.

## Unreleased

- Replaced unavailable `DateField` and `embed.Html` Qooxdoo classes in Combat Reports and Tactical Map with game-compatible text fields, rich labels, and native scrolling.
- Assigned every right-side Suite shortcut a unique native game icon and expanded use of colored resource, alliance, combat, report, world, and status artwork.
- Fixed bulk resource transfers by submitting native `SelfTrade` commands sequentially with required `CommandResult` callbacks instead of firing a callback-less batch.
- Added per-destination Quick Transfer profiles for all resources, Crystal only, Tiberium only, or custom Tiberium/Crystal percentages from all eligible owned bases.
- Added the read-only API Inspector with readiness and service summaries, cloned public snapshots, documented API examples, diagnostic health, and redacted diagnostic export.
- War Room now opens automatically on the Attack Planner whenever native combat setup opens or changes to another target.
- Added click-to-move and click-to-swap formation editing, a vertical troop legend, target level labels, and a native **Simulate Preview** action for manually arranged formations.
- Expanded best-formation search with Quick, Detailed, and Exhaustive candidate sets containing individual troop relocations and swaps; true one-shot results are prioritized using total defender health.
- Normalized native simulation callback collections across game builds and restored replay loading through runtime discovery of the obfuscated battleground loader.
- Corrected War Room army health percentages and resolved Report Summary loot identifiers to Tiberium, Crystal, Credits, Power, and Research Points.
- Expanded War Room formation planning with preview-only undo, redo, reset, four-way shifts, horizontal/vertical mirrors, and row swaps while retaining the explicit experimental confirmation before committing troop moves.
- Persisted War Room battle history and favorite targets, added copy/clear history controls, and connected successful native live simulations to the history log.
- Added Command Center and total-defense formation goals to War Room native candidate ranking.
- Completed Scanner maximum-level and distance controls and added tab-separated result export for chat, mail, or spreadsheet use.
- Expanded region target tooltips with CP-and-repair-constrained attack capacity, loot totals and per-run projections, and clearly labeled nearby-Forgotten wave counts and level distribution.

### Added

- Added the configurable Context Actions module for native base, camp, and outpost menus.
- Added Base Intelligence with owned-base statistics, composition, resources, repairs, loot, direct access, status stickers, online-state colors, and enriched region information.

### Removed

- Removed the developer-only Sample module now that production modules provide lifecycle examples.

## [0.4.0] - 2026-07-19

### Release summary

v0.4.0 establishes the suite's working modular foundation. The core runtime, game-integration layer, Qooxdoo-native UI services, diagnostics, module discovery, and module lifecycle are in place and operating together. Changes after this release are expected to be incremental refinements on the path to v1.0.0.

### Added

- Full module lifecycle: registration, initialization, loading, enabling, disabling, unloading, and destruction.
- Manifest normalization and validation.
- Dependency ordering with missing-dependency and cycle detection.
- Module-scoped permissions, settings, logging, events, and subscription cleanup.
- Automatic module discovery and generated module catalog during builds.
- Native Qooxdoo Module Manager with runtime enable and disable controls.
- Native Module Manager entry in the game's top navigation.
- Qooxdoo readiness synchronization before application startup.
- Shared native Qooxdoo windows, dialogs, notifications, controls, context menus, toolbar components, and top-bar integration.
- Reference Sample module.
- Automated coverage for module lifecycle, permissions, settings, dependencies, window content, delayed top-bar discovery, and UI readiness.
- v0.4.0 documentation and release review.

### Changed

- Migrated shared UI infrastructure away from feature-level DOM widgets to the game's Qooxdoo UI system.
- Moved top-bar behavior into core infrastructure.
- Centralized window creation, lifecycle, cleanup, resizing, movement, and persistence.
- Moved Suite Status access into Module Manager.
- Removed redundant Suite Status entries from the top bar and Launcher.
- Stopped Launcher from opening automatically.
- Unified persisted module enabled states with startup settings.
- Reworked bootstrap so discovered modules start only after Qooxdoo is ready.
- Updated release documentation to identify v0.4.0 as the stable pre-1.0 foundation.

### Fixed

- Fatal startup failures when the extension loaded before Qooxdoo was available.
- Launcher failures caused by passing HTML elements to native Qooxdoo windows.
- Module toggles attempting to create an `enabled` property on boolean settings.
- Top-bar links failing when game navigation was created after module registration.
- Window cleanup and stale widget handling.
- Notification service access to Qooxdoo through `globalThis.qx`.
- Dialog service export mismatch during startup.

### Validation

- Chrome extension build completed successfully.
- Generated module catalog contains four modules.
- Automated result: **29 passed, 0 failed**.
- Live-game regression testing remains required before public distribution.

### Known follow-up items

- Align the explicit permission registry with the `qx` capability exposed by `ModuleContext`.
- Decide whether the now-unused `core/utils/dom.js` compatibility helper should be retained or removed.
- Continue replacing placeholder specifications with implementation-backed reference documentation.
- Complete live-game testing across supported worlds and game revisions.

## [0.3.0] - Game Integration Foundation

### Added

- Environment discovery, readiness probing, and object discovery.
- Central ClientLib and Qooxdoo managers.
- Game-version detection and compatibility rules.
- Startup synchronization and Game Integration coordination.
- Shared service and game-object registries.
- Player, city, world, alliance, base, selection, and battle services.
- Unit and formation wrappers and battle-object registry.
- Public `window.CnCTASuite.game` facade.
- Central game-state monitoring and related events.
- Duplicate-safe hooks, observers, cache invalidation, and diagnostics.
- Integration watchdog and expanded Suite Status diagnostics.
- Unit and manual integration coverage.

### Changed

- Made Game Integration initialization idempotent.
- Hardened service lookup and shutdown behavior.
- Consolidated staged integration work into the central service architecture.

## [0.2.0] - Core Foundation

### Added

- Chrome Manifest V3 entry points.
- Page-context injection bridge.
- Chrome storage bridge with localStorage fallback.
- Bootstrap, lifecycle, event bus, settings, theme, and storage services.
- Initial window, notification, modal, and game-discovery services.
- Launcher and Suite Status modules.
- Build tooling for an unpacked Chrome extension.

## [0.1.0]

### Added

- Repository foundation.

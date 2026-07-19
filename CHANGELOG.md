# Changelog

Notable changes to CnC-TA-Suite are recorded here. The project uses semantic versioning; development-part labels describe milestones and are not releases by themselves.

## [0.4.0] - 2026-07-19

### Added

- Full module lifecycle with manifest validation, registration, loading, enabling, disabling, unloading, and destruction.
- Dependency ordering with missing-dependency and circular-dependency detection.
- Module-scoped permissions, settings, logging, events, and automatic event-subscription cleanup.
- Automatic module discovery and generated module catalog during extension builds.
- Native Qooxdoo Module Manager for viewing, opening, enabling, and disabling installed modules.
- Native Module Manager entry in the game's top navigation bar with delayed attachment while the game UI initializes.
- Qooxdoo readiness synchronization before suite services start.
- Reference Sample module and automated module-loading integration coverage.
- Unit coverage for the module runtime, Qooxdoo window content, delayed top-bar discovery, and game-UI readiness.

### Changed

- Migrated shared windows, notifications, dialogs, controls, menus, toolbar components, and status views to the game's Qooxdoo UI system.
- Updated suite windows to use readable white foreground text with the native game theme.
- Moved Suite Status access into Module Manager and removed its redundant top-bar and Launcher entries.
- Stopped Launcher from opening automatically; it remains available on demand through Module Manager.
- Unified persisted module enabled states with the boolean settings format used during startup.
- Reworked bootstrap to wait for the Qooxdoo application and start automatically discovered modules.

### Fixed

- Fatal startup failures when the extension loaded before Qooxdoo was available.
- Launcher failures caused by passing HTML elements to the Qooxdoo window manager.
- Module toggles attempting to create an `enabled` property on boolean settings.
- Top-bar links failing to appear when navigation was created after module registration.

## [0.3.0] - Release candidate

Live-game verification remains mandatory before 0.3.0 is tagged.

### Added

- Environment discovery, readiness probing, and general object discovery.
- Central ClientLib and qooxdoo managers.
- Game-version detection and compatibility rules.
- Startup synchronization and a central Game Integration coordinator.
- Shared service and game-object registries.
- Player, city, world, alliance, base, selection, and battle services.
- Unit and formation model wrappers and a battle-object registry.
- Public `window.CnCTASuite.game` facade.
- Central game-state monitor with player, city, world, alliance, selection, and battle events.
- Duplicate-safe hooks, managed observer lifecycles, and cache invalidation.
- Event-bus throughput, listener, history, and failure diagnostics.
- Cache hit, miss, set, invalidation, and size metrics.
- Central diagnostics service and public diagnostics facade.
- Integration watchdog for repeated ClientLib or MainData loss.
- State-monitor tick and error diagnostics.
- Expanded Suite Status diagnostics.
- Unit tests for compatibility, registries, battle models, caching, and event diagnostics.
- Integration audit and Part 5 validation documentation.

### Changed

- Made Game Integration initialization idempotent.
- Hardened service lookup and shutdown handling.
- Reworked the shared cache and the player, city, world, alliance, base, selection, and battle APIs as the integration parts were combined.
- Replaced staged patch instructions with direct service registration and integrated implementations.

## [0.2.0] - Core Foundation

### Added

- Manifest V3 Chrome extension entry points.
- Page-context injection bridge.
- Chrome storage bridge with a localStorage fallback.
- Bootstrap and lifecycle services.
- Event bus.
- Settings validation and persistence.
- Theme service.
- Window manager with dragging, resizing, and position persistence.
- Notification and modal services.
- Initial game-integration discovery layer.
- Launcher and Suite Status modules.
- Build script for producing an unpacked Chrome extension directory.

## [0.1.0]

### Added

- Repository foundation.

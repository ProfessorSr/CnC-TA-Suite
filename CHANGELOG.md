# Changelog

Notable changes to CnC-TA-Suite are recorded here. The project uses semantic versioning; development-part labels describe milestones and are not releases by themselves.

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

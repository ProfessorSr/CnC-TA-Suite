# Changelog

Notable changes to CnC-TA-Suite are recorded here. The project follows semantic versioning.

## [1.0.0] - 2026-07-20

- Advanced the independently versioned War Room module to v0.5.0 as the preparation baseline for its next major update.
- Released War Room module v0.4.0 with complete cross-category combat statistics, improved native report/replay handler discovery, resolved Army Analyzer range/speed data, and dormant-window performance optimization.
- Corrected War Room combat-report folder semantics, added Command Center base selection and preferred-target/estimated-1v1 Army Analyzer columns, prevented invalid range/speed values from rendering as `NaN`, and connected report handoff directly to the native `ReportsOverlay` singleton.
- Stabilized category-isolated Raid Report caches and counts, corrected compact-result victory/loot normalization, deduplicated Army Analyzer bases, added per-resource/coordinate/CP Raid Report columns, and replaced the nonfunctional native-report button with per-row visual replay actions.
- Made Combat Statistics atomic and base-selectable, transposed metrics into rows, corrected ClientLib dictionary precedence and city-instance deduplication for Army Analyzer, and routed report replay through the native Raid Report's separate Replay control when summary data lacks a battle payload.
- Released War Room module v0.3.0 with the compact native attack layout, row/column formation controls, corrected visibility grouping and repaint behavior, and native persistent single-unit disable mode.
- Released War Room module v0.2.0 with live native-formation synchronization, automatically cached manual-layout simulations, the movable Formation Controls palette, and restored in-window formation controls. Suite Core remains v1.0.0 and other modules retain their independent versions.
- Reshaped the War Room Formation Controls palette into a narrow 3-column by 6-row pad matching the established control layout, eliminating clipped utility icons while retaining the new native-themed button treatment.
- Corrected formation visibility grouping to use `ClientLib.Base.EUnitMovementType` (Feet, Wheel/Track, and Air/Air2), forced an immediate native formation repaint after enabled-state changes, and expanded the palette frame so its icon grid remains fully inside the window.
- Fixed single-troop disable mode by delegating the Suite icon to the native persistent `ArmySetupAttackBar` `btn_disable` control; map-selection matching is now only a compatibility fallback.
- Added balanced right/bottom inset space to the compact Formation palette and shortened its caption so the 3×6 icon grid sits visually centered inside the native window frame.
- Compacted native attack setup by removing its redundant horizontal extended-control sections, relocating row mirror/shift controls beside the four troop rows, and placing hover-activated vertical controls above all nine columns; original widgets are retained and restored when War Room is disabled.
- Retained the game's original per-column attack controls instead of replacing them, preventing native button refreshes from reverting Suite-owned widgets while preserving the compact layout and relocated row-side controls.
- Reworked War Room Report Summary to request native offense report counts, headers, and full report records through the game Reports manager; Refresh now reloads native history and delivered records retain their native report/replay handoff.
- Expanded Report Summary with native Offense/Defense/Forgotten/Others filtering and aggregate CP, loot-efficiency, and repair metrics; expanded Army Analyzer with composition/readiness and per-unit combat/repair data; converted Combat Statistics into target-level attack-efficiency analysis; removed duplicate formation movement from Battle Simulator; and added direct native report-combat replay plus Reports-window fallback.
- Established independent versioning: Suite Core and API/Hub contracts remain v1.0.0 while feature modules begin at v0.1.0 and may release independently from both the framework and one another.
- Expanded declarative custom content to fill its page and made the Command Manual table of contents and article viewport use the full available window height.
- Added native offensive-unit repair resource costs and infantry/vehicle/air repair durations to Attack Planner and Battle Simulator results.
- Corrected attack-capacity estimates to distinguish fully repairable hits from one additional launchable hit whose damage may remain unrepaired.
- Rebuilt War Room Report Summary as an attack-by-attack native report list with in-window details and native report/replay handoff.
- Replaced the combined CY/DF/CC cached-result line with separate labeled objective-health percentages.
- Replaced the prototype red 3×3 attack palette with a movable, faction-themed native Formation Controls window using the same 31px/23px button geometry as Suite navigation. It adds group and single-troop hide/show controls, War Room access, starting-layout reset, formation save, native simulation, movement, mirrors, and row swaps; its position persists between sessions.
- Restored the full reversible movement, mirror, row-swap, and manual-simulation toolbar inside War Room Attack Planner alongside the live external controls.
- Fixed War Room live synchronization after manual in-game troop movement: formation changes and Refresh now redraw the planner from native troop coordinates and enabled state before queuing a new simulation, rather than replacing the live layout with a newly generated recommendation.
- Made every completed distinct manual formation simulation appear immediately as a separately labeled cached result in Battle Simulator, even when the native formation changes again before post-simulation stability validation.
- Reduced the War Room default width by 20% (1040px to 832px) while retaining manual resizing.

### Release summary

CnC-TA-Suite v1.0.0 is the first feature-complete regular-user release candidate. It combines 23 independently managed modules with a versioned Game Data Hub, Client API compatibility adapters, native Qooxdoo presentation, diagnostics, performance budgets, declarative module definitions, and an interactive Command Manual. State-changing operations remain explicit and confirmed; prohibited unattended automation is excluded by policy.

### Platform and maintainability

- Added versioned module and Hub API contracts, compatibility fixtures, runtime fingerprints, structured diagnostics, redacted exports, and an EA client-update workflow.
- Added data-driven module definitions for manifests, windows, tabs, controls, settings, providers, and actions; specialized modules retain custom renderers behind the same contract.
- Added performance instrumentation and throttled budget warnings for game-state capture and event dispatch.
- Added complete Command Manual coverage for every registered module, contextual `? Help`, search, quick starts, troubleshooting, glossary, shortcuts, and release guidance.
- Expanded automated validation to 92 tests and 23 generated modules.

### Feature suite

- Added War Room, Scanner, Base Intelligence, Next MCV, Repair & Collection, Upgrade Manager, Resource Transfer, Base Layout Optimizer, Alliance Intelligence, Context Actions, Combat Reports, Tactical Map, Support Manager, Communications, External Analysis, Hotkeys, UI Tools, API Inspector, and supporting dashboard/status modules.
- Added native right-side and base-view launch controls that respect module enabled state and toggle open windows.
- Added conservative attack-capacity and loot intelligence, native simulation/replay workflows, formation previews and presets, quick upgrades/transfers, contextual map actions, and current-base planning tools.

### Documentation and release cleanup

- Aligned `VERSION`, `PART`, Chrome manifest, runtime fallbacks, cache tokens, README, roadmap, release process, project tree, and maintained reference statuses to v1.0.0.
- Replaced repository policy placeholders with contribution, conduct, security, and source-rights statements.
- Replaced the obsolete repository workflow with CI that validates current files, JSON manifests, release-version alignment, all automated tests, the generated catalog, and the Chrome build.
- Renamed the former instruction-booklet source to the canonical `command-manual` module path and removed its obsolete terminology.
- Removed four unreferenced pre-integration helpers (`dom`, inline style injector, legacy game scanner, and legacy version probe) superseded by native UI and compatibility services.
- Removed the developer-only Sample module and kept historical v0.3.0/v0.4.0 validation records clearly separated from current guidance.

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

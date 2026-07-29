# Framework Goals and Boundaries

## Primary goal

The Framework exists to provide a stable, reusable platform for CnC-TA Suite modules.

Its success is not measured by how many gameplay features are placed inside the core. Its success is measured by how safely and consistently separate modules can use it.

## Design goals

### 1. Stability before features

The Framework should continue operating when:

- No optional modules are installed.
- A module is disabled.
- A module has missing dependencies.
- A module requests an unknown permission.
- A module uses an incompatible API version.
- A module throws an error during part of its lifecycle.
- Browser extension storage becomes unavailable and the fallback is needed.
- A supported game build exposes objects differently than another build.

A stable core makes every future feature easier to develop.

### 2. Clear separation

Framework code and module code serve different purposes.

Framework code owns:

- Bootstrap and startup.
- Game-readiness detection.
- Shared services.
- Module discovery.
- Module lifecycle.
- Compatibility rules.
- Permissions.
- Storage and settings.
- Common UI infrastructure.
- Diagnostics and recovery.

Module code owns:

- The feature.
- Feature-specific calculations.
- Feature-specific user actions.
- The module's own version.
- The module's own documentation.
- The module's own settings and assets.

### 3. Native game appearance

The Framework uses the game's Qooxdoo environment for its windows and controls.

The goal is for Suite windows to behave like part of the game rather than like unrelated web-page overlays. Shared window handling gives modules the same basic behavior, including position memory, resizing, compact modes, pinning, locking, and cleanup.

### 4. Controlled access

Modules do not automatically receive every Framework capability.

A module declares permissions in its manifest. The Framework then creates a scoped module context. Services that are not allowed are not exposed through that context.

Current permission names include:

```text
events
game
storage
settings
theme
windows
notifications
ui
hooks
observers
modules
diagnostics
```

This is not a complete browser security sandbox. Module code still runs inside the extension environment. The permission layer is an application-level contract that makes access intentional, visible, and testable.

### 5. Compatibility through contracts

The Framework publishes contracts rather than asking modules to depend on random internal files.

Two important contracts are:

- **Suite API** — the services and module behavior provided by the Framework.
- **Hub API** — the shape of normalized game-data snapshots.

A module declares which API versions it expects. The Framework checks those versions before accepting the module.

### 6. Easy diagnosis

The Framework includes centralized logs, health checks, performance information, lifecycle state, event-bus statistics, compatibility information, and redacted support bundles.

Troubleshooting should begin with shared diagnostics instead of forcing every module author to invent a separate logging system.

## Boundaries

### Framework documentation

These documents explain the Framework and its required control modules.

They do not document the detailed operation of feature modules. That information belongs in each feature module's folder.

### Feature behavior

The Framework can expose game services and action pathways, but the feature module remains responsible for deciding how and when to use them.

For example, the Framework may provide:

- Current base information.
- Selected target information.
- A battle service.
- A window service.
- A notification service.

The attack-planning module decides how to turn those services into an attack-planning feature.

### User actions and automation

The Framework does not automatically make every available game action safe or appropriate. A module must define clear boundaries between:

- reading information;
- calculating suggestions;
- previewing changes;
- applying changes;
- performing a final game action.

User confirmation and compliance decisions belong to the feature design and its documentation.

## What should remain outside the Framework?

A good test is:

> Would this code still be useful if the feature module did not exist?

If the answer is no, the code probably belongs in the module.

Examples that normally belong outside the core:

- Attack ranking formulas.
- Scanner filter rules.
- Upgrade priorities.
- Resource-transfer strategies.
- Module-specific tables and forms.
- Module-specific saved data.
- Module-specific keyboard shortcuts.

Examples that normally belong in the Framework:

- Opening a window.
- Saving a setting.
- Emitting an event.
- Reading a normalized player snapshot.
- Tracking a listener for cleanup.
- Checking a module's declared API version.
- Reporting a lifecycle error.

## A healthy framework stays boring

A stable Framework may change less often than its modules. That is a strength.

When the core is predictable, module development becomes faster and safer. The Framework should not chase every feature request. It should make feature modules easier to build.

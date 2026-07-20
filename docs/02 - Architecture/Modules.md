# Modules

> Status: Implemented for v0.4.0

Modules are managed by `ModuleManager` and discovered automatically during builds.

## Lifecycle

```text
register → initialize → load → enable
                           ↓
destroy ← unload ← disable
```

Each lifecycle method is optional and may be asynchronous.

## Manifest modules

A manifest declares identity, API version, dependencies, requested permissions, and settings. Dependencies are enabled before dependents. Missing dependencies and cycles prevent startup.

## ModuleContext

Modules receive a context containing:

- identity and logger;
- tracked events;
- module-scoped settings;
- permission helpers;
- granted framework capabilities.

Capabilities may include game, the normalized game-data Hub, storage, settings, theme, windows, notifications, UI, hooks, observers, modules, diagnostics, and Qooxdoo access. Hub access follows the `game` permission.

## Cleanup

Subscriptions created through `context.events` are cleared automatically when the module is disabled. Modules remain responsible for cleaning up any timers, native listeners, or resources they create outside tracked services.

## Compatibility note

The v0.4.0 review found that `ModuleContext` recognizes a `qx` capability while the explicit permission registry does not yet list it. Until aligned, manifest-based modules should not request `qx` directly.

# Modules

Conventional module windows should be defined through the declarative framework documented in [Declarative Modules](Declarative%20Modules.md). Specialized modules may retain custom Qooxdoo renderers while using versioned manifests, Hub providers, standard lifecycle methods, and shared actions.

> Status: Implemented for v1.0.0

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

Qooxdoo is supplied through framework-owned UI/window services rather than an explicit module permission. Custom renderers may construct native controls, but must keep game-data reads behind the scoped game facade and Hub.

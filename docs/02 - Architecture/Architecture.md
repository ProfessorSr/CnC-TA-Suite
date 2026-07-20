# Architecture

> Status: Implemented for v1.0.0

CnC-TA-Suite is a page-context modular application delivered by a Chrome Manifest V3 extension.

## Startup flow

```text
Chrome content bridge
  → page-context suite entry
  → game/Qooxdoo readiness
  → storage and settings
  → theme and UI services
  → game integration
  → module registration
  → enabled module startup
```

## Main layers

1. **Browser bridge** injects suite resources into the game page.
2. **Bootstrap** waits for the required game environment and constructs services.
3. **Core services** provide events, storage, settings, diagnostics, UI, windows, hooks, and observers.
4. **Game Integration** wraps ClientLib and publishes stable suite-facing services.
5. **Module runtime** validates, orders, starts, stops, and isolates modules.
6. **Modules** implement user-facing features through granted context capabilities.

## Design rules

- Core services do not depend on feature modules.
- Modules access framework capabilities through `ModuleContext`.
- Shared events use the central EventBus.
- Native game UI uses Qooxdoo rather than parallel DOM widgets.
- Generated build output is not hand-edited.
- Cleanup is part of every listener, timer, window, hook, and observer lifecycle.

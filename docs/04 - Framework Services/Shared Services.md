# Shared Services

## What is a shared service?

A shared service is a tool created once by the Framework and made available to modules through their scoped context.

Instead of every module building its own logger, storage wrapper, window manager, or game-object search code, modules use the same service.

This produces consistent behavior and gives the Framework one place to fix common problems.

## Main services

### Logger

Creates structured messages for startup, modules, game integration, diagnostics, and errors.

Each module receives a child logger labeled with its module ID. That makes it easier to identify which feature produced a message.

The root logger can keep a snapshot used by diagnostics.

### Event bus

Publishes and delivers Framework events.

It reduces direct dependencies and tracks statistics such as successful and failed deliveries.

Modules should normally use the tracked `context.events` wrapper so their subscriptions can be cleaned up.

### Storage

Provides asynchronous `get`, `set`, and `remove` operations.

The primary implementation uses Chrome extension storage. A local-storage fallback can be used when primary storage becomes unavailable.

### Settings

Provides validated Framework settings and module-scoped settings.

Settings are stored separately from arbitrary feature data. A module's manifest may declare a settings schema with default values and supported types.

### Theme

Provides shared colors, fonts, spacing, and icons.

Modules should use shared values instead of inventing a slightly different visual style for every window.

### Windows

Creates and tracks native-style Qooxdoo windows.

The service handles repeated concerns such as:

- Singleton behavior.
- Saved position.
- Saved size.
- Resizing.
- Compact mode.
- Pinning.
- Locking.
- Auto-hide behavior.
- Help links.
- Cleanup.

### Notifications

Provides a consistent way to show user-facing status and error information.

A module must request notification permission before the service is exposed in its context.

### UI

Provides shared controls, dialogs, toolbars, and declarative rendering helpers.

Declarative modules can describe windows, tabs, controls, toolbar actions, providers, and custom content through a validated definition.

### Hooks and observers

Provide managed ways to react to changing game or UI behavior.

These are powerful capabilities. Modules should remove hooks and observers during cleanup.

### Game services

Provide normalized access to player, base, city, world, alliance, battle, selection, and other game information.

The public Game API and Game Data Hub form the preferred boundary for feature modules.

### Diagnostics

Provides Framework snapshots, health checks, lifecycle state, event statistics, logs, compatibility information, and redacted support data.

### Modules

Provides controlled access to registered modules and module actions.

This is used by control modules such as Module Manager and Suite Dashboard.

## How a module receives services

The module declares permissions:

```json
{
  "permissions": ["game", "windows", "storage"]
}
```

The Framework creates a `ModuleContext`.

Allowed services are present:

```text
context.game
context.windows
context.storage
```

Services not granted by the manifest are `undefined` through the scoped context.

The module can also check permissions:

```text
context.permissions.allows("windows")
context.permissions.require("game")
context.permissions.list()
```

## Why this is better than globals

A global variable can be used by anything, changed by anything, and may disappear without warning.

A shared service:

- Has an owner.
- Has a defined purpose.
- Can validate input.
- Can log failures.
- Can be mocked in tests.
- Can be replaced behind the same contract.
- Can be exposed only to modules that asked for it.

## What should not become a shared service?

A service should not be created merely because two files use the same helper.

Before adding a service, ask:

- Is this useful to unrelated modules?
- Does it represent stable Framework behavior?
- Does it need lifecycle management?
- Does it need centralized diagnostics?
- Would modules benefit from a common contract?
- Can it stay independent from one feature?

If the service only makes sense for one module, keep it in that module.

## Service naming

Use names that describe the capability, not the first module that happened to need it.

Good:

```text
battle
storage
selection
windows
diagnostics
```

Poor:

```text
warRoomHelper
scannerStorageForEverything
myModuleWindowThing
```

Shared services should remain understandable after the original feature is gone.

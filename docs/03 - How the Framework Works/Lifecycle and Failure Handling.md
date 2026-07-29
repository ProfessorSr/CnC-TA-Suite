# Lifecycle and Failure Handling

## Why lifecycle rules exist

A module does more than appear on screen.

It may:

- Create listeners.
- Start timers.
- Open windows.
- Register hooks.
- Store references.
- Create caches.
- Watch game state.
- Add toolbar controls.

If those resources are not cleaned up when the module is disabled or unloaded, the old code may continue running. Re-enabling it can then create duplicate listeners, duplicate timers, or duplicate windows.

The lifecycle gives every module predictable places to start and stop its work.

## Lifecycle order

The base module contract defines:

```text
initialize
    ↓
load
    ↓
enable
    ↓
disable
    ↓
unload
    ↓
destroy
```

### `initialize()`

Used for one-time setup before loading.

Examples:

- Validate a feature-specific configuration.
- Prepare internal data structures.
- Register internal helpers.

### `load()`

Used when the module becomes part of the running system.

Examples:

- Load saved feature data.
- Prepare non-active resources.
- Connect required dependencies.

### `enable()`

Used when the module should actively operate.

Examples:

- Subscribe to Framework events.
- Add visible controls.
- Start refresh timers.
- Allow the module window to open.

### `disable()`

Used to stop active behavior while keeping the module available.

Examples:

- Remove shortcuts.
- Stop timers.
- Close or hide windows.
- Clear active listeners.
- Stop reacting to game-state changes.

### `unload()`

Used when the Framework removes the loaded module resources.

Examples:

- Release caches.
- Unregister feature services.
- Remove stored runtime references.

### `destroy()`

Used for final cleanup.

A module should not expect to return to an active state after final destruction unless a fresh instance is created.

## Module states

The Module Manager tracks states such as:

| State | Meaning |
|---|---|
| `registered` | The module passed registration and exists in the registry. |
| `loaded` | Loading completed. |
| `enabled` | Active behavior is allowed. |
| `disabled` | Installed but inactive. |
| `unloaded` | Runtime resources were removed. |
| `error` | A lifecycle or validation failure occurred. |

The exact state helps diagnostics report where a failure happened.

## Scoped event cleanup

The `ModuleContext` provides tracked events through `context.events`.

When the context is cleaned up, its tracked subscriptions can be removed together. This is safer than leaving every module author to remember every raw event-bus subscription manually.

## Window cleanup

The shared Window Manager tracks windows by ID.

Modules generally use singleton windows. If the same window is already open, the Framework focuses it instead of creating a duplicate.

When a module is disabled or unloaded, it should close its windows and release references.

## Error isolation

The goal is for one module failure to remain one module failure.

The Framework uses validation, state tracking, logs, and lifecycle boundaries so it can:

- Reject an invalid manifest.
- Reject an incompatible module.
- Report a missing dependency.
- Mark a module as errored.
- Continue running other modules where possible.

This does not mean every possible JavaScript error can be isolated. All modules still share the same page environment. Careless global changes can damage the game or Framework.

The architecture reduces risk; it does not make unsafe code harmless.

## Storage fallback

Framework storage prefers Chrome extension storage.

If that primary storage fails during the session, the Framework can fall back to local storage and logs a warning.

This allows the session to continue, but the two storage systems are not identical. A fallback should be treated as a condition worth investigating.

## Integration watchdog and monitoring

Game integration can change while the page is open. The player may switch bases, the game may replace objects, or a deployed build may behave differently.

Monitoring and watchdog services observe important conditions and can report status through diagnostics.

## Good module cleanup checklist

When a module is disabled, unloaded, or destroyed, verify that it:

- Stops all repeating timers.
- Removes all event subscriptions.
- Removes game hooks and observers.
- Closes module windows.
- Removes toolbar or context controls.
- Releases cached game-object references.
- Cancels pending work when possible.
- Does not continue modifying state.
- Can be enabled again without duplication.

## A simple test

Enable the module, use it, disable it, and watch the console and Suite Status.

Then enable it again.

If the second enable produces duplicate windows, duplicate notifications, or duplicate event handling, the lifecycle cleanup is incomplete.

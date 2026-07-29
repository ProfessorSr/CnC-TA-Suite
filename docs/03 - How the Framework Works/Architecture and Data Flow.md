# Architecture and Data Flow

## Layered design

The Framework is organized in layers.

```text
┌──────────────────────────────────────────────┐
│ Module windows and feature presentation      │
├──────────────────────────────────────────────┤
│ Module calculations and feature logic        │
├──────────────────────────────────────────────┤
│ Scoped Module Context and permissions         │
├──────────────────────────────────────────────┤
│ Shared Framework services and Game Data Hub   │
├──────────────────────────────────────────────┤
│ Compatibility adapters and ClientLib wrappers │
├──────────────────────────────────────────────┤
│ Command & Conquer: Tiberium Alliances client  │
└──────────────────────────────────────────────┘
```

Each layer has a different job.

## Game client layer

The game client is the original application.

It contains ClientLib, Qooxdoo widgets, player information, base data, world data, battle systems, and native commands.

Its internal names may be obfuscated or changed by an update. Modules should not assume those names are stable.

## Compatibility and wrapper layer

Compatibility code absorbs differences between game builds.

Important pieces include:

- Client API adapter
- Client build registry
- Compatibility detector
- Compatibility rules
- Version manager
- Environment and object discovery
- Readiness probes
- Integration watchdog

This layer translates the current game environment into forms the Framework understands.

## Shared game-service layer

Game services provide organized access to game information.

Examples include player, city, base, world, alliance, selection, and battle services.

A service may use caching and registries so the rest of the Framework does not repeatedly search for the same game objects.

## Game Data Hub

The Hub publishes normalized snapshots.

The current Hub contract uses schema version `1.0.0`. A valid snapshot must include:

- `schemaVersion`
- a Boolean `ready` value;
- a numeric `generatedAt` time;
- a player record.

Feature modules can calculate from a stable snapshot instead of mixing ClientLib calls directly into tables and buttons.

## Module-context layer

Every module receives a `ModuleContext`.

The context contains:

- Basic module identity.
- A child logger labeled with the module ID.
- The shared event bus.
- A permission helper.
- A tracked event helper.
- Scoped module settings.
- Only the capabilities allowed by the module manifest.

This creates a consistent entry point for module code.

## Module-logic layer

This layer contains the actual feature.

A module might:

- Interpret a Hub snapshot.
- Calculate a recommendation.
- Filter a list.
- Save feature-specific data.
- Request a Framework window.
- Ask the user to confirm an action.
- Use a shared game service.

The Framework does not decide the feature's rules.

## Presentation layer

The user interface is built with the game's Qooxdoo environment.

Modules may use:

- Shared UI controls.
- Dialogs.
- Toolbar helpers.
- Context menus.
- Declarative module definitions.
- Custom Qooxdoo windows.
- Shared theme values.

The presentation layer should display data and collect user choices. It should not become the only place where important calculations exist.

## Event-driven communication

The event bus allows one part of the Framework to announce an event without directly calling every interested module.

Example:

```text
Selected base changes
        ↓
Game-state monitor emits an event
        ↓
Event bus delivers it
        ↓
Interested modules refresh
```

A module that does not care about the event does nothing.

## Why direct cross-module calls are discouraged

Suppose Module A imports Module B's internal window class.

Now Module A depends on:

- Module B being installed.
- That file keeping the same path.
- That class keeping the same name.
- That private method keeping the same behavior.

A small Module B update could break Module A.

Dependencies should be declared and communication should use documented contracts or shared services whenever possible.

## Read flow and action flow

Reading data and changing game state are different paths.

### Read flow

```text
Game → Adapter/Service → Hub snapshot → Module calculation → Window
```

### Action flow

```text
User choice → Module validation → Optional confirmation
            → Shared/native action service → Game
            → Result event/status → Window refresh
```

Keeping those flows separate makes it easier to prevent an analysis result from silently becoming an action.

## Architectural rule of thumb

A module should be replaceable without rewriting the Framework.

The Framework should be upgradable without rewriting every module, as long as the public API contract remains compatible.

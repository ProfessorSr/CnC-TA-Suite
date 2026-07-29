# Game Integration, Hub, and Compatibility

## The problem with game integration

The game client was not designed as a stable public platform for this Framework.

Its internal objects may be:

- Obfuscated.
- Renamed.
- Moved.
- Created later in startup.
- Different between deployed builds.
- Replaced while the page is running.

Feature modules should not each solve those problems independently.

## Environment discovery

The discovery layer searches for usable game objects and records what is available.

It does not assume that one hard-coded path will always work.

The readiness probe determines when enough of the environment exists for Framework startup to continue.

## Client API adapter

The client adapter provides a compatibility boundary.

When two game builds expose similar information differently, the adapter can normalize those differences behind one Framework method.

This is more maintainable than placing build-specific conditions inside every module.

## Client build registry

The build registry stores information about recognized game builds and supported behavior.

A build may be:

- Known and supported.
- Known with limitations.
- Unknown but compatible through runtime discovery.
- Incompatible with required Framework assumptions.

## Compatibility detector

The compatibility detector combines the current environment, build information, and compatibility rules.

Suite Status can then show a meaningful result instead of merely saying “ClientLib exists.”

## Version manager

The version manager helps compare versions and identify whether the Framework's expected contracts match the current environment.

Framework API compatibility and game-build compatibility are related but different:

- Framework API compatibility concerns modules.
- Game compatibility concerns the live game client.

## Game services

The Framework organizes discovered information into focused services.

Examples include:

- Player service.
- Base service.
- City service.
- World service.
- Alliance service.
- Selection manager.
- Battle service.
- Object and service registries.
- Cache manager.
- Game-state monitor.

Modules should depend on the public behavior of these services, not on their private caches or discovery tricks.

## Game Data Hub

The Hub provides normalized, read-oriented snapshots.

The current Hub API version is:

```text
1.0.0
```

A basic valid snapshot requires:

```text
schemaVersion = "1.0.0"
ready = true or false
generatedAt = numeric timestamp
player = object
```

Additional records may be included for bases, world information, selections, and other shared data.

## Snapshot meaning

A snapshot is a picture of the known game state at a specific time.

It is not a permanent truth.

Modules should pay attention to:

- `ready`
- `generatedAt`
- missing records;
- stale records;
- compatibility status.

A module should not use yesterday's cached base data as though it were live merely because the object shape is valid.

## Why the Hub has its own API version

The Suite API describes Framework services and module behavior.

The Hub API describes the data contract of Hub snapshots.

A Framework release could theoretically change Hub data without changing every other module service. Keeping the versions explicit makes the dependency visible.

A module manifest may declare both:

```json
{
  "apiVersion": "1.0.0",
  "hubApiVersion": "1.0.0"
}
```

## Integration watchdog

The watchdog checks whether critical integration pieces remain available after startup.

This matters because a long-running game session may change state or replace objects.

The watchdog can report degraded health through diagnostics rather than waiting for a feature module to fail mysteriously.

## Cache use

Caching reduces repeated expensive discovery and object access.

A cache entry still needs rules for:

- Creation.
- Refresh.
- Invalidation.
- Expiration.
- Diagnostics.

Modules should not assume every cached record is current.

## Safe integration guidance

Feature modules should:

- Use the Hub for normalized read data.
- Use shared game services for supported operations.
- Avoid direct ClientLib access in presentation code.
- Treat unknown builds carefully.
- Check readiness before using data.
- Handle missing methods.
- Log enough context to diagnose failures.
- Keep analysis separate from confirmed actions.

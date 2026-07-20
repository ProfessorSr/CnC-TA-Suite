# Game Integration Reference

> Status: Implemented for v0.4.0

Game Integration discovers `window.ClientLib` and the Qooxdoo application, waits for MainData/player/cities/world readiness, detects version and compatibility, then registers services and objects. Services include ClientLib, Qooxdoo manager, object discovery, cache, player, city, world, alliance, base, selection, battle, battle objects, version, and compatibility. Objects include MainData, server, player, cities, world, and application.

`context.hub.snapshot()` is the module-facing aggregate for normalized game data. It publishes player resources and next-MCV fields, city, world, alliance, selection, and battle state. Any ClientLib compatibility probes needed to populate the Hub remain inside core; feature modules must not perform them.

The central state monitor publishes changes and invalidates caches. The watchdog reports repeated loss of required runtime objects and emits connection lost/restored events. `getStatus()` is the diagnostic source of truth. Feature modules must consume `context.game` or the public facade rather than repeat discovery or bind directly to unstable ClientLib names.

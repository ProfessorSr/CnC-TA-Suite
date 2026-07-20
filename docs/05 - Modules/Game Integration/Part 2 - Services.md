# Game Integration — Part 2: Services

> Status: Implemented; current for v0.4.0

Part 2 registers shared cache-backed services so modules do not call ClientLib independently.

- Player: current normalized player, raw access, refresh.
- City: current city, all cities, lookup by ID.
- World: normalized world snapshot and coordinate distance.
- Alliance: current alliance snapshot.
- Base: selected base and level.
- Cache: TTL reads, invalidation, clearing, and metrics.

Services use compatibility fallbacks for changing game methods, return `null` or empty values when state is absent, and are available through `context.game` and `window.CnCTASuite.game`. Game-state events invalidate affected cache entries. Raw ClientLib objects are diagnostic escape hatches, not stable persistence formats.

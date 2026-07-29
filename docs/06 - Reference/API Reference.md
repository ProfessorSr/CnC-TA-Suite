# API Reference

> Status: Implemented for v1.0.0

`window.CnCTASuite` is frozen and exposes `version`, `context`, `game`, and `diagnostics`. Call game methods after `CnCTASuite.game.ready` is true.

## Game facade

- `player.current(options?)`, `player.raw()`, `player.refresh()`
- `city.current()`, `city.all()`, `city.find(id)`
- `world.info()`, `world.distance(a, b)`
- `alliance.current()`
- `base.selected()`, `base.level()`
- `battle.isActive()`, `battle.state()`, `battle.target()`, `battle.attacker()`, `battle.defender()`
- `selection.current()`, `selection.type()`, `selection.clear()`, `selection.snapshot()`
- `objects.get(id)`, `objects.register(id, object, metadata?)`, `objects.remove(id)`, `objects.snapshot()`
- `cache.invalidate(key)`, `cache.clear()`, `cache.snapshot()`

Methods return service snapshots, wrapped models, booleans, or `null` when the corresponding game state is absent. Unknown services and invalid required identifiers throw. `diagnostics.snapshot()` returns integration/cache/event/hook/observer state; `diagnostics.health()` returns summarized checks. `context` is available for diagnostics and module development but is less stable than the frozen public facade.

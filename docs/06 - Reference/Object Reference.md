# Object Reference

> Status: Implemented baseline for v0.4.0

Service snapshots intentionally expose stable subsets rather than promising raw ClientLib classes. Player contains identity and progression data when available; city/base identify current or selected bases and levels; world contains server/map facts and distance helpers; alliance contains current membership; selection describes selected object and type; battle contains active state, target, and attacker/defender formations.

`FormationModel` groups a side's ordered slots and wrapped units. `UnitModel` exposes discovered identity, level, position, and underlying metadata where available. Missing game state returns `null` or empty collections. Raw objects obtained through diagnostic registries are compatibility-sensitive and should not be persisted or treated as public contracts.

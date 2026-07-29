# Game Integration — Part 1: Core Discovery

## Status

Implemented; current for v1.0.0.

## Purpose

Part 1 establishes the shared integration hub responsible for discovering the game environment, validating runtime compatibility, synchronizing startup, and registering core game services and objects.

## Responsibilities

- Discover `ClientLib`.
- Discover the qooxdoo application.
- Wait until core game data services are ready.
- Detect the active game version.
- Evaluate compatibility rules.
- Register shared services.
- Register shared game objects.
- Expose a stable status report to the rest of the suite.

## Architectural Rule

Feature modules must not independently discover `ClientLib`, the qooxdoo application, or core game objects. These resources are owned by the Game Integration Layer and accessed through its registries.

## Public Access

```javascript
CnCTASuite.context.game.getStatus()
CnCTASuite.context.game.getService('clientLib')
CnCTASuite.context.game.getService('qx')
CnCTASuite.context.game.getObject('player')
CnCTASuite.context.game.getObject('world')
```

## Current acceptance

Automated discovery, readiness, version, and compatibility tests must pass. Releases also require live verification that the supported page exposes ClientLib, a Qooxdoo application, and ready MainData services before the timeout.

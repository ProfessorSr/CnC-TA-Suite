# Game Integration — Part 1: Core Discovery

## Status

Implemented for v0.3.0 development.

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

## Release Acceptance

This part is not a standalone tagged release. It becomes eligible for the v0.3.0 release only after all remaining Game Integration parts are complete and the full Release Acceptance Policy passes.

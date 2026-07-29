# Glossary

> Status: Active

- **ClientLib:** game-provided JavaScript API whose internal names may vary by build.
- **Qooxdoo / qx:** widget framework used by the game and suite UI.
- **Page context:** game JavaScript realm where injected suite modules execute.
- **Bridge:** isolated content script that injects resources and brokers Chrome storage.
- **Module:** build-discovered feature managed by `ModuleManager`.
- **Manifest:** module identity, version, dependencies, permissions, and settings schema.
- **Capability:** application service exposed to a module when permitted.
- **Service registry:** named shared game/service instances.
- **Object registry:** named discovered runtime objects.
- **Lifecycle:** register/load/enable/disable/unload/destroy progression.
- **Watchdog:** monitor that detects loss and restoration of game integration.
- **Runtime fingerprint:** compatibility evidence used when an explicit game version is unavailable.

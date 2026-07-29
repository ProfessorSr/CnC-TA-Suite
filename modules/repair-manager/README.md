# Repair & Collection Manager

Native Qooxdoo controls for automatic and manual maintenance of owned bases.

Implemented controls:

- auto-collect completed packages/building production
- auto-repair buildings using defense-first, production-first, or core-first priority
- a permanently visible settings-style quick-dock button that opens Repair & Collection Manager directly
- auto-repair offense
- auto-repair defense when the current ClientLib build exposes a defense repair mode
- manual collection, building, offense-wide, and defense actions
- native header quick-repair icons for buildings, offense, and defense; unavailable actions remain visible but disabled
- configurable automation interval
- live base, damage, collection, resource, and category repair-time status
- a capped activity log of completed repairs and collections by base

All ClientLib access is isolated in `repair-manager-hub.js`. Automatic actions are disabled by default and each action has its own setting.

The current game build does not expose reliable separate repair actions for infantry, vehicles, and aircraft. Those categories are repaired through the supported offense-wide action instead of presenting nonfunctional controls.

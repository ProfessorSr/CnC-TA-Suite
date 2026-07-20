# Base Intelligence

Base Intelligence v1.0.0 is the Suite's native Qooxdoo workspace for player, world, alliance, account, owned-base, composition, resource, repair, support, combat, and loot information.

It provides direct base access, compact and super-compact status stickers, persisted window placement and size, pin/lock controls, configurable resource ordering, and reversible additions to own/allied/enemy region information. Online-state details use color when alliance member data exposes a state.

All ClientLib access is isolated in `base-intelligence-hub.js`. UI and tooltip integrations consume normalized snapshots. Hooks restore original game methods when the module is disabled.

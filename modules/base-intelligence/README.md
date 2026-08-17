# Player Intelligence

Player Intelligence v0.6.0 is the Suite's native Qooxdoo workspace for the player, world, alliance, achievements, and every owned base. It includes per-base support assignments, detailed resource production, package collection, repairs, direct base focusing, status stickers, and region information.

The Overview player card shows the resolved GDI or NOD faction, rank, integer current/max command points, and score/next-level progress. Owned Bases covers the complete account rather than only the currently open base. Resource rows separate continuous, package, total, and alliance-bonus production; repair and collection actions remain explicit user actions.

It provides direct base access, compact and super-compact status stickers, persisted window placement and size, pin/lock controls, configurable resource ordering, and reversible additions to own/allied/enemy region information. Online-state details use color when alliance member data exposes a state.

All ClientLib access is isolated in `base-intelligence-hub.js`. UI and tooltip integrations consume normalized snapshots. Hooks restore original game methods when the module is disabled.

# Goals

> Status: Active for v0.4.0

## Product goals

- Start reliably on supported Tiberium Alliances pages.
- Present suite UI through the game's Qooxdoo theme.
- Keep feature modules isolated from browser and discovery plumbing.
- Offer documented player, city, world, alliance, base, selection, and battle APIs.
- Preserve module settings and window geometry across reloads.
- Detect compatibility failures without corrupting game state.

## Engineering goals

- Deterministic lifecycle and dependency ordering.
- Explicit capability grants and automatic tracked-event cleanup.
- Duplicate-safe hooks, observers, monitors, and caches.
- Automated tests plus live-game release acceptance.

## Non-goals

- Replacing the game client, bypassing authentication, or guaranteeing compatibility with every future game build.
- Allowing modules to silently collect personal data or bypass core safety boundaries.

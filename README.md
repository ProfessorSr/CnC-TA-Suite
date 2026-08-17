# CnC-TA-Suite

CnC-TA-Suite is a modular Chrome extension for Command & Conquer: Tiberium Alliances. It modernizes long-lived community-tool workflows behind shared game-data services and native Qooxdoo interfaces that fit the game client.

Current version: **v1.1.0**

Suite Core and the public module API are at **v1.1.0**. The backward-compatible Hub contract remains at **v1.0.0**. Individual feature modules version independently: one module can advance without changing the framework or any other module.

## Highlights

- Native Module Manager with independently enabled modules, a dashboard, dependency visibility, and a read-only API Inspector for public snapshots and redacted diagnostics.
- Shared Game Data Hub that keeps ClientLib access out of presentation and calculation code.
- War Room with target discovery, live target authority, attack planning, formation presets, CY-aware best-formation search, native simulation, replay, reports, army analysis, and combat history. Native attack setup automatically places War Room on the left and Formation Controls on the right.
- Scanner for bases, camps, outposts, player/alliance targets, exact 7T/5C, 6T/6C, and 5T/7C layouts, two-silo Tiberium-touch geometry, persistent saved layouts, and coordinate/CNCOpt export.
- Player Intelligence for player progression, achievements, every owned base, production, packages, repairs, and support assignments; plus Upgrade Manager, Resource Transfer, Layout Optimizer, Next MCV, Alliance Intelligence, Context Actions, Combat Reports, Tactical Map, Support Manager, Communications, and other focused tools.
- Private and alliance-shared custom map markers, alliance attack alerts, and enemy-to-member proximity monitoring.
- Native-style shortcut controls that appear only for enabled modules, plus the searchable Command Manual and contextual `? Help` links.

The generated catalog currently contains **26 modules**. Legacy feature coverage and intentionally excluded automation are tracked in [script_functions.md](script_functions.md).

## War Room simulation boundary

War Room generates formation candidates, edits previews, ranks outcomes, and caches results locally. Actual battle outcomes come from the game's native `SimulateBattle` command. Consequently, EA receives every uncached Quick, Detailed, Exhaustive, live, or manual-preview simulation request.

Simulation does not launch an attack. Applying a previewed formation is a separate, explicit, confirmed action.

## Architecture

The principal data flow is:

```text
ClientLib → shared game services / Game Data Hub → module calculations → Qooxdoo UI
```

Modules should use the scoped context and Hub instead of querying ClientLib directly. Use tracked `context.events` subscriptions, Suite storage/settings, and the shared window and notification services.

See [docs/modules.md](docs/modules.md), [Architecture](docs/02%20-%20Architecture/Architecture.md), and the [documentation index](DOCUMENTATION_INDEX.md) for details.

## Development

Run the automated suite:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

Build the unpacked Chrome extension:

```bash
node scripts/build/build-extension.mjs
```

The output is written to `dist/chrome`. Load that directory as an unpacked extension and perform the live-game checks documented under `tests/integration/`.

The automated suite is necessary but not a substitute for the live-game acceptance pass. EA client behavior is obfuscated and can vary by deployed build.

Do not edit generated module catalog or `dist/` files directly.

## Safety policy

The Suite emphasizes read-only analysis and user-initiated actions. Prohibited or deferred automation—including automatic attacks, unattended upgrades, troop movement, account switching, and login/logout behavior—is identified in [script_functions.md](script_functions.md).

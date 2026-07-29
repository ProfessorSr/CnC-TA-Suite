# Module Development

CnC-TA-Suite modules are self-contained features managed by `ModuleManager`.

## Recommended structure

```text
modules/<module-id>/
├── manifest.json
├── index.js
└── README.md
```

Legacy modules without manifests are still discovered, but new modules should use manifests.

## Manifest

```json
{
  "id": "example",
  "name": "Example Module",
  "version": "0.1.0",
  "apiVersion": "1.0.0",
  "author": "Author",
  "description": "Description",
  "dependencies": [],
  "permissions": ["events", "ui", "windows"],
  "settings": {}
}
```

Recognized explicit permissions in v1.0.0 are:

- `events`
- `game`
- `storage`
- `settings`
- `theme`
- `windows`
- `notifications`
- `ui`
- `hooks`
- `observers`
- `modules`
- `diagnostics`

Qooxdoo is an implementation detail of the shared UI and window services, not a separately granted module capability. Modules that render native custom controls may use the game-owned global only inside their renderer; data access still belongs behind `context.game` and `context.hub`.

## Lifecycle

```text
initialize → load → enable → disable → unload → destroy
```

Methods are optional and may be asynchronous.

## Context

Depending on granted permissions, a module may receive:

- `logger`
- `events`
- `moduleSettings`
- `game`
- `hub` (granted with the `game` permission)
- `storage`
- `settings`
- `theme`
- `windows`
- `notifications`
- `ui`
- `hooks`
- `observers`
- `modules`
- `diagnostics`

Use `context.events` for tracked subscriptions. Use native Qooxdoo widgets for in-game UI and pass widgets, not HTML elements, to the window service.

Use `context.hub.snapshot()` for aggregated ClientLib-derived data. Modules must not query ClientLib directly.

## Current feature modules

- **API Inspector** provides read-only readiness, service availability, cloned public snapshots, documented API examples, diagnostic health, and redacted diagnostic export without exposing mutable ClientLib objects or evaluating arbitrary code.
- **War Room** automatically follows native combat setup and includes target search and intelligence, an objective-driven Attack Planner, click-to-move formation previews, persistent formation presets, native manual-preview simulation, Quick/Detailed/Exhaustive candidate searches, cached result comparison, native animated replay, reports, army analysis, and combat history. Candidate generation, preview editing, caching, and ranking occur locally; every uncached battle outcome is requested from EA through the native `SimulateBattle` command. Applying a preview remains a separate, confirmed user action and never launches an attack.
- **Combat Reports** filters and aggregates battle history, loot, repair time, losses, CP efficiency, and PvP/PvE trends without triggering actions from reports.
- **Tactical Map** provides a read-only relationship-colored regional map with target lines, saved-target markers, range and level filters, and persistent map preferences.
- **Support Manager** lists support assignments and provides explicit, confirmed manual recall and calibration actions; it performs no unattended support automation.
- **Communications** formats coordinates, players, alliances, links, and Forgotten-wave summaries for user-initiated chat and mail composition.
- **External Analysis** generates selected-base CNCOpt, CNCTAOpt/CNCOpt+, and CNC-Map links and opens them only after an explicit click.
- **Context Actions** adds configurable Suite launch actions to the native map-object menu for owned bases, player bases, camps, outposts, and Forgotten targets.
- **Base Intelligence** consolidates player/world/alliance details, every owned base, composition, resource and repair projections, loot summaries, direct navigation, configurable status stickers, online-state colors, and region-tooltip details.
- **Base Layout Optimizer** analyzes the current owned base against resource goals and constraints, renders a compact native Qooxdoo building grid, compares estimated production, lists moves/replacements/additions/upgrades and costs, and ranks alternative layouts. Its one-click building mover is isolated and experimental.
- **Resource Transfer** supports detailed source selection plus per-destination Quick Transfer profiles for all resources, Crystal only, Tiberium only, or custom resource percentages pulled from all other eligible owned bases. **Scanner**, **Next MCV**, **Repair Manager**, and **Upgrade Manager** provide their corresponding game-planning and manual-action workflows.

Both one-click layout executors require an explicit user action and confirmation, never launch attacks, and expose independent source-level disable flags.

## Settings

```js
const value = context.moduleSettings.get('settingName');
await context.moduleSettings.set('settingName', newValue);
```

Manifest settings are validated for type and supported constraints.

## Registration

The build scans `modules/` and regenerates `core/modules/moduleCatalog.generated.js`. Do not edit the generated catalog manually.

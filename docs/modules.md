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
- **War Room** automatically follows native combat setup, docks its workspace on the left and Formation Controls on the right, and includes target search, objective-driven planning, persistent presets, native simulation, cached comparisons, replay, reports, army analysis, and combat history. Best Formation hides troops only after CY health reaches zero and then reveals units in their existing positions, prioritizing the CY column and strong structure attackers. Candidate generation and ranking are local; every uncached outcome is requested through the native `SimulateBattle` command.
- **Combat Reports** filters and aggregates battle history, loot, repair time, losses, CP efficiency, and PvP/PvE trends without triggering actions from reports.
- **Tactical Map** provides a read-only relationship-colored regional map with target lines, saved-target markers, range and level filters, and persistent map preferences.
- **Support Manager** lists support assignments and provides explicit, confirmed manual recall and calibration actions; it performs no unattended support automation.
- **Communications** formats coordinates, players, alliances, links, and Forgotten-wave summaries for user-initiated chat and mail composition.
- **External Analysis** generates selected-base CNCOpt, CNCTAOpt/CNCOpt+, and CNC-Map links and opens them only after an explicit click.
- **Context Actions** adds configurable Suite launch actions and custom-marker add/remove actions to native menus for owned bases, player bases, camps, outposts, and Forgotten targets.
- **Player Intelligence** presents rank, score/next-level progress, current/max command points, faction, alliance, achievements, and every owned base. Its pages cover detailed production, package collection, repairs, support assignments, direct base focus, status stickers, online-state colors, and region information.
- **Alliance Intelligence** covers members, POIs, bonuses, invitations, and private or alliance-shared persistent Suite markers. **Alliance Attack Alert** reports attacks on alliance members, while **Alliance Proximity Monitor** finds selected enemy-alliance bases near member bases.
- **Base Layout Optimizer** analyzes the current owned base against resource goals and constraints, renders a compact native Qooxdoo building grid, compares estimated production, lists moves/replacements/additions/upgrades and costs, and ranks alternative layouts. Its one-click building mover is isolated and experimental.
- **Scanner** combines exact 7T/5C, 6T/6C, and 5T/7C resource filters with optional two-position four- or five-touch Tiberium silo filters. Layout cards support selection, coordinate/CNCOpt export, persistent saving, removal, and world focus.
- **Resource Transfer** supports detailed source selection plus per-destination Quick Transfer profiles. **Next MCV** persists its open state, **Repair Manager** provides explicit package and Repair All controls, and **Quick Upgrade** displays scope-correct resources and live readiness ETAs for aggregate and selected upgrades.

Both one-click layout executors require an explicit user action and confirmation, never launch attacks, and expose independent source-level disable flags.

## Settings

```js
const value = context.moduleSettings.get('settingName');
await context.moduleSettings.set('settingName', newValue);
```

Manifest settings are validated for type and supported constraints.

## Registration

The build scans `modules/` and regenerates `core/modules/moduleCatalog.generated.js`. Do not edit the generated catalog manually.

# Testing

> Status: Active

## Automated tests

Run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

The stabilization suite contains **92 automated tests** covering feature behavior, independent module versioning, War Room native report/formation integration, Command Manual coverage/search, compatibility contracts, declarative module adoption, diagnostics, and performance budgets.

Automated coverage includes:

- event bus behavior and diagnostics;
- cache and registries;
- game UI readiness;
- compatibility and version detection;
- module manifests, dependencies, lifecycle, permissions, settings, and events;
- native module window content;
- delayed top-bar discovery;
- battle unit and formation models.
- War Room formation recommendation, native-result ranking, resource labels, health normalization, and Qooxdoo-shaped simulation callback normalization;
- API Inspector snapshot cloning, mutable-object omission, cyclic-data handling, and sensitive-field redaction;
- versioned Client API capability fixtures and graceful optional-capability loss;
- Hub schema validation and module/Hub API compatibility enforcement;
- structured logger history and large-account performance budgets;

## Build validation

```bash
node scripts/build/build-extension.mjs
```

The build must generate the module catalog and `dist/chrome` without errors.

## Manual validation

Use the Markdown checklists under `tests/integration/` for live-game behavior. At minimum verify:

- clean startup;
- Module Manager top-bar entry;
- native windows and dialogs;
- notification placement and cleanup;
- enable/disable persistence;
- Launcher and Suite Status access;
- player, city, world, selection, and battle APIs;
- movable War Room Formation Controls placement, faction-native styling, group visibility, persistent single-troop toggle mode, reset/save, and restored Attack Planner movement controls;
- no repeated hooks or runaway event listeners.

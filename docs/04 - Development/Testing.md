# Testing

> Status: Active

## Automated tests

Run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

The v0.4.0 release review completed with **29 passing tests and no failures**. The current post-release suite contains **66 passing automated tests**.

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
- no repeated hooks or runaway event listeners.

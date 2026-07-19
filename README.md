# CnC-TA-Suite

CnC-TA-Suite is a modular Chrome extension framework for [Command & Conquer: Tiberium Alliances](https://www.tiberiumalliances.com/). It provides shared game integration, lifecycle, storage, UI, and diagnostics services on which suite modules can be built.

The current release is **v0.4.0**.

## Current capabilities

- Discovers ClientLib and qooxdoo safely and waits for the game to become ready.
- Exposes player, city, world, alliance, selection, battle, unit, and formation APIs.
- Publishes game-state events and manages duplicate-safe hooks and observers.
- Provides shared caching, settings, storage, themes, windows, notifications, dialogs, and top-bar integration.
- Reports event-bus, cache, state-monitor, and integration-watchdog diagnostics.
- Discovers modules automatically during the extension build.
- Manages module manifests, dependencies, permissions, settings, and complete lifecycle transitions.
- Adds a native **Module Manager** entry to the game's top navigation bar.
- Uses the game's Qooxdoo UI and theme for suite windows, notifications, controls, and dialogs.
- Includes Module Manager, Suite Status, Launcher, and reference Sample modules. Launcher and Suite Status open on demand from Module Manager.

The page-context API is available at `window.CnCTASuite.game`. Runtime diagnostics are available through `window.CnCTASuite.diagnostics` and the Suite Status module.

## Repository layout

| Path | Purpose |
| --- | --- |
| `core/` | Bootstrap, module runtime, game integration, storage, events, diagnostics, Qooxdoo UI, and shared services |
| `modules/` | User-facing suite modules |
| `manifest/chrome/` | Chrome Manifest V3 entry points and extension assets |
| `docs/` | Project specifications, architecture, development guidance, and API references |
| `tests/` | Node unit tests and manual integration checklists |
| `scripts/build/` | Extension build tooling |

Implementation follows the approved specifications in `docs/`. Start with [Architecture](docs/02%20-%20Architecture/Architecture.md), [Game Integration](docs/06%20-%20Reference/Game%20Integration.md), and [Testing](docs/04%20-%20Development/Testing.md).

## Build and install

Requirements: a current Node.js release and Google Chrome or another Chromium-based browser that supports Manifest V3.

1. Build the unpacked extension:

   ```bash
   node scripts/build/build-extension.mjs
   ```

2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose `dist/chrome`.
5. Open a supported Tiberium Alliances game page.

Re-run the build after changing source files, then reload the extension from the extensions page.

## Test

Run all automated unit and integration tests with Node's built-in test runner:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

The Markdown files in `tests/integration/` are manual live-game checklists. Confirm the Module Manager top-bar entry, native windows, module toggles, persisted settings, and game integration behavior before publishing a release.

## Development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Keep core services independent of feature modules, use the shared registries and event bus instead of parallel globals, and update the relevant specification when behavior changes.

Modules are described by manifests and discovered by `scripts/build/generate-module-catalog.mjs`; do not edit the generated catalog manually. Module development guidance is available in [docs/modules.md](docs/modules.md).

Version metadata lives in `VERSION`, release-stage metadata in `PART`, and the browser-facing version in `manifest/chrome/manifest.json`. See [CHANGELOG.md](CHANGELOG.md) for release history.

## License and security

This project is distributed under the terms in [LICENSE](LICENSE). Report vulnerabilities according to [SECURITY.md](SECURITY.md).

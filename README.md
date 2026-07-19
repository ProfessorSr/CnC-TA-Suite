# CnC-TA-Suite

CnC-TA-Suite is a modular Chrome extension framework for [Command & Conquer: Tiberium Alliances](https://www.tiberiumalliances.com/). It provides shared game integration, lifecycle, storage, UI, and diagnostics services on which suite modules can be built.

> [!IMPORTANT]
> Version 0.3.0 is currently a Part 5 release candidate. Automated checks are in place, but live-game acceptance testing is still required before the release is tagged.

## Current capabilities

- Discovers ClientLib and qooxdoo safely and waits for the game to become ready.
- Exposes player, city, world, alliance, selection, battle, unit, and formation APIs.
- Publishes game-state events and manages duplicate-safe hooks and observers.
- Provides shared caching, settings, storage, themes, windows, notifications, and modals.
- Reports event-bus, cache, state-monitor, and integration-watchdog diagnostics.
- Includes the Launcher and Suite Status modules.

The page-context API is available at `window.CnCTASuite.game`. Runtime diagnostics are available through its diagnostics facade and in Suite Status.

## Repository layout

| Path | Purpose |
| --- | --- |
| `core/` | Bootstrap, game integration, storage, events, diagnostics, UI, and shared services |
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

Run all JavaScript unit tests with Node's built-in test runner:

```bash
node --test tests/unit/*.test.js
```

The Markdown files in `tests/integration/` are manual integration checklists. Before tagging 0.3.0, also complete [Part 5 Validation](docs/04%20-%20Development/v0.3.0%20Part%205%20Validation.md), including its live-game checks.

## Development

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Keep core services independent of feature modules, use the shared registries and event bus instead of parallel globals, and update the relevant specification when behavior changes.

Version metadata lives in `VERSION`, development-stage metadata in `PART`, and the browser-facing version in `manifest/chrome/manifest.json`. See [CHANGELOG.md](CHANGELOG.md) for release history and current release-candidate changes.

## License and security

This project is distributed under the terms in [LICENSE](LICENSE). Report vulnerabilities according to [SECURITY.md](SECURITY.md).

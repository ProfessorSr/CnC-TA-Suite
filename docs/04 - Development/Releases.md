# Releases

> Status: Active for v1.0.0

## Required validation

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
node scripts/build/build-extension.mjs
```

The first command runs JavaScript tests. Markdown integration files are manual live-game checklists.

## Release procedure

1. Confirm `VERSION`, `PART`, and Chrome manifest version agree.
2. Update the changelog.
3. Run automated tests.
4. Build the extension.
5. Load `dist/chrome` as an unpacked extension.
6. Complete live-game startup, Module Manager, window, settings, and game-integration checks.
7. Verify no fatal console errors.
8. Package or tag the validated source.

## v1.0.0 release-candidate result

- Build: must pass from a clean generated catalog
- Generated modules: 23
- Automated tests: 92 expected; zero failures required
- Live-game status: complete the Markdown checklists under `tests/integration/` before tagging

## Post-1.0 policy

Prefer compatible hardening, documentation, profiling, and targeted feature refinement over foundational rewrites. Record module API, Hub contract, settings, or compatibility changes explicitly.

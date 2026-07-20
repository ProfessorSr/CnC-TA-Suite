# Releases

> Status: Active for v0.4.0

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

## v0.4.0 result

- Build: passed
- Generated modules: 4
- Automated tests: 29 passed, 0 failed
- Live-game status: reported working well; final regression pass still recommended before public release

## Path to v1.0.0

Post-v0.4.0 changes should normally be compatible tweaks, hardening, documentation, and feature refinement rather than foundational rewrites.

# Versioning

> Status: Implemented

CnC-TA-Suite uses semantic versioning: `MAJOR.MINOR.PATCH`.

- **MAJOR** changes indicate incompatible public API or module-contract changes.
- **MINOR** changes add compatible features or substantial internal capability.
- **PATCH** changes fix defects or make compatible refinements.

## Current release

- `VERSION`: `0.4.0`
- `PART`: `v0.4.0-release`
- Chrome manifest version: `0.4.0`

These values must remain aligned for a release.

## Pre-1.0 policy

Before v1.0.0, minor releases may refine internal interfaces, but module-facing changes must still be recorded in the changelog. Breaking changes should be avoided after v0.4.0 unless needed for correctness or compatibility.

## Release checklist

1. Update `VERSION`.
2. Update `PART`.
3. Update `manifest/chrome/manifest.json`.
4. Update `CHANGELOG.md`.
5. Run the automated tests.
6. Build the Chrome extension.
7. Complete applicable live-game checklists.
8. Verify generated module catalog contents.
9. Tag the release only after validation passes.

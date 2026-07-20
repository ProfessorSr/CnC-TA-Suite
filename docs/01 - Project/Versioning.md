# Versioning

> Status: Implemented

CnC-TA-Suite uses semantic versioning: `MAJOR.MINOR.PATCH`.

- **MAJOR** changes indicate incompatible public API or module-contract changes.
- **MINOR** changes add compatible features or substantial internal capability.
- **PATCH** changes fix defects or make compatible refinements.

## Current release

- `VERSION`: `1.0.0`
- `PART`: `v1.0.0-release`
- Chrome manifest version: `1.0.0`

These values must remain aligned for a release.

## Compatibility policy

The 1.x line keeps the public game facade, Hub contract, module API, stored settings, and user workflows backward compatible wherever practical. Breaking changes require a major version, a migration note, and explicit changelog coverage. EA client changes may require compatibility adaptations without changing Suite-facing contracts.

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

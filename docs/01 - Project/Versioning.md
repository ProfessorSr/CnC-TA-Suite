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

Framework and module versions are intentionally independent. Suite Core and its public API/Hub contracts are `1.0.0`; every feature module currently begins at `0.1.0`, but each module may advance on its own schedule as its live-game acceptance checks are completed. A module release never requires the framework or other modules to adopt the same version. A module reaching `1.0.0` means only that module's supported workflow is considered stable.

`version` identifies the module release. `apiVersion` identifies the Suite module contract it consumes, and `hubApiVersion` identifies the normalized Hub contract it expects. These three values must not be treated as a single shared version.

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

For an individual module release, update only that module's `version`, changelog/manual metadata, and focused acceptance evidence. Update `apiVersion` or `hubApiVersion` only when the module actually changes the framework contract version it consumes.

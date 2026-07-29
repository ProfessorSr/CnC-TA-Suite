# EA Client Update Workflow

> Status: Required maintenance procedure

Use this workflow whenever the detected EA version or runtime fingerprint is not listed as verified in `core/game/compatibility/clientBuildRegistry.js`.

1. Capture a redacted support bundle with `CnCTASuite.diagnostics.exportJson()` before changing adapters.
2. Add a sanitized ClientLib-shaped fixture under `tests/fixtures/`; never commit account identifiers, chat, tokens, cookies, or alliance announcements.
3. Run the capability report and identify missing required versus optional capabilities.
4. Update only the versioned adapter or Hub normalizer. Modules must not gain new direct ClientLib fallbacks.
5. Add a regression test for every renamed, removed, or shape-changed accessor.
6. Run the complete test suite and large-account performance budget tests.
7. Validate startup, current city, world selection, target selection, battle simulation, and every enabled module in a live non-production account.
8. Add the fingerprint to the build registry only after validation, recording the date, adapter version, and migration notes.
9. Update the compatibility and release notes. Keep the previous adapter behavior until its supported module API major is retired.

Unknown builds may continue when all required capabilities pass. Optional failures place the Suite in degraded mode and should disable only the dependent feature.

# Roadmap

> Status: Active for v0.4.0

## Current position

v0.4.0 is the working architectural foundation. Core runtime behavior, module management, game integration, diagnostics, storage, settings, and Qooxdoo-native UI services are implemented.

## v0.4.x — Stabilization

- Complete live-game regression testing.
- Resolve remaining permission and compatibility inconsistencies.
- Remove or clearly mark unused legacy DOM helpers.
- Improve error reporting and recovery around game updates.
- Expand automated coverage for native UI cleanup and module failure paths.
- Finish implementation-backed documentation.

## v0.5.0–v0.9.x — Product refinement

- Improve Module Manager usability and module status reporting.
- Expand public game and diagnostics references.
- Add compatibility telemetry that does not collect personal data.
- Harden storage migration and recovery.
- Improve accessibility and keyboard navigation.
- Add release packaging and repeatable acceptance checks.
- Develop production feature modules without bypassing core services.

## v1.0.0 acceptance target

v1.0.0 should be tagged when:

- supported game pages start consistently;
- module lifecycle and dependency behavior are stable;
- native windows and notifications clean up correctly;
- public APIs are documented;
- automated tests and live-game checklists pass;
- security and privacy documentation is current;
- installation, upgrade, and rollback instructions are complete;
- no known critical or high-severity defects remain.

Large architectural rewrites are not planned between v0.4.0 and v1.0.0 unless required by browser or game compatibility.

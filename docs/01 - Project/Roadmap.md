# Roadmap

> Status: Active for v1.0.0

## Current position

v1.0.0 is the first feature-complete regular-user release candidate. Core runtime behavior, module management, data-driven UI contracts, centralized game integration, diagnostics, storage, settings, Qooxdoo-native UI services, and 23 discoverable modules are implemented.

## v1.0.x — Stabilization

- Complete live-game regression testing.
- Track EA client compatibility by runtime fingerprint and adapter contract.
- Improve error reporting and recovery around game updates.
- Expand automated coverage for native UI cleanup and module failure paths.
- Keep Command Manual coverage synchronized with every registered module.

## v1.x — Maintenance and alliance refinement

- Improve alliance-management workflows only after role, safety, and live-client validation.
- Expand public game and diagnostics references as stable contracts become available.
- Harden storage migration and recovery.
- Improve accessibility and keyboard navigation.
- Add release packaging and repeatable acceptance checks.
- Keep feature modules behind the Hub, adapter, permission, and explicit-user-action boundaries.

## v1.0.0 acceptance gate

v1.0.0 should be tagged when:

- supported game pages start consistently;
- module lifecycle and dependency behavior are stable;
- native windows and notifications clean up correctly;
- public APIs are documented;
- automated tests and live-game checklists pass;
- security and privacy documentation is current;
- installation, upgrade, and rollback instructions are complete;
- no known critical or high-severity defects remain.

Automated validation can establish repository readiness. Tagging and distribution still require the documented live-game acceptance pass on a current EA world.

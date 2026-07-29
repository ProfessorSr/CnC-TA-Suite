# Stability and Performance

The Suite uses four maintenance contracts:

- Suite module API: `core/modules/moduleApiPolicy.js`
- Hub snapshot schema: `core/game/hub/hubContract.js`
- Client adapter capabilities: `core/game/compatibility/clientApiAdapter.js`
- Verified EA builds: `core/game/compatibility/clientBuildRegistry.js`

Runtime budgets currently cover game-state capture, tick-listener dispatch, total ticks, Hub snapshots, module enable/open operations, and owned-city normalization. Inspect them with `CnCTASuite.diagnostics.snapshot().performance`. Individual over-budget samples remain visible in the operation statistics, but a diagnostic violation and warning require three consecutive breaches. This prevents browser scheduling or garbage-collection noise from being reported as a regression.

Before release, run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
node scripts/build/build-extension.mjs
```

Performance regressions must be fixed or accompanied by an explicitly reviewed budget change. Do not increase a budget merely to silence a warning.

# Stability and Performance

The Suite uses four maintenance contracts:

- Suite module API: `core/modules/moduleApiPolicy.js`
- Hub snapshot schema: `core/game/hub/hubContract.js`
- Client adapter capabilities: `core/game/compatibility/clientApiAdapter.js`
- Verified EA builds: `core/game/compatibility/clientBuildRegistry.js`

Runtime budgets currently cover game-state ticks, Hub snapshots, module enable/open operations, and owned-city normalization. Inspect them with `CnCTASuite.diagnostics.snapshot().performance`. A budget violation is retained in diagnostics and logged as a warning.

Before release, run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
node scripts/build/build-extension.mjs
```

Performance regressions must be fixed or accompanied by an explicitly reviewed budget change. Do not increase a budget merely to silence a warning.

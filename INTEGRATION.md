# Integration and live acceptance

The production integration path is built into Suite Core; no scripts require
manual loader registration. The build discovers modules and regenerates
`core/modules/moduleCatalog.generated.js` automatically.

For repository validation run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
node scripts/build/build-extension.mjs
```

Then load `dist/chrome` as an unpacked extension and complete the live checklists
in `tests/integration/`. At minimum verify clean bootstrap, Module Manager and
Command Manual access, module enable-state persistence, right-dock placement,
Hub data freshness, Qooxdoo window cleanup, and the user-confirmed native action
paths relevant to the change.

The Suite does not automatically attack. Analysis and previews must remain
separate from explicit, confirmed native actions.

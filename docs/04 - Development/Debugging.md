# Debugging

> Status: Active

Set `general.logLevel` to `debug`, reload the unpacked extension, and inspect `[CnC-TA-Suite:<scope>]` messages. Verify `window.CnCTASuite`, `CnCTASuite.context.lifecycle.state`, `CnCTASuite.context.modules.snapshot()`, `CnCTASuite.diagnostics.snapshot()`, and `CnCTASuite.game.ready`. Check Chrome extension errors, page-console module imports, stored `settings`, Qooxdoo application readiness, and whether the navigation host contains expected labels. Rebuild and reload `dist/chrome` after source changes; editing `dist/` directly is temporary and unsupported.

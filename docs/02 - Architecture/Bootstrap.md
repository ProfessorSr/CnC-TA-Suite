# Bootstrap

> Status: Implemented for v0.4.0

`manifest/chrome/bridge.js` runs at `document_start`, installs the storage message bridge, and injects the page-context module entry. `bootstrap()` is idempotent and performs this sequence:

1. Emit `suite:bootstrap-started`.
2. Wait for `qx.core.Init.getApplication()`.
3. Load storage and validated settings.
4. Construct theme, window, notification, dialog, top-bar, hook, observer, game, and diagnostics services.
5. Register classes from the generated module catalog.
6. Initialize Game Integration; a compatibility failure is logged while core startup may continue.
7. Enable configured modules in dependency order.
8. Publish frozen `window.CnCTASuite` and emit `suite:ready`.

Fatal composition or module-start errors emit `suite:error` and reject the shared bootstrap promise. Qooxdoo readiness has a 60-second timeout. Generated builds must include every imported core and module resource.

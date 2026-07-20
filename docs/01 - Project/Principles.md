# Principles

> Status: Active for v1.0.0

1. **Native first:** use Qooxdoo widgets and game appearances for in-game UI.
2. **Discover once:** core owns ClientLib, application, service, and object discovery.
3. **Modules are guests:** modules consume granted `ModuleContext` capabilities and declare dependencies.
4. **Cleanup is behavior:** listeners, timers, widgets, hooks, and observers require deterministic teardown.
5. **Fail visibly:** log actionable errors and expose health through diagnostics.
6. **Persist deliberately:** validate settings and use stable, documented keys.
7. **Minimize privilege:** request only required browser and module permissions.
8. **Protect players:** do not collect secrets or personal data; avoid unsafe rich HTML.
9. **Document reality:** distinguish implemented, planned, and historical behavior.
10. **Prefer compatible evolution:** record module-contract changes and avoid needless pre-v1 rewrites.

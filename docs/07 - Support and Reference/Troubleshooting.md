# Troubleshooting

## Start with the smallest question

Before debugging a feature module, determine which layer failed.

1. Did the extension load?
2. Did the Framework start?
3. Did game integration become ready?
4. Is the game build compatible?
5. Did the module register?
6. Did dependencies resolve?
7. Was the module enabled?
8. Did its window open?
9. Is its data ready?
10. Did a user action fail?

Suite Status and Module Manager exist to answer these questions.

## Framework does not appear

Check:

- The extension is enabled.
- The selected folder is `dist/chrome`.
- The current URL matches a supported game domain.
- The page was refreshed after loading the extension.
- The Chrome manifest can be read.
- `manifest/chrome/bridge.js` exists in the build.
- Browser console errors at document startup.

Rebuild from source instead of copying individual files into an old build.

## Framework remains “waiting”

Possible causes:

- Qooxdoo is not ready.
- The game application root is not ready.
- ClientLib is missing.
- Login has not completed.
- A game update changed the readiness path.
- The page is not the actual game client view.

Check Suite Status or bootstrap logs for the last successful readiness step.

## Module does not appear

Check:

- The module directory is directly under `modules/`.
- The folder contains `index.js`, or a discoverable exported `SomethingModule` class.
- The class is exported.
- The generated catalog was rebuilt.
- The build reported the expected module count.
- The module ID is valid.
- The manifest date uses `YYYY-MM-DD`.
- Versions are valid semantic versions.
- Requested permissions are known.

Open `core/modules/moduleCatalog.generated.js` only to inspect it. Do not hand-edit it.

## Module appears but will not enable

Check:

- Suite API compatibility.
- Hub API compatibility.
- Dependencies.
- Permission errors.
- Lifecycle exception during initialize, load, or enable.
- Module state in Module Manager.
- Module-specific logs.

## Module window will not open

Check:

- The module exposes `open()`.
- The module is enabled.
- It requested `windows` permission.
- A valid Qooxdoo desktop or root exists.
- Window content is a supported Qooxdoo widget or string.
- The window ID is non-empty.
- The existing singleton window is not disposed incorrectly.

## Duplicate behavior after re-enable

This usually indicates incomplete cleanup.

Look for:

- Event subscription added twice.
- Timer not stopped.
- Hook not removed.
- Observer still active.
- Old window reference retained.
- Toolbar control added again.
- Native callback registered multiple times.

Review `disable()`, `unload()`, context cleanup, and window close behavior.

## Settings do not persist

Check:

- The module requested `settings`.
- The setting is declared.
- The definition has a default.
- The type is supported.
- The module uses its scoped settings service.
- Chrome storage permission is available.
- A storage fallback warning appears.
- The key or module ID changed between versions.

## Window position does not persist

Check:

- `windows.rememberPositions` is enabled.
- The window uses the same ID every time.
- The window closes normally.
- Storage writes succeed.
- A changed size revision intentionally rejected the old size.
- The module is not creating a non-singleton replacement each time.

## Hub data is missing or stale

Check:

- Hub snapshot `ready`.
- Hub `generatedAt`.
- Game integration health.
- Current selection and base state.
- Cache status.
- Compatibility result.
- Module-required Hub API version.
- Whether the module is reading a cached feature copy instead of the current Hub.

## Unknown game build

An unknown build is not automatically broken.

The Framework may still operate through runtime discovery and adapters.

However:

- Treat action features cautiously.
- Check normalized data.
- Perform live visual confirmation.
- Record the build information.
- Add compatibility handling when necessary.

## Storage fallback warning

The Framework could not use primary Chrome storage and switched to local storage for the session.

Check:

- Browser extension storage permission.
- Browser profile restrictions.
- Storage quota.
- Extension reload.
- Console error attached to the warning.

Do not assume values saved only in fallback storage will behave exactly like primary extension storage.

## Creating a support report

Collect:

- Exact Framework version.
- Exact affected module version.
- Steps to reproduce.
- Expected result.
- Actual result.
- Module state.
- Suite Status health.
- Relevant logs.
- Redacted diagnostic export.
- Screenshot when the visual state matters.

Review diagnostic exports before sharing them, even though known sensitive keys are redacted.

## Last-resort isolation test

1. Disable every optional feature module.
2. Refresh.
3. Confirm the Framework and required control modules.
4. Enable optional modules one at a time.
5. Reproduce the problem.

This identifies whether the problem belongs to the Framework, one module, or an interaction between modules.

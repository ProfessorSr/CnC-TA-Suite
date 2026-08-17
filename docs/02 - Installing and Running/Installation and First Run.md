# Installation and First Run

## What you install

The Chrome build is produced in:

```text
dist/chrome
```

That folder contains the unpacked extension files that Chrome can load.

The source repository also contains development files, tests, build scripts, and documentation. Chrome does not need the entire repository. It needs the built extension directory.

## Building the extension

From the repository root, run:

```bash
node scripts/build/build-extension.mjs
```

The build performs these main steps:

1. Scans the `modules` directory.
2. Generates the module catalog.
3. Removes the old `dist/chrome` output.
4. Creates a clean output directory.
5. Copies the Chrome manifest.
6. Copies the page bridge and Suite loader.
7. Copies Framework core files.
8. Copies installed module files.
9. Copies shared assets.

The generated catalog file is:

```text
core/modules/moduleCatalog.generated.js
```

Do not edit that file by hand. It will be replaced the next time the catalog generator runs.

Do not make permanent changes directly inside `dist/chrome`. The build process replaces that directory.

## Loading the unpacked extension

In a Chromium-based browser:

1. Open the Extensions page.
2. Turn on Developer Mode.
3. Choose **Load unpacked**.
4. Select the `dist/chrome` folder.
5. Open or refresh a supported CnC-TA game page.

The extension currently requests:

- Browser storage permission.
- Access to supported Tiberium Alliances game domains.

The content bridge runs at `document_start` so it can prepare the page-side Framework loader early, while the Framework itself still waits for the game environment before completing startup.

## Supported page patterns

The Chrome manifest includes pages under:

```text
https://*.alliances.commandandconquer.com/*
https://*.tiberiumalliances.com/*
```

The extension should not run on unrelated websites.

## What should happen on first run

A successful first run should produce these results:

- The game loads normally.
- The Framework detects the game environment.
- The Framework waits for Qooxdoo and the game UI.
- Shared services start.
- The required control modules register.
- The Framework reports a ready state.
- Module Manager can be opened.
- Suite Dashboard can be opened.
- Suite Status can be opened.
- No repeated uncaught errors appear in the browser console.
- Window positions and module states can be saved.

## A simple first-run checklist

### Framework

- [ ] Framework version displays as `1.1.0`.
- [ ] Game integration reports ready.
- [ ] Compatibility status is visible.
- [ ] Required services are available.
- [ ] No optional gameplay module is required for startup.

### Control modules

- [ ] Suite Dashboard opens.
- [ ] Module Manager opens.
- [ ] Suite Status opens.
- [ ] Opening the same window twice focuses the existing window.
- [ ] Disabling a module updates its state.
- [ ] Re-enabling a module restores its expected behavior.

### Storage

- [ ] Move a Framework window.
- [ ] Close and reopen it.
- [ ] Confirm that the saved position is restored when position memory is enabled.
- [ ] Change an enabled state.
- [ ] Refresh the game.
- [ ] Confirm the enabled state is retained.

## What if no optional modules are installed?

That is a valid configuration.

The Framework should still start with only the required control modules. The Module Manager may simply show that no additional feature modules are available.

An empty optional-module set is not an error.

## Updating the Framework

When replacing one Framework build with another:

1. Keep a backup of the previous working build.
2. Build or unpack the new version into a clean directory.
3. Reload the extension.
4. Refresh the game page.
5. Check Suite Status.
6. Verify the required control modules.
7. Verify any separately installed modules against their own compatibility information.

Do not assume that copying a few changed files into an old `dist` directory produces a clean release. A complete rebuild is safer.

## Live verification matters

Automated tests are important, but the game client is obfuscated and may vary by deployed build. A release should also be tested in the live game.

At minimum, verify:

- Clean bootstrap.
- Game readiness.
- Module enable-state persistence.
- Window opening and cleanup.
- Hub data freshness.
- Compatibility reporting.
- User-confirmed native action paths used by installed modules.

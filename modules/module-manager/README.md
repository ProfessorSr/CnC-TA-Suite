# Module Manager

The Module Manager is the primary user-facing entry point for the v0.4.0 module framework.

## Features

- Opens from the native Module Manager entry in the game's top navigation bar.
- Uses a movable, resizable Qooxdoo window styled by the game theme.
- Lists every registered module.
- Shows module name, version, author, description, and state.
- Enables or disables modules immediately.
- Saves module enabled state in Suite settings.
- Prevents the Module Manager from disabling itself.

## Discovery

The build discovers this module from its directory and adds it to
`core/modules/moduleCatalog.generated.js` automatically:

```bash
node scripts/build/build-extension.mjs
```

Do not edit the generated catalog manually.

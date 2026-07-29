# Module System

## What is a module?

A module is a separate package of functionality that plugs into the Framework.

A module may provide:

- A window.
- A dashboard panel.
- A calculation.
- A report.
- A game-data view.
- A user-confirmed action.
- A background monitor used while enabled.

The module owns the feature. The Framework owns the environment in which the feature runs.

## How modules are discovered

The build scans each directory directly inside:

```text
modules/
```

For each directory, it tries to find an entry file.

The first choice is:

```text
index.js
```

If there is no `index.js`, the generator examines JavaScript files and looks for an exported class whose name ends in `Module`.

Files ending in `Window.js` and test files are not chosen as automatic entries.

The generator writes imports into:

```text
core/modules/moduleCatalog.generated.js
```

The generated catalog becomes the list registered during Framework startup.

## Registration

Registration is more than adding the class to an array.

The Framework:

1. Normalizes the manifest.
2. Assigns normalized identity fields to the module.
3. Validates the module ID.
4. Validates semantic versions.
5. Validates the last-updated date.
6. Checks Suite API compatibility.
7. Checks Hub API compatibility.
8. Registers requested permissions.
9. Registers the settings schema.
10. Adopts declarative presentation information when used.
11. Places the module in the registry.
12. Records the `registered` state.
13. Emits a registration event.

## Module ID rules

A module ID must:

- Begin with a lowercase letter.
- Use lowercase letters and numbers.
- May use dots, underscores, or hyphens between parts.
- Remain stable after release.

Valid examples:

```text
scanner
war-room
base.intelligence
resource_transfer
```

Invalid examples:

```text
War Room
123scanner
scanner!
```

The ID is used by settings, permissions, dependencies, lifecycle state, and storage keys. Changing it makes the Framework treat the module as a different module.

## Module name

The displayed name may contain spaces and normal capitalization.

Example:

```text
id:   module-manager
name: Module Manager
```

## Dependencies

A dependency is another module that must be present first.

Example:

```json
{
  "dependencies": ["shared-map-tools"]
}
```

The dependency resolver determines loading order.

Dependencies should be used only when one module truly requires another module's documented contract. Shared general-purpose behavior is often better placed in the Framework.

## Permissions

A module declares which Framework capabilities it needs.

Example:

```json
{
  "permissions": [
    "game",
    "storage",
    "settings",
    "windows",
    "notifications"
  ]
}
```

Unknown permission names cause registration to fail.

Older modules without an explicit manifest may receive unrestricted compatibility behavior, but new modules should always use an explicit manifest and least-necessary permissions.

## Settings

The manifest can define module settings.

Each setting needs a default and a supported type. The Framework registers those definitions under the module's scope.

## Lifecycle

The Module Manager controls loading and active state.

A module should not start permanent behavior in its constructor. Constructors should establish identity and initial local values. Active work belongs in lifecycle methods.

## Opening a module

A module may expose:

```text
open(context)
```

The Module Manager can enable it and then call the open action.

If no `open()` method exists, the module may still provide non-window behavior, but the manager should not pretend it can open it.

## Declarative and custom modules

A module may use the declarative UI system or create custom Qooxdoo content.

Declarative modules are useful for predictable status, settings, text, and tab layouts.

Custom modules are appropriate for complex interfaces that need specialized rendering.

Both should still use Framework windows, settings, events, and cleanup rules.

## Module independence

A feature module should be removable by deleting its directory and rebuilding the catalog.

Removing it should not require editing unrelated Framework source files.

If removal breaks bootstrap, the feature is too tightly coupled to the core.

## Documentation ownership

Every feature module should contain its own documentation, including:

- Purpose.
- Version.
- Compatibility.
- Permissions.
- Settings.
- User actions.
- Data sources.
- Known limitations.
- Safety boundaries.
- Troubleshooting.
- Changelog or release notes.

Framework docs explain how modules work as a category. They do not replace module documentation.

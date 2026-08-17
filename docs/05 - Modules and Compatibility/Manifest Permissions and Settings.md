# Manifest, Permissions, and Settings

## Why the manifest matters

The manifest is the module's identification card and requirements list.

It tells the Framework:

- Who the module is.
- Which version it is.
- Which Framework API it expects.
- Which Hub API it expects.
- Who maintains it.
- When it was updated.
- What it does.
- Which modules it depends on.
- Which permissions it requests.
- Which settings it defines.

## Example manifest

```json
{
  "id": "example-module",
  "name": "Example Module",
  "version": "0.1.0",
  "apiVersion": "1.1.0",
  "hubApiVersion": "1.0.0",
  "author": "Example Author",
  "lastUpdated": "2026-07-29",
  "description": "Demonstrates the Framework module contract.",
  "manual": {
    "title": "Example Module",
    "summary": "Explains how to use Example Module.",
    "steps": ["Open the module.", "Review its current data."],
    "controls": [["Refresh", "Reads the current data again."]],
    "notes": []
  },
  "dependencies": [],
  "permissions": [
    "events",
    "game",
    "settings",
    "storage",
    "windows"
  ],
  "settings": {
    "refreshSeconds": {
      "default": 30,
      "type": "number"
    }
  }
}
```

## Required and defaulted fields

The normalizer can provide defaults for some values when a JavaScript module object is registered, but released modules should declare a complete explicit manifest.

Important validation includes:

- ID format.
- Non-empty name.
- Semantic module version.
- Semantic Suite API version.
- Semantic Hub API version.
- Valid `YYYY-MM-DD` update date.
- String arrays for dependencies and permissions.
- Object-shaped settings.

## Command Manual contribution

Each module owns its Command Manual content through the optional `manual` object. The supported fields are `title`, `summary`, `steps`, `controls`, and `notes`. When detailed content is omitted, the Framework derives a baseline chapter from the module name and description.

The global Command Manual discovers this information from the live module registry. Only installed modules whose lifecycle state is `enabled` appear in its table of contents, search results, related-module links, and module inventory. Disabling or unloading a module removes its chapter immediately.

## Semantic version format

Valid versions follow:

```text
major.minor.patch
```

Examples:

```text
0.1.0
1.0.0
2.4.7
1.0.0-beta.1
1.0.0+build.5
```

## Permission list

Known Framework permission values are:

| Permission | Capability |
|---|---|
| `events` | Shared event use |
| `game` | Game services and Hub access |
| `storage` | Feature data storage |
| `settings` | Framework/module settings |
| `theme` | Shared visual theme |
| `windows` | Managed windows |
| `notifications` | User notifications |
| `ui` | Shared UI helpers |
| `hooks` | Managed hooks |
| `observers` | Managed observers |
| `modules` | Module registry and controls |
| `diagnostics` | Framework diagnostic information |

The permission system accepts `*` for unrestricted access, but new modules should avoid it.

## Least-permission design

Request only what the module actually uses.

A read-only status module may need:

```text
game
windows
```

It should not request:

```text
hooks
observers
modules
diagnostics
```

unless the feature genuinely needs them.

Smaller permission lists make review easier and prevent accidental coupling.

## What permission checking does

The Framework records grants by module ID.

When creating the scoped context, it exposes an allowed capability and leaves a denied capability undefined.

The module can also explicitly require a permission. If it is absent, the Framework throws a clear error.

## What permission checking does not do

This is not a separate operating-system process or browser sandbox for each module.

A malicious or careless module may still use global page objects directly.

Permissions are a Framework contract and development control. Only trusted module code should be installed.

## Settings definitions

Each setting must have a default.

If a plain value is supplied, the Framework can normalize it into a definition. Explicit definitions are clearer.

Supported types:

```text
boolean
number
string
array
object
```

## Good setting design

A setting should:

- Have a safe default.
- Use a clear name.
- Explain units.
- Be validated.
- Avoid unnecessary complexity.
- Be scoped to the module.
- Trigger a controlled refresh when changed.

Good:

```text
refreshSeconds: 30
showWarnings: true
sortMode: "distance"
```

Poor:

```text
x: 30
mode2: true
stuff: {}
```

## Manifest and code must agree

The manifest is not decoration.

If the code uses `context.windows`, the manifest should request `windows`.

If the module uses Hub records, it should declare the Hub API version it expects.

If the module changes its settings, update the manifest and module documentation together.

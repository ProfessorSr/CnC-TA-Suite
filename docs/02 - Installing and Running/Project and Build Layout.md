# Project and Build Layout

## Repository overview

The repository is divided by responsibility.

```text
CnC-TA-Suite/
├── core/
├── manifest/
├── modules/
├── assets/
├── scripts/
├── tests/
├── docs/
├── dist/
├── VERSION
└── PART
```

## `core/`

The `core` directory contains the Framework itself.

Major areas include:

```text
core/
├── bootstrap/       Startup and lifecycle coordination
├── clientlib/       ClientLib discovery and wrappers
├── diagnostics/     Health, snapshots, and support information
├── events/          Shared event system
├── game/            Game services, adapters, Hub, and integration
├── hooks/           Managed hooks and observers
├── interfaces/      Public base contracts
├── modules/         Discovery, manifests, permissions, and lifecycle
├── performance/     Performance measurements
├── settings/        Framework settings and validation
├── storage/         Browser storage and fallback storage
├── theme/           Shared visual values
├── ui/              Shared Qooxdoo UI helpers
├── utils/           Logging, timers, versions, and helpers
└── windows/         Shared window behavior
```

Feature-specific logic should not be placed in `core` simply because several files need it. Shared code belongs in core only when it is a genuine Framework service or contract.

## `manifest/`

This directory contains Chrome extension entry files.

```text
manifest/chrome/
├── manifest.json
├── bridge.js
├── suite.js
└── suite.css
```

The browser loads the bridge as a content script. Framework code and module files are listed as web-accessible resources so they can be injected into the game page environment.

## `modules/`

Each immediate child directory represents one installed module.

The build scans these directories automatically. It looks for:

1. `index.js`, or
2. another JavaScript file that exports a class whose name ends in `Module`.

A typical module may look like:

```text
modules/example-module/
├── manifest.json
├── index.js
├── exampleWindow.js
├── example.css
├── README.md
└── assets/
```

The exact files vary by module. The manifest and exported module class are the important parts.

## `scripts/`

The build scripts currently include:

- `build-extension.mjs` — produces `dist/chrome`.
- `generate-module-catalog.mjs` — discovers modules and writes the generated catalog.
- `generate-project-tree.mjs` — creates a project-tree document while omitting local and build metadata.

## `tests/`

Tests are divided into:

```text
tests/
├── fixtures/
├── integration/
├── mocks/
└── unit/
```

Unit tests check focused classes and services. Integration tests check how larger pieces work together.

Run the complete Node test suite with:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

## `dist/`

`dist/chrome` is generated build output.

It should be treated as disposable. Make changes in the source directories, then rebuild.

## `VERSION` and `PART`

`VERSION` contains the Framework's semantic version:

```text
1.0.0
```

`PART` contains the release label:

```text
v1.0.0-release
```

Module versions do not come from these files. They come from each module's own manifest and module class.

## Files that should not be shipped accidentally

A clean release package should normally exclude local development metadata such as:

- `.git`
- `.DS_Store`
- `__MACOSX`
- temporary archives
- editor caches
- local logs
- personal test files

These files are not needed by the extension and can make review confusing.

# Building a Module

## Before writing code

Define the feature boundary.

Write down:

- What problem the module solves.
- What information it reads.
- What actions it can perform.
- Which Framework services it needs.
- Whether it opens a window.
- What must stop when disabled.
- What data it saves.
- What its safety and confirmation boundaries are.

If the feature description includes “the Framework must be changed so my module can work,” first decide whether the missing capability is truly general-purpose.

## Step 1: Create the module folder

Example:

```text
modules/example-module/
```

## Step 2: Add a manifest

Create:

```text
modules/example-module/manifest.json
```

Use a stable lowercase ID and declare real permissions.

## Step 3: Create the entry class

The easiest entry is:

```text
modules/example-module/index.js
```

A basic module can extend the Framework base class.

```javascript
import { Module } from "../../core/interfaces/module.js";

export class ExampleModule extends Module {
  constructor() {
    super({
      id: "example-module",
      name: "Example Module",
      version: "0.1.0",
      apiVersion: "1.0.0",
      author: "Your Name",
      description: "Explains what the module does.",
      permissions: ["windows"],
      settingsKey: "exampleModule"
    });

    this.context = null;
  }

  async enable(context) {
    this.context = context;
  }

  async disable() {
    this.context?.windows?.close("example-module-main");
    this.context = null;
  }

  async open(context = this.context) {
    if (!context) return null;

    return context.windows.open({
      id: "example-module-main",
      title: "Example Module",
      content: "Example content",
      width: 420,
      height: 300,
      singleton: true
    });
  }
}
```

The module's manifest and class identity should agree.

## Step 4: Use the scoped context

Do not import global Framework singletons merely for convenience.

Use the context passed by the Module Manager:

```text
context.logger
context.events
context.storage
context.moduleSettings
context.game
context.windows
context.notifications
```

Only services allowed by the manifest are present.

## Step 5: Keep the constructor quiet

The constructor should set identity and local defaults.

Do not:

- Start repeating timers.
- Open windows.
- access ClientLib;
- attach game listeners;
- change game state.

Those operations belong in lifecycle methods after the Framework is ready.

## Step 6: Implement cleanup

Every active resource needs a cleanup plan.

If `enable()` starts something, `disable()` should stop it.

If `load()` allocates something, `unload()` should release it.

Use tracked Framework event subscriptions where possible.

## Step 7: Add a window

Use `context.windows.open()`.

Choose a stable ID and singleton behavior unless multiple copies are genuinely necessary.

For simple status/settings modules, consider the declarative module system.

For complex interactive modules, build a custom Qooxdoo widget but still place it inside a Framework-managed window.

## Step 8: Add settings

Declare defaults and types in the manifest.

Read and update settings through `context.moduleSettings` when available.

Avoid direct hard-coded global setting paths.

## Step 9: Add documentation

The module should explain:

- What it does.
- How to install it.
- Version and compatibility.
- Permissions.
- Settings.
- User workflow.
- Data sources.
- Actions and confirmations.
- Known limitations.
- Troubleshooting.
- Release changes.

## Step 10: Build the catalog

Run:

```bash
node scripts/build/generate-module-catalog.mjs
```

or run the full build:

```bash
node scripts/build/build-extension.mjs
```

Confirm the generator reports the expected number of modules.

## Step 11: Test

Add unit tests for calculations and state handling.

Add integration tests for:

- Registration.
- Manifest validation.
- Permissions.
- Dependencies.
- Lifecycle.
- Window cleanup.
- Settings persistence.
- Compatibility behavior.

Then perform live testing in the game.

## Step 12: Remove-test

Temporarily remove the module directory and rebuild.

The Framework should still operate.

This is a valuable test of real module independence.

## Module-development checklist

- [ ] Stable ID.
- [ ] Independent semantic version.
- [ ] Explicit Suite API version.
- [ ] Explicit Hub API version when used.
- [ ] Valid last-updated date.
- [ ] Minimal permissions.
- [ ] Declared settings defaults.
- [ ] No active constructor work.
- [ ] Complete disable/unload cleanup.
- [ ] Managed windows.
- [ ] No direct UI-only calculations.
- [ ] No unnecessary ClientLib access.
- [ ] Unit tests.
- [ ] Live test.
- [ ] Module documentation.

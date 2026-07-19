# Module Development

CnC-TA-Suite modules are self-contained features managed by `ModuleManager`.

## Required structure

```text
modules/<module-id>/
├── manifest.json
├── index.js
└── README.md
```

## Manifest

Every module must provide:

```json
{
  "id": "example",
  "name": "Example Module",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "author": "Author",
  "description": "Description",
  "dependencies": [],
  "permissions": ["events"],
  "settings": {}
}
```

Valid permissions are:

- `events`
- `game`
- `storage`
- `settings`
- `theme`
- `windows`
- `notifications`
- `ui`
- `hooks`
- `observers`
- `modules`
- `diagnostics`

## Lifecycle

The lifecycle order is:

```text
initialize → load → enable → disable → unload → destroy
```

Each lifecycle method is optional and may be asynchronous.

## Context

Lifecycle methods receive a `ModuleContext`. Depending on permissions, it may expose:

- `logger`
- `events`
- `moduleSettings`
- `game`
- `storage`
- `settings`
- `theme`
- `windows`
- `notifications`
- `ui`
- `hooks`
- `observers`
- `modules`
- `diagnostics`

Use `context.events` instead of subscribing directly to the global event bus. Subscriptions made through `context.events` are cleaned up automatically when the module is disabled.

## Registration

Modules are registered before `ModuleManager.startEnabled()` runs:

```js
import { ExampleModule } from '../../modules/example/index.js';

modules.register(new ExampleModule());
```

Dependencies are enabled first. Missing dependencies and circular dependencies prevent startup and produce clear errors.

## Settings

Settings are declared in the manifest and accessed through the module-scoped settings API:

```js
const value = context.moduleSettings.get('settingName');
await context.moduleSettings.set('settingName', newValue);
```

The framework validates setting types, enumerations, and numeric ranges.

## Events

```js
const unsubscribe = context.events.on('game:city-changed', (payload) => {
  context.logger.debug('City changed.', payload);
});

context.events.emit('example:updated', { value: 1 });
```

Manual cleanup is normally unnecessary because the module context clears tracked subscriptions during disable.

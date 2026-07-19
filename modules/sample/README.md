# Sample Module

This module is the reference implementation for the CnC-TA-Suite v0.4 module framework.

It demonstrates:

- Manifest metadata
- Lifecycle methods
- Module-scoped logging
- Module settings
- Permission-controlled capabilities
- Event emission
- Automatic event subscription cleanup through `context.events`

## Discovering the module

The extension build discovers the module automatically and regenerates the module catalog:

```bash
node scripts/build/build-extension.mjs
```

The module is enabled automatically by `ModuleManager.startEnabled()` unless the setting below is false:

```text
modules.sample
```

## Settings

- `showNotificationOnEnable`: Shows a notification when the module is enabled.
- `message`: Text shown in the enable notification.

Settings are available inside lifecycle methods through:

```js
context.moduleSettings.get('message');
context.moduleSettings.set('message', 'New message');
```

## Events

The module emits:

- `sample:enabled`
- `sample:disabled`

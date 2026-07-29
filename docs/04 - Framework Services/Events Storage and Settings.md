# Events, Storage, and Settings

## Event bus

The event bus is the Framework's message system.

A publisher emits an event:

```text
MODULE_REGISTERED
BASE_CHANGED
GAME_READY
```

Subscribers listen for events they need.

The publisher does not need to know how many subscribers exist. Subscribers do not need to import the publisher's internal class.

## Why events are useful

Suppose the selected base changes.

Without an event bus, every module might repeatedly check the selected base using its own timer.

With an event bus:

1. The game-state monitor detects the change.
2. It emits one event.
3. Interested modules receive it.
4. Modules that do not care are not involved.

That is more efficient and easier to maintain.

## Tracked module events

A module should prefer:

```text
context.events
```

over unmanaged raw subscriptions.

The Module Events wrapper records subscriptions under the module ID. When the module context is cleaned up, those tracked subscriptions can be cleared.

## Event responsibilities

Publishers should:

- Use a documented event name.
- Send a predictable payload.
- Avoid exposing unstable game objects when a normalized record will work.
- Avoid emitting the same event in a tight loop without need.

Subscribers should:

- Handle missing or partial payload data safely.
- Avoid long blocking work inside an event callback.
- Remove subscriptions during cleanup.
- Avoid throwing errors that break unrelated listeners.

## Storage

The Framework storage service saves arbitrary values by key.

Typical uses include:

- Saved window position.
- Cached feature data.
- User-created presets.
- Last selected tab.
- Module-specific history.

Use a clear key namespace to prevent collisions.

Example:

```text
module:example:presets
module:example:lastTarget
window:example-main
```

## Primary and fallback storage

The preferred storage is Chrome extension storage.

If it fails during the current session, the Framework can switch to local storage and report the problem.

The fallback keeps basic functionality available, but developers should not silently ignore the failure. Storage limits, browser settings, or extension permissions may need attention.

## Settings

Settings are configuration values with known defaults and expected types.

The Framework has its own settings. Each module may also declare its settings schema.

A module setting definition must include a default value.

Supported setting types include:

```text
boolean
number
string
array
object
```

Example manifest section:

```json
{
  "settings": {
    "refreshInterval": {
      "default": 30,
      "type": "number"
    },
    "showNotifications": {
      "default": true,
      "type": "boolean"
    }
  }
}
```

The scoped module-settings service prevents modules from needing to manually construct every settings path.

## Enabled state

The Module Manager stores whether a module is enabled.

The setting path is based on the module's settings key or ID.

That lets the Framework restore the chosen state after a refresh.

## Storage versus settings

Use settings for values that configure behavior.

Examples:

- Refresh interval.
- Enable sound.
- Show advanced details.
- Preferred sort order.

Use storage for feature data.

Examples:

- Saved formation.
- Cached report.
- User-created list.
- Exported snapshot.

The technical storage layer may be similar, but the meaning is different.

## Data migration

The Framework includes storage migration support so saved information can be updated when a data format changes.

A module that changes its saved-data structure should provide a clear migration path or deliberately reset incompatible old data.

## Safe data practices

Modules should:

- Store only what they need.
- Avoid storing secrets.
- Use clear versioned formats.
- Validate values after reading them.
- Handle missing values.
- Provide defaults.
- Avoid treating cached game information as permanently current.
- Remove obsolete data when appropriate.

## Events and storage together

A common pattern is:

```text
User changes a setting
        ↓
Module settings service validates and saves it
        ↓
Settings-changed event is emitted
        ↓
Module refreshes its active behavior
```

This separates saving the choice from reacting to the choice.

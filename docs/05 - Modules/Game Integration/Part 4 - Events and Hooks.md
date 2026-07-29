# Game Integration — Part 4: Events and Hooks

## Implemented

- One central game-state monitor
- Shared cache invalidation
- City-change events
- World-change events
- Alliance-change events
- Selection-change events
- Battle-entered events
- Battle-exited events
- Duplicate-safe hook registry
- Managed observer registry
- Central public API exposure

## Architectural rule

Individual modules must not run independent timers to detect game-state changes.
They subscribe to the central event bus instead.

```javascript
const unsubscribe = context.events.on(
  'game:city-changed',
  ({ city }) => {
    // Module-specific reaction.
  }
);
```

Subscriptions made through `context.events` are cleared when the module is disabled. Modules should use `context.hooks` or `context.observers` for other managed integration resources so shutdown and replacement remain deterministic.

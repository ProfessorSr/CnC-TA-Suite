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
const unsubscribe = context.eventBus.on(
  Events.CITY_CHANGED,
  ({ city }) => {
    // Module-specific reaction.
  }
);
```

Modules should register cleanup callbacks with `context.hooks` or
`context.observers` so shutdown and replacement remain deterministic.

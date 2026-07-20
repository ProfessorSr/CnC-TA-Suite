# Events

> Status: Implemented for v0.4.0

The central `EventBus` publishes suite, game, settings, theme, window, and module lifecycle events. Names use lowercase colon-separated namespaces such as `game:city-changed` and `module:started`.

Modules should subscribe and emit through `context.events`; those subscriptions are tracked and cleared on disable. Payloads are objects and should include identifiers rather than undocumented positional arguments. Listener failures are isolated and recorded in EventBus diagnostics. State monitors publish changes centrally so individual modules do not create competing poll loops. See `06 - Reference/Event Reference.md` for the event catalog.

# Event Reference

> Status: Implemented for v1.0.0

Events use object payloads and lowercase colon-separated names.

- Suite: `suite:bootstrap-started`, `suite:ready`, `suite:error`.
- Discovery: `game:discovery-started`, `game:discovered`, `game:compatibility-checked`, `game:ready`, `game:error`.
- Recovery/monitor: `game:connection-lost`, `game:connection-restored`, `game:state-initialized`, `game:tick`.
- State: `game:player-changed`, `game:city-changed`, `game:world-changed`, `game:alliance-changed`, `game:selection-changed`, `game:battle-entered`, `game:battle-exited`.
- Infrastructure: `settings:changed`, `theme:changed`, `window:opened`, `window:closed`.
- Modules: `module:registered`, `module:loaded`, `module:started`, `module:stopped`, `module:unloaded`.

Lifecycle payloads include the relevant `id`; settings payloads include `path` and `value`; error events include `error`. State payloads are service snapshots and may evolve compatibly. Modules should use `context.events` so subscriptions are cleared on disable.

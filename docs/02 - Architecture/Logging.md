# Logging

> Status: Implemented for v1.0.0

The shared logger supports `debug`, `info`, `warn`, and `error` levels and prefixes messages with the suite and child scope. Core creates child loggers for services; `ModuleContext` creates `Module:<id>` scopes.

Use debug for discovery detail, info for completed state transitions, warn for recoverable degradation, and error for failed requested behavior. Error objects should be passed separately so stacks remain available. Never log storage credentials, authentication tokens, private messages, or unnecessary player data. The active threshold comes from `general.logLevel`.

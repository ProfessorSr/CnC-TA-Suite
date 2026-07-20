# Settings

> Status: Implemented for v0.4.0

`SettingsService` loads the `settings` object, merges defaults, validates the fixed core schema, and restores defaults if validation fails. Paths use dot notation. Core module enabled states are booleans under `modules.<settingsKey>`.

Manifest settings are registered by `ModuleSettings`, stored under `moduleSettings.<moduleId>.<key>`, and validated for boolean, number, string, array, or object type plus supported enum/min/max constraints. Modules access them through `context.moduleSettings`. Changes are persisted before `settings:changed` is emitted. Schema evolution must include a migration or a compatible default.

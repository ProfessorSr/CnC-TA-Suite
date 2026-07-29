# Declarative Modules

> Status: Active, incremental adoption

Declarative modules define common UI structure as data and retain ordinary JavaScript for business logic. The framework lives under `core/ui/declarative/`.

A definition contains:

- a versioned module manifest and settings schema;
- window title, icon, size, position, and tabs;
- toolbar actions;
- data providers;
- text, status-list, generated-settings, or custom controls;
- action handlers.

`DeclarativeModule` supplies the standard open, refresh, reuse, and close lifecycle. `DeclarativeRenderer` creates native Qooxdoo controls, binds providers, displays loading/empty/error states, measures module opening through the existing profiler, and persists generated settings through `ModuleSettings`.

Use `custom` controls only for genuinely specialized content. The custom renderer receives the module context, owner, and renderer, and must return a Qooxdoo widget. War Room formations, world maps, Scanner results, and native game integrations remain valid custom implementations.

## Adoption policy

Every registered module adopts the versioned UI-definition contract. Suite Status and Hotkeys use fully generated controls. Specialized modules use the custom-renderer bridge: their definitions still publish their manifest, settings, standard state provider, actions, tabs, and renderer type, while their proven Qooxdoo bodies remain intact. `ModuleManager.open()` dispatches custom modules through the definition action, so no registered module bypasses the contract.

Do not rewrite a stable specialized window solely to increase generated-control coverage. New conventional settings, status, table, or form windows should use the declarative renderer directly.

Definitions are validated before module construction. Unsupported controls, missing tab identifiers, and malformed toolbar actions fail early during module registration or tests.

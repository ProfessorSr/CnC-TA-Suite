# Development Rules and Best Practices

## 1. Treat code as the source of truth

Documentation must describe the current code.

When behavior changes:

1. Change the code.
2. Change or add tests.
3. Update the related documentation.
4. Update the correct version and changelog.

Do not change documents to describe a planned behavior as though it already exists.

## 2. Do not edit generated files

Do not manually edit:

```text
core/modules/moduleCatalog.generated.js
dist/chrome/
```

Change the source, then run the build.

## 3. Keep feature logic out of core

A new feature does not become Framework code merely because it is useful.

Move behavior into core only when it is a stable shared capability suitable for unrelated modules.

## 4. Use public services

Prefer:

```text
context.game
context.hub
context.events
context.windows
context.storage
```

over:

- Random ClientLib lookups.
- Imports from another module's private files.
- Direct modification of Framework registries.
- Untracked global listeners.

## 5. Validate at boundaries

Validate data when it enters the module.

Examples:

- Manifest input.
- Hub snapshot.
- Stored values.
- User-entered settings.
- Native simulation result.
- Game-object discovery result.

Do not wait until invalid data reaches the final display.

## 6. Separate calculations from UI

A calculation should be testable without opening a Qooxdoo window.

The window collects user input and displays results. The calculation module produces results.

This makes testing faster and prevents visual changes from breaking core logic.

## 7. Separate analysis from action

A module may read, calculate, preview, recommend, and act. These are not the same operation.

Use explicit steps:

```text
Read data
    ↓
Calculate result
    ↓
Show preview
    ↓
User confirms
    ↓
Perform action
    ↓
Report result
```

Important game actions should not happen merely because a window refreshed.

## 8. Use least permissions

Every additional permission increases coupling.

Request only the capabilities used by the released code.

## 9. Make empty and error states useful

Do not leave a blank window when data is unavailable.

State the reason:

- Waiting for game data.
- No base selected.
- Module dependency disabled.
- Incompatible game build.
- Stored data could not be read.
- Action is not available in the current view.

## 10. Clean up everything

Track:

- Timers.
- Event subscriptions.
- Hooks.
- Observers.
- Windows.
- Cached references.
- Temporary controls.
- Pending promises where cancellation is possible.

A disabled module should actually become inactive.

## 11. Keep logs useful

A good error log includes:

- Module ID.
- Operation.
- Relevant non-sensitive state.
- Original error.
- Whether the Framework can recover.

Avoid logging secrets, complete private messages, authentication data, or unnecessary user information.

## 12. Test unknown and missing data

The live game is not a perfect test fixture.

Test:

- `null`
- `undefined`
- empty lists;
- unknown build;
- missing method;
- delayed readiness;
- stale snapshot;
- storage failure;
- module dependency missing;
- permission denied.

## 13. Preserve module independence

A module should be installable, updatable, disabled, and removable without editing unrelated modules.

## 14. Keep versions honest

Do not set every module to the Framework version.

Update the component that changed.

## 15. Keep release packages clean

Public packages should not include:

- Git history unless intentionally distributing a repository.
- Operating-system metadata.
- old ZIP files;
- private notes;
- test credentials;
- temporary debug output.

## 16. Use comments for decisions, not narration

Bad:

```javascript
// Add one to i
i++;
```

Useful:

```javascript
// Keep the cached snapshot for one refresh cycle because the
// game replaces the selection object during base transitions.
```

## 17. Prefer boring, predictable APIs

Public Framework APIs should be easy to understand and difficult to misuse.

Clever shortcuts are not valuable if every module must study the implementation to use them safely.

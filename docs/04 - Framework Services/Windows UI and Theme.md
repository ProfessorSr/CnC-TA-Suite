# Windows, UI, and Theme

## Native-style interface

The Framework uses Qooxdoo, the same user-interface system used by the game.

This allows Suite windows to behave more like game windows and less like unrelated HTML panels placed over the page.

## Window Manager responsibilities

The shared Window Manager handles behavior that would otherwise be repeated in every module.

A window request includes values such as:

```text
id
title
content
x and y position
width and height
resizable
singleton
compact size
auto-hide
pinnable
lockable
size revision
```

## Window ID

Every managed window needs an ID.

The ID is used to:

- Find an existing window.
- Prevent duplicate singleton windows.
- Store position and size.
- Close the correct window.
- Connect help information.
- Track runtime state.

Use stable IDs. Changing a window ID may cause old saved position data to stop matching.

## Singleton windows

Most Suite windows are singletons.

When a singleton is already open, calling `open()` again should:

- Bring the existing window forward.
- Mark it active.
- Focus it.
- Return the existing window record.

It should not create another copy.

## Saved position and size

When `windows.rememberPositions` is enabled, the Framework can save:

- X position.
- Y position.
- Width.
- Height.
- Compact state.
- Pinned state.
- Locked state.
- Auto-hide state.
- Size revision.

A module may use a size revision when a new release changes the expected window layout. This lets the Framework ignore an old incompatible saved size while still keeping deliberate persistence under control.

## Pinning

Pinned windows may stay above other windows.

This is useful for small status panels but should not be abused. Too many pinned windows can cover important game controls.

## Locking

A locked window cannot be moved accidentally.

The user can place a window where it belongs and then lock it.

## Compact mode

Compact mode gives a window a smaller size for quick monitoring.

The module should ensure the compact layout remains usable rather than simply cutting off half of the normal window.

## Help links

The Window Manager can add contextual help information for registered windows.

Module-specific help should point to that module's own documentation.

## UI helpers

The Framework provides shared helpers for:

- Components
- Controls
- Dialogs
- Context menus
- Toolbars
- Top-bar integration
- Declarative windows

Using shared helpers keeps behavior and wording consistent.

## Declarative modules

A declarative module describes its presentation through a definition.

A valid definition includes:

- `manifest.id`
- `window.title`
- a list of tabs;
- valid controls;
- valid toolbar actions.

Supported basic control types currently include:

```text
text
status-list
settings
custom
```

A custom control must provide a render function.

The normalized declarative window receives sensible defaults such as size, position, resize support, and singleton behavior.

## Theme

Shared theme files provide:

- Colors.
- Fonts.
- Icons.
- Spacing.
- Combined theme access.

A module should use those values where practical. A consistent interface reduces the learning curve because the same visual meaning appears throughout the Suite.

## UI design rules

A good module window should:

- Use a clear title.
- Explain empty states.
- Show whether data is live, cached, or unavailable.
- Disable actions that cannot currently work.
- Require confirmation for important changes.
- Avoid hiding errors in the console only.
- Close cleanly when the module is disabled.
- Reuse the existing window when reopened.
- Match the game's visual language.
- Keep calculations outside the display code when possible.

## What the Framework cannot guarantee

Qooxdoo widgets still run inside the live game client. A game update may change themes, parents, or widget behavior.

The Framework provides a common adaptation point, but live testing remains necessary.

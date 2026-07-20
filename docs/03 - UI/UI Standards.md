# UI Standards

> Status: Implemented baseline for v0.4.0

## Native UI rule

User-facing in-game interface elements should use the game's Qooxdoo widget system. Do not create a second DOM-based window or control framework for suite features.

## Service usage

- Use `context.windows` for windows.
- Use `context.notifications` for transient messages.
- Use `context.ui.dialogs` or the dialog service for modal interactions.
- Use `context.ui` components and controls for shared widgets.
- Use core top-bar registration instead of implementing a top-bar module.

## Layout

Use Qooxdoo layouts (`VBox`, `HBox`, `Grid`, `Grow`) and explicit flex behavior. Avoid absolute positioning except where required for windows and popups.

## Ownership and cleanup

Every widget, listener, and timer must have a clear owner. Destroy owned widgets and remove listeners during disable, close, or service destruction.

## Theme

Prefer native game appearances and readable foreground colors. Custom CSS should be limited to the browser bridge or cases not supported by Qooxdoo.

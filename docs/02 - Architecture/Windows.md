# Windows

> Status: Implemented for v1.0.0

Suite windows use native `qx.ui.window.Window` widgets and are owned by `WindowManager`.

## Responsibilities

- singleton handling;
- title, size, position, and content setup;
- native moving and resizing;
- optional geometry persistence;
- event publication;
- listener and timer cleanup;
- destruction when closed.

## Content contract

Window content must be a Qooxdoo widget or a string converted to a wrapped label. Raw HTML elements are not accepted.

## Persistence

When `windows.rememberPositions` is enabled, geometry is stored under `window:<id>`. Move and resize writes are debounced.

## Ownership

The manager owns the window widget after opening it. Modules should close windows through the returned record or window service and should not maintain parallel DOM containers.

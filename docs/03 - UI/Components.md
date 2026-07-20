# Components

> Status: Implemented baseline for v0.4.0

Core provides Qooxdoo buttons and status rows, form controls, toolbars, context menus, dialogs, notifications, top-bar links, and managed windows. Components return Qooxdoo widgets, never HTML elements, when used inside `WindowManager`. Callers own standalone widgets unless a manager takes ownership. Event listeners and timers must be removed or destroyed with the owning module/window. Prefer shared constructors so behavior, labels, and cleanup remain consistent.

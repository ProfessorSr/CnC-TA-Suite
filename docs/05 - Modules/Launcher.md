# Launcher

> Status: Implemented, on demand

Launcher is a compatibility module that opens a small native Qooxdoo window and can demonstrate shared notifications. It no longer opens during page startup and is not a primary navigation surface. Users may open it from Module Manager while enabled. `start()` intentionally performs no UI work; `open()` delegates to `WindowManager`, which owns singleton behavior, geometry, and cleanup. New features should normally be linked from Module Manager rather than added to Launcher.

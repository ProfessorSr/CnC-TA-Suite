# Core

> Status: Implemented for v0.4.0

Core owns cross-cutting infrastructure: bootstrap, browser storage, settings, events, logging, native UI, windows, diagnostics, game integration, the normalized Game Data Hub, hooks, observers, and the module runtime. `createApplication()` composes these services into one application context.

Feature modules may depend on core only through public contracts and granted `ModuleContext` capabilities. Core must not contain feature behavior or manually import individual modules; the generated catalog is the sole composition boundary. Services should be independently testable, avoid hidden globals except game/runtime discovery, and expose explicit cleanup where they own external resources.

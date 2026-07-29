# Glossary

## API

Application Programming Interface. A documented contract that allows one part of the system to use another part without depending on private implementation details.

## Bootstrap

The earliest Framework startup process. It loads and prepares the core system.

## Build

The process that collects source files and produces the browser-loadable `dist/chrome` extension.

## Cache

Temporarily stored information used to avoid repeating expensive work. Cached information may become stale and needs refresh rules.

## Chrome Manifest V3

The browser-extension format used by the Chrome build.

## ClientLib

Internal game-client objects used by Command & Conquer: Tiberium Alliances. Their internal structure may change between builds.

## Compatibility

Whether two parts can work together, such as a module and the Suite API or the Framework and a live game build.

## Context

The object given to a module containing its identity and allowed Framework services.

## Control module

A required module used to display or manage the Framework itself. Suite Dashboard, Module Manager, and Suite Status are control modules.

## Declarative module

A module whose window and controls are described through a validated definition rather than built entirely by custom window code.

## Dependency

Another module that must be available before a module can work.

## Diagnostics

Health, state, logs, performance, and compatibility information used to understand the running Framework.

## Event

A named message announcing that something happened.

## Event bus

The shared service that delivers events from publishers to subscribers.

## Feature module

A separately versioned module that provides a gameplay or analysis feature.

## Framework

The stable core platform that starts the Suite, provides shared services, and manages modules.

## Game Data Hub

A Framework service that publishes normalized snapshots of game information through a versioned contract.

## Game build

A deployed version of the live game client. Different builds may expose internal objects differently.

## Hook

Managed code attached to an existing behavior so the Framework or module can react to it.

## Hub API

The versioned shape and rules of Game Data Hub snapshots.

## Lifecycle

The ordered stages through which a module is initialized, loaded, enabled, disabled, unloaded, and destroyed.

## Manifest

A module's identity and requirements file, including versions, dependencies, permissions, and settings.

## Module

A separate package of functionality loaded and managed by the Framework.

## Module catalog

The generated list of module classes included in the current build.

## Module Manager

The required control module that lists, enables, disables, and opens installed modules.

## Module state

The Framework's current lifecycle label for a module, such as registered, enabled, disabled, or error.

## Observer

Managed code that watches an object or condition for changes.

## Permission

A declared Framework capability a module requests, such as storage, windows, game data, or diagnostics.

## Qooxdoo

The user-interface framework used by the game and by CnC-TA Suite windows.

## Registry

A managed collection that stores objects or services by stable identifiers.

## Semantic versioning

The `major.minor.patch` version format.

## Service

A reusable capability created by the Framework and shared with allowed modules.

## Singleton window

A window that may have only one active instance. Reopening it focuses the existing instance.

## Snapshot

A normalized picture of known game or diagnostic state at a particular time.

## Storage

The Framework service used to save and retrieve data.

## Suite API

The public Framework contract used by modules.

## Suite Dashboard

The required control module that provides a general Framework and module overview.

## Suite Status

The required control module that displays Framework health, compatibility, performance, and lifecycle diagnostics.

## Theme

Shared colors, fonts, icons, and spacing used to keep module interfaces consistent.

## Unpacked extension

A browser extension loaded directly from a folder rather than installed from an extension store.

## Window Manager

The Framework service that creates, tracks, saves, focuses, and closes Suite windows.

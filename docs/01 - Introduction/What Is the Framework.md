# What Is the Framework?

## The basic idea

CnC-TA Suite Framework is a modular browser-extension platform for **Command & Conquer: Tiberium Alliances**.

The word *modular* means the project is divided into separate parts. The Framework handles the common work. Modules add individual features.

Without a framework, every script must solve the same problems for itself:

- How to wait for the game to load.
- How to access the game client safely.
- How to open a window that matches the game.
- How to store settings.
- How to report errors.
- How to react when the selected base changes.
- How to enable or disable a feature.
- How to clean up listeners and timers.
- How to remain compatible with different game builds.

That creates duplicated code. It also makes a script harder to repair because every feature becomes responsible for everything around it.

The Framework solves those repeated problems once and provides the results as shared services.

## What the Framework does

The Framework is responsible for the system around the modules.

It:

- Starts when the supported game page opens.
- Injects the Suite into the page at the correct time.
- Waits for the game client and Qooxdoo user interface to become ready.
- Detects the available game environment.
- Creates shared storage, settings, event, window, logging, diagnostic, and game-data services.
- Discovers modules from the generated module catalog.
- Reads and validates module information.
- Checks module dependencies.
- Checks requested permissions.
- Checks Suite API and Hub API compatibility.
- Loads modules in the correct order.
- Tracks module lifecycle state.
- Allows modules to be enabled, disabled, opened, unloaded, and cleaned up.
- Tries to prevent one failing module from taking down the entire Framework.

## What the Framework does not do

The Framework is not intended to contain every gameplay feature.

It does not need to know how an attack planner calculates a formation, how a scanner filters targets, or how an upgrade tool chooses a building. Those decisions belong inside the feature module that provides them.

The Framework should remain useful even if every optional gameplay module is removed.

That separation matters because it allows the Framework and modules to improve at different speeds. A module may receive ten updates while the Framework remains on the same stable version. Another module may be removed without changing the Framework at all.

## Why the Framework can run without optional modules

The Framework creates its own core services before it loads feature modules.

That means its basic health does not depend on a particular gameplay feature. When no optional modules are installed, the Framework can still:

- Start.
- connect to the game environment;
- maintain settings and storage;
- expose its internal services;
- report diagnostics;
- display its required control modules;
- discover that no additional modules are present;
- remain ready for modules to be added later.

This is a deliberate design requirement, not an accident.

## The three required control modules

The release includes Suite Dashboard, Module Manager, and Suite Status. They are technically modules because they use the same module system as everything else. However, their purpose is to operate and display the Framework itself.

They are closer to the Control Panel, Settings app, and System Information window of an operating system than they are to ordinary applications.

This provides two benefits:

1. The same module rules are tested by the Framework's own interface.
2. Core control windows can be changed without placing all of their code directly inside the bootstrap process.

## How information moves through the Framework

The expected data path is:

```text
Game client
    ↓
Shared game services and Game Data Hub
    ↓
Module calculations and decisions
    ↓
Qooxdoo user interface
```

Modules should normally read game information through the shared services and Hub instead of reaching directly into the game client from their user-interface code.

This creates a cleaner boundary. If the game changes an internal object name, the Framework can update the shared adapter instead of requiring every module window to be rewritten.

## A practical example

Imagine that three modules need the player's current base.

Without the Framework, all three modules might contain different code for locating that base. One script may work while another fails after a game update.

With the Framework, the base information is normalized once and published through a shared service. All three modules ask the Framework for the same information.

The feature code stays focused on its real job.

## The most important rule

The Framework provides the platform. Modules provide the features.

Keeping that rule clear prevents the project from turning back into one giant script where every change can affect everything else.

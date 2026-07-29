# Startup Process

## Why startup is more complicated than “run the script”

The game page does not make every object available at the same moment.

The browser document begins loading first. The game code loads afterward. Qooxdoo becomes available. The game application creates its user interface. ClientLib objects appear. The player session and selected base become ready.

If a module tries to use those objects too early, it fails even though the same code would work a few seconds later.

The Framework therefore uses a coordinated startup process.

## High-level flow

```text
Browser opens supported game page
                ↓
Chrome content bridge runs
                ↓
Suite loader is inserted into the page
                ↓
Framework bootstrap begins
                ↓
Wait for game and Qooxdoo readiness
                ↓
Create Framework services
                ↓
Start game integration and compatibility checks
                ↓
Register discovered modules
                ↓
Resolve dependencies and permissions
                ↓
Load and enable allowed modules
                ↓
Framework reports ready
```

## Step 1: Chrome content bridge

The Chrome manifest loads:

```text
manifest/chrome/bridge.js
```

at `document_start`.

The content-script environment is separated from the page's JavaScript environment. The bridge allows the extension to place the Suite loader into the page where it can work with the game's JavaScript objects.

## Step 2: Suite loader

The loader brings in Framework source files in the required order.

Ordering matters because some classes depend on other classes being available first. The bootstrap layer coordinates this instead of asking each module to inject its own dependencies.

## Step 3: Readiness checks

The Framework checks whether the required environment exists.

Typical readiness checks include:

- The Qooxdoo namespace exists.
- The game application exists.
- A desktop or root widget can be found.
- ClientLib is available.
- Required game objects can be discovered.
- The game UI has reached a usable state.

Waiting is not the same as freezing. The Framework probes until the required conditions are met or a failure path is reached.

## Step 4: Create the application context

The application context is the collection of shared Framework services.

It may contain:

- Logger
- Event bus
- Storage
- Settings
- Theme
- Windows
- Notifications
- Hooks
- Observers
- Game integration
- Game Data Hub
- Module Manager
- Diagnostics

Modules do not receive the full application context directly. The Framework creates a scoped `ModuleContext` for each module based on its declared permissions.

## Step 5: Start game integration

The Framework discovers the game environment and normalizes it behind shared services.

This includes services for areas such as:

- Player
- Bases and cities
- World
- Alliance
- Selection
- Battle objects
- Compatibility
- Caches
- Game-state monitoring
- Game Data Hub

The goal is to reduce direct ClientLib access throughout module code.

## Step 6: Discover modules

The source build generates a catalog by scanning the `modules` directory.

The generated file imports each discovered module class and exports the ordered list used by the Framework.

Because this happens during the build, the browser does not need to scan folders at runtime.

## Step 7: Register modules

Registration validates the module manifest and records the module.

During registration the Framework:

- Normalizes the manifest.
- Confirms the ID format.
- Confirms semantic versions.
- Checks Suite API compatibility.
- Checks Hub API compatibility.
- Registers permissions.
- Registers module settings.
- Adopts declarative presentation information when present.
- Sets the initial module state to `registered`.
- Emits a module-registered event.

## Step 8: Resolve dependencies

A module may list other module IDs in its `dependencies` array.

The dependency resolver determines a safe loading order. A dependency must load before the module that requires it.

Missing dependencies and dependency cycles should be reported instead of guessed around.

## Step 9: Lifecycle calls

The Framework calls lifecycle methods in a defined order.

The base contract describes:

```text
initialize → load → enable → disable → unload → destroy
```

Not every module must implement every method. Empty lifecycle methods are allowed.

The manager tracks module states such as:

```text
registered
loaded
enabled
disabled
unloaded
error
```

## Step 10: Ready state

When core startup and module loading complete, the Framework can report itself ready.

A ready Framework does not mean every optional feature is installed. It means the core environment is operating and the installed compatible modules have been handled.

## Why this process matters

Central startup prevents every module from inventing its own wait loops, injection steps, and readiness guesses.

That makes failures easier to understand. Instead of “the button did nothing,” Suite Status can show whether the problem occurred during game discovery, compatibility detection, service startup, module registration, or module enablement.

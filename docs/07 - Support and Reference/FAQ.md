# Frequently Asked Questions

## Is CnC-TA Suite one giant script?

No. The Suite is a Framework plus separate modules.

## Can the Framework run without optional gameplay modules?

Yes. That is a core design requirement.

## Why are three modules included in the Framework release?

Suite Dashboard, Module Manager, and Suite Status are the Framework's control interface. They make the Framework visible and manageable.

## Are those three modules the same version as the Framework?

No. Every module has its own version.

## Does Framework 1.1.0 require all modules to be 1.1.0?

No.

## Where should War Room documentation live?

Inside the War Room module package or folder.

## Where should Scanner documentation live?

Inside the Scanner module package or folder.

## Should Framework docs list every feature module?

No. They may use generic examples, but feature documentation belongs with the feature.

## What is the Suite API?

It is the public Framework contract used by modules.

## What is the Hub API?

It is the versioned data contract for normalized Game Data Hub snapshots.

## Why are both API versions needed?

A module may depend on Framework services and on a particular Hub data shape. Those are related but separate contracts.

## What happens when a module requests an incompatible API?

Manifest validation fails and the Framework should report the compatibility problem.

## What happens when a dependency is missing?

The module should not load as though everything were normal. The dependency resolver reports the missing requirement.

## What happens when a module crashes?

The Framework records an error and attempts to continue operating other modules where possible.

## Does that guarantee a module cannot break the game page?

No. All module code still runs in the page environment. Install only trusted code.

## Are module permissions a security sandbox?

No. They are an application-level access contract and review tool.

## Why use Qooxdoo instead of ordinary HTML overlays?

Qooxdoo matches the game's native interface and allows Suite windows to behave consistently with the game client.

## Can a module open more than one copy of a window?

Yes when designed as non-singleton, but most control and feature windows should use singleton behavior.

## Why does the Framework save window position?

It allows the user's workspace to remain organized between sessions.

## Where are settings stored?

The Framework prefers Chrome extension storage and can use local storage as a session fallback if primary storage fails.

## Should modules access ClientLib directly?

Normally they should use shared game services or the Hub. Direct ClientLib access should be limited, justified, and kept away from presentation code.

## Why is live testing needed when unit tests pass?

The live game client is obfuscated and may change by deployed build. Automated tests cannot reproduce every live environment detail.

## How is a new module added to the build?

Place it under `modules/` with a discoverable exported module class, then run the build. The catalog is generated automatically.

## Can I edit the generated catalog?

Do not. Edit source modules and regenerate it.

## Can I edit `dist/chrome`?

Do not make permanent changes there. It is build output and will be replaced.

## How do I know what failed?

Use Module Manager, Suite Status, logs, diagnostics, and the module's own error display.

## Should modules perform active work in their constructor?

No. Active work belongs in lifecycle methods after Framework readiness.

## Why must modules clean up on disable?

Otherwise listeners, timers, windows, and hooks may keep running or duplicate when the module is enabled again.

## Can modules communicate with each other?

Yes, but they should use declared dependencies, shared services, or documented events instead of importing private implementation files.

## Does a higher module version mean it is better?

No. It only describes that module's release history.

## Can Framework documentation be updated without a code release?

Yes, when correcting explanations that do not change behavior. The documentation should still clearly identify what code version it describes.

## What is the defining source when docs and code disagree?

The code is the defining source. The docs need to be corrected.

## Does Framework compatibility mean a module is approved under game rules?

No. Technical compatibility and game-rule compliance are different questions. Each module must document and review its own behavior.

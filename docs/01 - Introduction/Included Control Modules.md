# Included Control Modules

## Why are there modules in a Framework-only release?

CnC-TA Suite Framework v1.1.0 is designed to work independently from optional gameplay modules. However, the release includes required control modules so the user can see, manage, and verify the Framework.

These are:

1. Suite Dashboard
2. Module Manager
3. Suite Status

They are built through the same public module system used by future feature modules. This is useful because the Framework tests its own module architecture during ordinary use.

They should be understood as part of the Framework control surface, not as bundled gameplay features.

---

## Suite Dashboard

**Module ID:** `launcher`  
**Displayed name:** Suite Dashboard  
**Module version:** `0.2.0`  
**Required Suite API:** `1.0.0`

The Suite Dashboard is the main overview window.

Its purpose is to give the user a readable summary of the current Suite environment, including Framework information, module information, base information, update status, and dependencies.

The Dashboard requests these permissions:

```text
game
modules
windows
```

That allows it to read Framework-provided game status, inspect registered modules, and open its window.

The Dashboard does not need to own the underlying services. It reads them through the scoped module context.

The module is available on demand. Opening it again focuses the existing singleton window rather than creating duplicate copies.

---

## Module Manager

**Module ID:** `module-manager`  
**Displayed name:** Module Manager  
**Module version:** `0.1.0`  
**Required Suite API:** `1.0.0`

The Module Manager is the control center for installed modules.

It can:

- List registered modules.
- Show module states.
- Enable a module.
- Disable a module.
- Open a module that provides an `open()` action.
- Save enabled or disabled state through Framework settings.
- Display notifications through Framework services.

Its requested permissions are:

```text
modules
settings
windows
notifications
```

The Module Manager uses the same public module controls that other parts of the Suite can use. It does not require private knowledge of a feature module's internal code.

When disabled or unloaded, it closes its own window and clears its stored context.

---

## Suite Status

**Module ID:** `suite-status`  
**Displayed name:** Suite Status  
**Module version:** `0.2.0`  
**Required Suite API:** `1.0.0`  
**Required Hub API:** `1.0.0`

Suite Status provides technical health and diagnostic information.

It is intended to answer questions such as:

- Did the Framework start?
- Is the game integration ready?
- Is the detected game build considered compatible?
- Are the integration monitors running?
- Did the event bus record failures?
- What lifecycle states are the modules in?
- What do the current logs report?
- Is the Game Data Hub producing a valid snapshot?
- Are there performance warnings?

It requests:

```text
diagnostics
windows
```

The diagnostic service can create a support bundle that redacts values whose names appear sensitive, including tokens, passwords, email fields, authentication fields, cookies, sessions, and similar information.

A support bundle should still be reviewed before it is shared. Automatic redaction reduces risk, but it is not a promise that every possible private value can be identified.

---

## Why these modules have their own versions

Even required control modules are versioned independently.

The Framework may remain at `1.1.0` while Suite Dashboard changes independently. That does not make the Framework incomplete. It means the Dashboard changed without requiring a Framework API change.

The version relationships look like this:

```text
CnC-TA Suite Framework  1.1.0
Suite Dashboard         0.2.0
Module Manager          0.1.0
Suite Status            0.2.0
```

Each module declares the minimum compatible Suite API it expects. Suite API `1.0.0` modules remain compatible with Framework v1.1.0.

## What is not included

The Framework documentation should not assume that gameplay feature modules are installed.

Examples of separate feature modules may include:

- War Room
- Scanner
- Player Intelligence
- Alliance Intelligence
- Upgrade Manager
- Repair and Collection
- Layout tools
- Resource tools
- Alliance tools
- Report tools

The complete Suite distribution currently includes these feature modules, while the Framework contract continues to treat them as independent packages with their own versions and permissions.

Those modules belong in separate packages or folders and must carry their own documentation.

# Versioning and Compatibility

## Framework and module versions are independent

The Framework has its own version.

Every module has its own version.

They are not expected to match.

```text
Framework:       1.1.0
Suite Dashboard: 0.2.0
Module Manager:  0.1.0
Suite Status:    0.2.0
```

A module version tells you how that module has changed.

A Framework version tells you how the Framework has changed.

## Semantic versioning

Versions use:

```text
MAJOR.MINOR.PATCH
```

### Major

Increase the major number when compatibility is intentionally broken.

Example:

```text
1.4.2 → 2.0.0
```

A module written only for Framework API 1 may require changes for Framework API 2.

### Minor

Increase the minor number when adding compatible functionality.

Example:

```text
1.0.0 → 1.1.0
```

Existing modules should continue to work when the public contract remains backward compatible.

### Patch

Increase the patch number for compatible fixes.

Example:

```text
1.0.0 → 1.0.1
```

## Framework release version versus API version

The browser extension release has a version.

The public Suite API also has a version.

They may often move together, but they describe different things.

A Framework patch could fix packaging or internal diagnostics without changing the public module API.

Modules should declare the API contract they require, not merely copy the newest extension version number.

## Hub API version

The Game Data Hub has its own contract version.

A module that reads Hub snapshots declares:

```text
hubApiVersion
```

Framework v1.1.0 publishes Suite Module API `1.1.0` and Hub API `1.0.0`. Suite API v1.0.0 modules remain compatible because the v1.1.0 additions are backward-compatible.

## Compatibility policy

The Framework compares the module's declared API version against the supported API version.

A module is accepted only when the compatibility policy says the versions can work together.

The manifest validator reports a clear error such as:

```text
Module "example" requires Suite API X;
this Suite supports Y.
```

The same check is performed for Hub API compatibility.

## Module version does not decide compatibility

A module at version `5.0.0` is not automatically more compatible than a module at `0.2.0`.

Compatibility depends on the declared API requirement and actual use of the contract.

## Game build compatibility

Game-build compatibility is separate from module API compatibility.

A module may be compatible with Framework API 1.1.0 while the current live game build has changed an internal object the Framework cannot yet interpret.

Suite Status should display both kinds of information.

## Recommended module release fields

Each module release should state:

```text
Module version
Minimum/supported Suite API
Minimum/supported Hub API
Last updated date
Known game-build limitations
Required dependencies
Requested permissions
```

## When to change the Framework version

Change the Framework version when Framework code or packaging changes.

Increase the public API version when the module contract changes.

Do not change the Framework version merely because one optional module added a feature.

## When to change a module version

Change the module version when that module changes.

Examples:

- New screen.
- Calculation fix.
- New setting.
- Permission change.
- Saved-data migration.
- Compatibility update.
- Documentation correction tied to behavior.

## Release example

Framework remains stable:

```text
Framework 1.1.0
```

War Room receives several updates:

```text
War Room 0.8.0
War Room 0.8.1
War Room 0.9.0
```

Scanner receives one update:

```text
Scanner 0.5.0  saved layouts and CNCOpt export
Scanner 0.6.0  combined resource and silo-touch filters
```

No Framework release is required unless those modules need a changed Framework contract or the Framework itself is modified.

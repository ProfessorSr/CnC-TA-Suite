# Testing and Release Process

## Two kinds of testing

A Framework release needs:

1. Automated repository tests.
2. Live-game acceptance tests.

Neither replaces the other.

## Automated tests

Run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

### Unit tests

Unit tests check focused behavior such as:

- Manifest validation.
- Dependency ordering.
- Event delivery.
- Storage fallback.
- Settings validation.
- Module permissions.
- Module state.
- Compatibility logic.
- Game-data normalization.
- Window definitions.
- Diagnostics.
- Performance tracking.

### Integration tests

Integration tests check combined behavior such as:

- Module loading.
- Bootstrap expectations.
- Game integration contracts.
- Service registration.

## Build test

Run:

```bash
node scripts/build/build-extension.mjs
```

Confirm:

- The generated module count is correct.
- `dist/chrome` is recreated.
- The manifest is present.
- Core files are present.
- Required control modules are present.
- Optional modules appear only when installed in `modules`.
- No source-only metadata is copied unintentionally.

## Live-game acceptance

Load `dist/chrome` as an unpacked extension.

Test with a normal user session.

### Bootstrap

- [ ] Supported game page loads.
- [ ] Bridge injects without repeated errors.
- [ ] Framework waits correctly.
- [ ] Game readiness becomes true.
- [ ] Qooxdoo parent/root is found.
- [ ] Compatibility result is visible.

### Required control modules

- [ ] Suite Dashboard opens.
- [ ] Module Manager opens.
- [ ] Suite Status opens.
- [ ] Windows focus instead of duplicating.
- [ ] Enable/disable state works.
- [ ] State persists after refresh.
- [ ] Disabled windows close or stop correctly.

### Shared services

- [ ] Storage reads and writes.
- [ ] Settings defaults load.
- [ ] Event statistics remain healthy.
- [ ] Diagnostic snapshot succeeds.
- [ ] Hub snapshot validates.
- [ ] Window positions persist.
- [ ] Logs identify the correct module.

### Installed feature modules

Use each module's own acceptance checklist.

The Framework release should not claim that a feature module works merely because it registered.

## Framework-only independence test

Test the Framework with optional feature modules removed.

The required control modules should still load and Framework health should remain valid.

## Failure tests

Try controlled failure conditions in development:

- Invalid module ID.
- Invalid version.
- Unknown permission.
- Missing dependency.
- Dependency cycle.
- Incompatible API.
- Error during enable.
- Storage failure or denied access.
- Missing game object.
- Unknown game build.

The Framework should report a useful failure and continue where safe.

## Release preparation

1. Confirm working tree contents.
2. Remove local metadata from the release archive.
3. Run all tests.
4. Build from source.
5. Perform live acceptance.
6. Verify `VERSION`.
7. Verify `PART`.
8. Verify Chrome manifest version.
9. Update Framework changelog.
10. Update Framework docs.
11. Verify required control-module manifests.
12. Create the release package from the tested state.
13. Tag the exact source commit when using Git.

## Framework release contents

A Framework release should include:

- Framework core.
- Chrome manifest and loader files.
- Shared assets.
- Required control modules.
- Framework documentation.
- License and policy files as appropriate.
- Build or source files according to the selected distribution type.

Optional feature modules should be packaged and documented independently.

## Release naming

Use clear names, for example:

```text
CnC-TA-Suite-Framework-v1.0.0-source.zip
CnC-TA-Suite-Framework-v1.0.0-chrome.zip
example-module-v0.3.0.zip
```

Avoid one package name that makes it impossible to tell whether it contains Framework source, built extension files, or optional modules.

## After release

When a user reports a problem, collect:

- Framework version.
- Module version.
- Browser version.
- Game world/build information.
- Reproduction steps.
- Suite Status health.
- Redacted support bundle when appropriate.
- Console error text.
- Whether the problem remains with optional modules disabled.

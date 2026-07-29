# Contributing

CnC-TA-Suite accepts focused bug fixes, compatibility updates, tests, and
documentation improvements. Discuss large behavioral or architectural changes
before implementing them.

## Development requirements

- Keep ClientLib reads in the compatibility/game-integration layer and publish
  normalized data through the Game Data Hub.
- Use module permissions, tracked events, shared settings/storage, and native
  Qooxdoo window services.
- Preserve explicit confirmation for consequential user actions. Do not add the
  unattended automation excluded by `script_functions.md`.
- Add or update automated tests and Command Manual content with every affected
  module.
- Do not commit generated `dist/` output or edit the generated module catalog.

Before submitting a change, run:

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
node scripts/build/build-extension.mjs
git diff --check
```

Describe the game build/world used for any live-client validation. Never attach
credentials, cookies, tokens, private chat, or unredacted diagnostics.

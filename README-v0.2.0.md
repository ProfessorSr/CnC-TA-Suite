# CnC-TA-Suite v0.2.0 Core Foundation

This package is designed to be copied over the repository root.

## Installation for development

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the repository root containing `manifest/chrome/manifest.json`.

Because Chrome expects the manifest at the selected extension root, either:
- temporarily select the `manifest/chrome` directory after copying required resources there during development, or
- use the included build script to create a distributable extension directory.

## Build

Run:

```bash
node scripts/build/build-extension.mjs
```

Then load the generated `dist/chrome` directory as the unpacked extension.

# Security

> Status: Implemented baseline for v0.4.0

The content script is isolated from the page and exposes only a narrow `postMessage` storage channel. Page-context code can request get, set, remove, and clear operations; messages are accepted only from the same window and expected channel/direction. The extension requests Chrome `storage` and supported-game host access only.

Module permissions limit capabilities exposed through `ModuleContext`, but they are an architectural boundary rather than a hardened sandbox. Modules execute in page context and must be reviewed. Avoid `innerHTML`, remote code, dynamic evaluation, secrets in logs, and unvalidated external input. Rich Qooxdoo labels require trusted content. Report vulnerabilities through `SECURITY.md`.

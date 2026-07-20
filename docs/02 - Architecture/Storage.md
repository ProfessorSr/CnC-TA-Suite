# Storage

> Status: Implemented for v0.4.0

`StorageService` uses the Chrome storage bridge when available and falls back to local storage for development compatibility. The page bridge correlates asynchronous requests by ID and returns serializable results or error messages.

Reserved keys include `settings` and `window:<id>`. Callers should use service methods rather than browser globals, keep values JSON/structured-clone compatible, and handle rejected writes. `clear` affects suite storage and should be exposed only through deliberate recovery UI. Future incompatible key changes require migration through the storage migration layer.

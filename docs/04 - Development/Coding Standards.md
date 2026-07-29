# Coding Standards

> Status: Active

Use ES modules, descriptive camelCase identifiers, PascalCase classes, and uppercase constants. Prefer small services with injected dependencies and explicit ownership. Validate public inputs, throw actionable errors, and preserve original Error objects in logs. Await lifecycle work, make initialization idempotent, and clean up every listener, timer, widget, hook, and observer. Avoid direct ClientLib discovery in modules, raw DOM UI, mutable exported state, hidden fallbacks, and edits to generated catalogs. Behavioral changes require tests and documentation.

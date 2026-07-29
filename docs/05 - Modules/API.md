# API Module

> Status: Implemented as API Inspector

API Inspector is an optional, read-only native Qooxdoo view of the Suite's frozen public API; it is not the API itself. It displays Suite/game readiness, public service availability, cloned service snapshots, documented callable examples, diagnostic health, and exportable redacted diagnostics.

The inspector consumes `context.game`, `context.diagnostics`, and the read-only module catalog and requests only `game`, `diagnostics`, `modules`, and `windows` permissions. It does not evaluate arbitrary code, expose mutable ClientLib objects, or include credentials and known identity fields in diagnostic exports. The authoritative callable contract remains `06 - Reference/API Reference.md`.

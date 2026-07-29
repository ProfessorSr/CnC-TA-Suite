# Branching

> Status: Active

Use short-lived branches named `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, or `release/<version>`. Branch from the current mainline, keep changes focused, and rebase or merge according to repository policy before review. Release branches permit versioning, documentation, and release-blocking fixes only. Hotfixes branch from the affected release and must be merged back. Never commit generated `dist/` as a substitute for source changes.

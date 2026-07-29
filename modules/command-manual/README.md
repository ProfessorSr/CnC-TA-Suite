# Command Manual

Module ID and source directory: `command-manual`.

Command Manual is the Suite’s interactive help and onboarding center. It provides:

- contextual module help from the shared `? Help` button;
- searchable module, workflow, control, FAQ, troubleshooting, and glossary content;
- live installed-module version, state, and renderer metadata;
- module purpose, scenarios, quick starts, complete walkthroughs, expandable features, tips, related modules, and representative UI previews;
- Getting Started, New Player Guide, Keyboard Shortcuts, What’s New, and release guidance.

The curated content is stored in `manual-content.js`. Tests require every registered module to have a matching guide, preventing undocumented modules from entering the generated catalog.

# Themes

> Status: Implemented baseline for v0.4.0

In-game suite UI uses the active Qooxdoo game theme and native appearances. Core components create Qooxdoo widgets; windows enforce a white content foreground for readability. Custom colors, fonts, icons, and CSS tokens remain compatibility helpers and must not create a parallel visual system.

Prefer inherited appearances, semantic widget states, and native layouts. Any override must be scoped, maintain readable contrast, and be tested against supported game themes. `theme:changed` is reserved for suite theme-setting changes.

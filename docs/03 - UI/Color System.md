# Color System

> Status: Baseline for v0.4.0

Native game appearances are authoritative. Suite window content uses `#ffffff` foreground for readability; controls should inherit their Qooxdoo appearance. Success, warning, and error states must include text and may add green, amber, or red accents only when contrast is adequate. Avoid hard-coded backgrounds that conflict with the current game theme. Legacy tokens in `core/theme/colors.js` are compatibility helpers, not a separate theme contract.

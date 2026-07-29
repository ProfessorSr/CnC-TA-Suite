# Layout

> Status: Implemented baseline for v1.0.0

Use Qooxdoo `VBox` for vertical content, `HBox` for rows/actions, `Grid` for aligned data, and `Grow` for single flexible content. Apply flex to the element intended to absorb extra space. Variable lists belong in `Scroll`. Windows define usable initial dimensions and persist user geometry when enabled. Avoid absolute positioning except window placement and native popups. Test narrow viewports, long labels, translated text, and missing optional data.

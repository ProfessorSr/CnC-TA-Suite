# Base Layout Optimizer

Base Layout Optimizer v1.0.0 is an in-game, native Qooxdoo workspace for analyzing the currently selected owned base. It does not use CNCOpt or open an external browser page.

The module supports maximum Tiberium, Crystal, Power, balanced, and custom weighted goals; minimum storage; fixed buildings; replacement candidates; and move/replacement limits. It renders a compact native base grid inspired by the familiar 9-column attack-optimizer presentation, while using the full building area. Proposed moves are highlighted. It also reports current versus estimated production, expected gains, move/cost details, unmet constraints, and up to five ranked alternatives.

Replacement, addition, and upgrade entries are recommendations only. They are never bought, sold, placed, or upgraded automatically.

The isolated one-click building mover is experimental. It has a red warning panel and requires explicit confirmation every time because automated building movement may violate EA rules and may put an account at risk. Set `EXPERIMENTAL_ONE_CLICK_BUILDING_MOVES_ENABLED` to `false` in `layout-optimizer-window.js` to omit it from a production build without affecting analysis.

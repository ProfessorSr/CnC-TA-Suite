# Upgrade Manager

Native Qooxdoo planning and manual controls for owned-base upgrades.

The module inventories building, defense, and offense upgrade candidates through its isolated ClientLib hub. It shows next-level costs, affordability, resource shortfalls, and production ETA where the game exposes resource-growth data. Candidates can be filtered per category, base, type, affordability, target level, and resource-only policy, then ranked by productive, collector-heavy, power-heavy, lowest-cost, or highest-level strategies.

Manual controls upgrade the selected candidate, the highest-ranked candidate, all currently filtered eligible candidates by one tier, or all filtered eligible candidates toward a user-selected target level with one confirmation. Quick Upgrade defaults to one level above the lowest healthy eligible item. Upgrades only occur in direct response to a user action; the module does not automatically upgrade bases, buildings, defense, or offense. A capped activity log records those manual actions.

Building commands can target any owned base. ClientLib offense and defense upgrade APIs operate on the currently selected base, so the module reports that the relevant base must be selected rather than issuing an unsafe command against the wrong city.

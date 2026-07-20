# Optimizer

> Status: Implemented as bounded optimizers in War Room and Base Layout Optimizer

War Room searches bounded Quick, Detailed, and Exhaustive offensive formation sets. It generates whole-formation transforms, individual troop relocations, and swaps locally, deduplicates them, requests native battle outcomes, and ranks results against the selected CY, DF, CC, total-defense, or research/loot objective. A true one-shot result receives priority. The search reports progress and respects the native simulation cooldown.

Base Layout Optimizer evaluates a native-style 9-by-4 owned-base grid against Tiberium, Crystal, Power, balanced, or custom weighted goals. It supports fixed buildings, replacement eligibility, storage minimums, move/replacement limits, production comparisons, costs, conflicts, and ranked alternatives.

Both optimizers separate analysis from execution. Formation or building changes require an explicit, confirmed user action and never launch an attack. Data acquisition remains in shared Hub services.

# Icons

> Status: Baseline for v0.4.0

Prefer icons already provided by the game theme. Icon-only buttons must define tooltip and accessible-label text and retain a visible focus state. Do not use emoji as permanent navigation controls. Keep common control icons near the native game size and provide a text fallback when an icon resource is unavailable. New bundled artwork must have a documented license and live under `assets/`.

Every shortcut in the right-side Suite dock has a unique icon. Prefer the game's colored resource, alliance-bonus, combat-result, command-point, morale, target-range, and unit-category artwork when it communicates the action clearly. FactionUI paths continue to follow the active GDI/Nod theme. Automated coverage rejects duplicate right-dock icon assignments; live-game validation must still confirm that newly selected game resources exist in the current asset revision.

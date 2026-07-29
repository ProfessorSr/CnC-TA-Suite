# Context Actions

Context Actions v1.0.0 adds a configurable native Qooxdoo action group to the game menu shown when a base, camp, or outpost is selected.

Target menus can open Base Intelligence, War Room, target information, Scanner, layout viewing, or copy coordinates. Own-base menus can open Base Intelligence, Scanner, Repair & Collection Manager, Upgrade Manager, Base Layout Optimizer, Resource Transfer Manager, or copy coordinates. **Suite Options** opens the visibility settings directly from the contextual panel.

Strategic planning is performed directly from that native contextual panel; it
is not a separate Suite window. **Plan Move Base** enters the game's familiar
move-base placement view while replacing the final click with a local preview.
**Plan Ruin**, **Plan Ruin For**, **Plan Level Up**, and **Plan Remove** project
their results immediately on the region map. Contextual **Undo** and **Reset
Plans** controls appear while projected changes exist.

These previews alter only ClientLib's local world cache. They never submit an
attack, relocation, or other server command. Resetting, undoing, or disabling
the module restores the cached objects and marks affected sectors for a fresh
copy of the live world.

The module appends controls after the game creates its native menu and never removes native actions. Its `RegionCityMenu.showMenu` integration is registered as a reversible Suite hook and is restored when the module is disabled.

# Context Actions

Context Actions v0.4.1 adds a configurable native Qooxdoo action group to the game menu shown when a base, camp, or outpost is selected.

Target menus can open Player Intelligence, War Room, target information, Scanner, layout viewing, add/remove a custom Suite marker, or copy coordinates. Own-base menus can open Player Intelligence, Scanner, Repair & Collection Manager, Upgrade Manager, Base Layout Optimizer, Resource Transfer Manager, manage a custom marker, or copy coordinates. **Suite Options** opens the visibility settings directly from the contextual panel.

Strategic planning is performed directly from that native contextual panel; it
is not a separate Suite window. **Plan Move Base** enters the game's familiar
move-base placement view while replacing the final click with a local preview.
Any player base can be planned: owned bases retain native move validation,
while other players' bases use preview-only destination validation so the
logged-in account's active-base distance cannot reject the projection.
**Plan Ruin**, **Plan Ruin For**, **Plan Level Up**, and **Plan Remove** project
their results immediately on the region map. Contextual **Undo** and **Reset
Plans** controls appear while projected changes exist.

These previews alter only ClientLib's local world cache. They never submit an
attack, relocation, or other server command. Resetting, undoing, or disabling
the module restores the cached objects and marks affected sectors for a fresh
copy of the live world.

The module appends controls after the game creates its native menu and never removes native actions. Its `RegionCityMenu.showMenu` integration is registered as a reversible Suite hook and is restored when the module is disabled.

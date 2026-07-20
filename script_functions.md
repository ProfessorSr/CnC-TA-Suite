# Legacy Script Function Checklist

This document inventories capabilities observed in the temporary `oldscripts/` reference collection. Those scripts are used only to identify established game APIs, connection values, variables, and user-facing behavior. CnC-TA-Suite does not copy, import, execute, bundle, or otherwise depend on them; the folder may be deleted without affecting the project.

Review scope: 68 userscripts and the packaged **TA Attack Optimizer + Live Simulator v1.4**. Duplicate, forked, compact, server-specific, and old/new variants are consolidated into single requirements. Items are checked only after the capability is demonstrably implemented in the current extension.

Current implementation audit: **177 of 193 eligible items complete** as of 2026-07-20. Checked items are supported by current code in Alliance Intelligence, Base Intelligence, Combat Reports, Communications, Context Actions, External Analysis, Hotkeys, Scanner, Support Manager, Tactical Map, War Room, World Map Tools, Base Layout Optimizer, Next MCV, Repair & Collection Manager, Upgrade Manager, Resource Transfer Manager, UI Tools, Module Manager, window/UI services, or shared game integration. Planned, placeholder, partial, and narrower implementations remain unchecked. The 14 red items and one unchecked yellow optional item are excluded from the eligible total.

Status legend: **✅ completed**, **[ ] eligible future work**, **🟡 optional/deferred interoperability**, **🔴 do not implement**.

## Automation policy — do not implement

The following unattended actions are intentionally out of scope until their compliance with the EA Terms of Service can be established:

- 🔴 **DO NOT IMPLEMENT** — Automatic upgrading.
- 🔴 **DO NOT IMPLEMENT** — Automatic resource transfers.
- 🔴 **DO NOT IMPLEMENT** — Automatic support calibration.
- 🔴 **DO NOT IMPLEMENT** — Automatic support recalls.
- 🔴 **DO NOT IMPLEMENT** — Automatic selling.
- 🔴 **DO NOT IMPLEMENT** — Automatic attack launching.
- 🔴 **DO NOT IMPLEMENT** — Automatic troop movement.
- 🔴 **DO NOT IMPLEMENT** — Automatic base relocation.
- 🔴 **DO NOT IMPLEMENT** — Automatic building or unit selection.
- 🔴 **DO NOT IMPLEMENT** — Automatic report reading that triggers actions.
- 🔴 **DO NOT IMPLEMENT** — Automatic chat posting.
- 🔴 **DO NOT IMPLEMENT** — Automatic account switching or login/logout.
- 🔴 **DO NOT IMPLEMENT** — Credential or account-profile storage.
- 🔴 **DO NOT IMPLEMENT** — Multiple concurrent game sessions managed by the extension.

## War Room and combat

### Target discovery and intelligence

- [x] ✅ Search nearby Forgotten bases, camps, infected camps, outposts, and player bases.
- [x] ✅ Filter targets by type, minimum/maximum level, distance, and command-point cost.
- [x] ✅ Filter player targets by alliance and relationship (own, allied, NAP, enemy, neutral).
- [x] ✅ Scan from a selected player base rather than assuming the first base.
- [x] ✅ Stop and resume long-running scans and display scan progress.
- [x] ✅ Detect and exclude destroyed, ghosted, invalid, friendly, or otherwise unattackable targets.
- [x] ✅ Collect target coordinates, level, type, owner, alliance, distance, CP cost, and layout.
- [x] ✅ Show target offense, defense, building, support, condition, and repair information.
- [x] ✅ Show available loot, troop strength, surrounding-base count, and distance summaries.
- [x] ✅ Estimate possible attacks using both available command points and a conservative maximum offense-repair cost, independent of target health.
- [x] ✅ Calculate resource-layout quality and growth potential.
- [x] ✅ Identify layout resource fields and provide visual terrain/layout previews.
- [x] ✅ Open a result on the world map or directly in native combat setup.
- [x] ✅ Export scan results in a tab-separated mail/chat-compatible format.
- [x] ✅ Cache scanned layouts and invalidate them when target versions change.

### Attack formation management

- [x] ✅ Save named offensive formations persistently.
- [x] ✅ Load, overwrite, and delete saved formations.
- [x] ✅ Scope formations by attacking base and validate army compatibility.
- [x] ✅ Preview proposed moves without changing the game until commit.
- [x] ✅ Commit a previewed formation to native combat setup.
- [x] ✅ Undo, redo, and reset formation preview edits.
- [x] ✅ Move individual units and swap occupied positions in the non-committing formation preview.
- [x] ✅ Shift the entire formation left, right, up, or down in preview.
- [x] ✅ Mirror formation previews horizontally and vertically.
- [x] ✅ Swap offensive rows 1/2, 2/3, and 3/4 in preview.
- [x] ✅ Select one row or all rows for bulk preview operations.
- [x] ✅ Enable/disable all units or only infantry, vehicles, or aircraft in the preview.
- [x] ✅ Enable/disable an individual unit in the preview.
- [x] ✅ Preserve transporter/garrison identifiers when formations are captured, previewed, moved, saved, and reloaded.
- [ ] 🟡 **OPTIONAL / DEFERRED** — Import and export formations using CNCTAOpt-compatible links, or replace this with a Suite-owned interchange format.
- [x] ✅ Mark world targets that have saved formations/layouts.

### Native battle simulation

- [x] ✅ Run the native `SimulateBattle` command without launching a real attack.
- [x] ✅ Automatically simulate after direct troop movement (`ArmyChanged`).
- [x] ✅ Debounce formation changes and respect the server simulation cooldown.
- [x] ✅ Cache simulation results by target version, attacking base, formation, and alliance bonuses.
- [x] ✅ Invalidate cached simulations when relevant game data changes.
- [x] ✅ Replay a simulation in the native animated battleground.
- [x] ✅ Provide replay start, pause, speed, skip, back, and return-to-setup controls.
- [x] ✅ Compare the live formation with cached alternatives.
- [x] ✅ Rank simulations by Construction Yard destruction and blocking-column damage.
- [x] ✅ Rank simulations by Defense Facility destruction and armored-defense damage.
- [ ] Rank simulations by total defense damage, Command Center damage, loot, repair cost, and battle duration.
- [x] ✅ Search bounded Quick, Detailed, or Exhaustive candidate sets—including individual troop moves and swaps—and recommend the best result for CY, DF, defense, CC, or research/loot goals.
- [x] ✅ Show attacker and defender health percentages and absolute damage.
- [x] ✅ Break defender results into structures, defense, armored defense, and unarmored defense.
- [x] ✅ Break offense results into infantry, vehicle, and aircraft damage/repair.
- [x] ✅ Show repair charge, repair storage usage, and estimated repair time.
- [x] ✅ Show Tiberium, Crystal, Credits, and Research Point loot.
- [x] ✅ Show command-point cost and loot/CP efficiency.
- [x] ✅ Show battle duration, outcome, morale, and auto-repair effects.
- [x] ✅ Refresh simulation statistics manually.
- [x] ✅ Save/load simulator settings and reset them to defaults.
- [x] ✅ Optionally skip the victory popup after a simulated battle.
- [x] ✅ Optionally suppress attack-preparation and formation-manager tooltips.
- [x] ✅ Lock/unlock native Attack and Repair actions as a safety feature.

### Combat reports and history

- [x] ✅ Read combat reports for a selected date range, target/base, and report type.
- [x] ✅ Aggregate loot, losses, repair time, command-point cost, and resource efficiency across reports.
- [x] ✅ Separate PvP and PvE attacks, kills, scores, and rankings.
- [x] ✅ Summarize offense/defense damage and unit losses.
- [ ] Record the offense repair time a destroyed base had at the time of death.
- [x] ✅ Display attack history and per-target trends.
- [x] ✅ Export report summaries in a reusable text/table format.

## Scanner and world tools

### Forgotten waves and attack range

- [ ] Highlight Forgotten and player bases inside attack range during base movement.
- [x] ✅ Count Forgotten bases within attack range of a selected object or proposed move location.
- [x] ✅ Group nearby Forgotten bases by level.
- [x] ✅ Distinguish core and full fractional attack-radius counts with explicit labels.
- [x] ✅ Calculate the number or maximum number of Forgotten attack waves.
- [ ] Display wave-zone details in city, camp, ruin, and move tooltips.
- [x] ✅ Paste wave counts and level distributions into chat.
- [x] ✅ Show move cooldown duration and exact completion date/time.

### Navigation and map

- [x] ✅ Navigate directly to entered world coordinates.
- [x] ✅ Copy selected coordinates into chat or messages with correct BBCode.
- [x] ✅ Provide a compass from screen center to the selected target.
- [x] ✅ Provide a compass from the current base to the selected target.
- [x] ✅ Show the currently viewed sector in a compact HUD.
- [x] ✅ Extend the allowed world-map zoom range.
- [x] ✅ Open the current server on an external CNC map.
- [x] ✅ Render a full regional map of bases and POIs.
- [x] ✅ Color own, alliance, enemy, neutral, Forgotten, and POI objects distinctly.
- [x] ✅ Draw relationship and target lines.
- [x] ✅ Filter the map by object type and level, with ownership/alliance relationship colors.
- [x] ✅ Select map origin/target coordinates from the current selection.
- [x] ✅ Persist map zoom, filters, and line settings.
- [x] ✅ Create a PvP quick map of alliance and enemy bases/POIs.

### Strategic movement planning

- [x] ✅ Simulate base relocation without committing a real move.
- [x] ✅ Plan a move, ruin creation, ruin ownership, base level change, or object removal.
- [x] ✅ Recalculate territory and influence after simulated actions.
- [x] ✅ Undo the latest strategic-map action.
- [x] ✅ Reset the simulated world to live state.
- [x] ✅ Preserve a history/hash of planned world changes.
- [x] ✅ Show nearby tunnel locations during relocation planning.
- [x] ✅ Display current offense level and required tunnel offense level.
- [x] ✅ Mark blocked and usable tunnels based on influence range.
- [x] ✅ Read configured tunnel influence range from alliance announcements when present.

## Base operations

### Base overview and statistics

- [x] ✅ Provide general player, world, alliance, and account information.
- [x] ✅ List every owned base with coordinates, faction, levels, condition, and status.
- [x] ✅ Show base, offense, defense, and support levels.
- [x] ✅ Show building, defense, offense, and support composition per base.
- [x] ✅ Show resource stock, storage capacity, production, package income, and time-to-cap.
- [x] ✅ Show repair storage, repair capacity, and infantry/vehicle/air/base repair times.
- [x] ✅ Show current and next-MCV Credits/RP requirements, remaining amounts, progress, and ETA.
- [x] ✅ Show lootable resources and base attack/loot summaries.
- [x] ✅ Provide compact and super-compact information sticker modes.
- [x] ✅ Allow information widgets to be minimized, pinned, locked, and reordered.
- [x] ✅ Focus the map on a base or open/access a base directly.
- [x] ✅ Show online/offline state for player cities using colors.
- [x] ✅ Show player-base offense/defense details and own-base repair time in region tooltips.

### Repair and collection

- [x] ✅ Automatically repair buildings in a configurable priority order.
- [x] ✅ Automatically repair offense units.
- [x] ✅ Automatically repair defense units where supported.
- [ ] 🔴 **DO NOT IMPLEMENT IN THIS GAME BUILD** — Separate one-click infantry, vehicle, and aircraft repairs are not exposed; use the supported offense-wide repair action.
- [x] ✅ Show resources and time required to complete repairs.
- [x] ✅ Automatically collect completed resource packages/building production.
- [x] ✅ Allow each automatic repair/collection behavior to be enabled independently.

### Resource transfer and trade

- [x] ✅ Transfer all available resources to the current base.
- [x] ✅ Select one, multiple, or all source bases in an improved trade window.
- [x] ✅ Calculate transferable amounts while respecting storage and transfer limits.
- [x] ✅ Require optional confirmation before bulk transfers.
- [x] ✅ Improve the Supplies interface and default it to the useful tab.
- [x] ✅ Optionally hide/disable Funds spending while the Supplies interface is open.

### Upgrade planning and manual actions

- [x] ✅ Show upgrade cost, affordability, resource shortfall, and production ETA.
- [x] ✅ List and rank candidate upgrades by resource or efficiency criteria.
- [x] ✅ Filter upgrades by building/unit category and affordability.
- [x] ✅ Upgrade the highest-level selected building types.
- [x] ✅ Upgrade all currently filtered/eligible buildings, defense units, and offense units, including an affordable subset when the full target-level upgrade cannot be funded.
- [x] ✅ Upgrade base buildings, defense, and offense to a selected target level through an explicit user action.
- [x] ✅ Show and upgrade the currently selected building, defense unit, or offense unit to a chosen target level.
- [x] ✅ Upgrade one level or maximize toward a configured level.
- [ ] 🔴 **DO NOT IMPLEMENT** — Run automatic upgrades across multiple owned bases.
- [ ] 🔴 **DO NOT IMPLEMENT** — Enable automatic upgrading separately for buildings, defense, and offense.
- [x] ✅ Enable/disable individual building and unit types per base.
- [x] ✅ Support resource-only upgrading that excludes CY, CC, Defense Facility, and Defense HQ.
- [x] ✅ Independently allow Power Plants, Tiberium Harvesters, Crystal Harvesters, Refineries, Silos, and Accumulators.
- [x] ✅ Independently allow support buildings and production buildings.
- [x] ✅ Choose collector-heavy/new-world or power-heavy/old-world resource strategies.
- [x] ✅ Rank upgrades by most productive option.
- [x] ✅ Provide per-base enable switches, limits, and persistent settings.
- [ ] 🔴 **DO NOT IMPLEMENT** — Show automatic-upgrade status and stop controls. (Manual upgrade activity is logged.)

### Support and base lifecycle

- [x] ✅ Show support weapon assignments for every base.
- [x] ✅ Recall one support weapon or recall all support weapons through confirmed manual actions.
- [x] ✅ Calibrate support weapons individually or in bulk through confirmed manual actions.
- [ ] Sell ordinary bases with validation and confirmation.
- [ ] Sell designated/special bases.
- [ ] Upgrade designated/special bases.
- [x] ✅ Share/scan owned base data for alliance coordination.

## Alliance and POI tools

### Members, rankings, and alerts

- [x] ✅ Show all alliance members grouped/sorted by online state.
- [x] ✅ Color chat nicknames according to alliance role.
- [ ] Show alliance PvP/PvE rankings in player windows.
- [ ] Split player base-kill totals and scores into PvP and PvE.
- [x] ✅ Show player-held POIs and alliance-held POIs.
- [x] ✅ Show player base-level distribution.
- [x] ✅ Alert the player when one of their bases is under PvP attack.
- [x] ✅ Show alliance/player score, rank, average score, veteran/event points, and member details.

### POI analysis and export

- [x] ✅ List alliance POIs by type, level, owner, coordinates, and sector.
- [x] ✅ Calculate POI score by category.
- [x] ✅ Calculate the next and previous bonus-tier requirements.
- [x] ✅ Show score/level differences to adjacent tiers.
- [x] ✅ Compare the alliance with the alliances immediately above and below it.
- [x] ✅ Calculate the real POI gain/loss using the alliance rank multiplier.
- [x] ✅ Simulate adding or removing a POI and recalculate bonuses.
- [x] ✅ Add proposed POIs to a planning list and reset simulations.
- [x] ✅ Focus the map on a POI from its coordinates.
- [x] ✅ Export free, alliance-owned, or all POIs.
- [x] ✅ Show live POI counts and a sector summary before export.
- [x] ✅ Export robustly parsed POI data as CSV.

## Communication and account utilities

### Chat and messaging

- [x] ✅ Insert coordinate, URL, player, alliance, bold, italic, strike, and underline BBCode.
- [x] ✅ Maintain a whisper/contact list.
- [x] ✅ Copy selected world-object coordinates to chat and mail composers.
- [x] ✅ Paste Forgotten-wave summaries to chat.
- [x] ✅ Close/minimize chat automatically at startup when configured.
- [x] ✅ Insert player/account details through keyboard shortcuts.

### External sharing and analysis

- [x] 🟡 **IMPLEMENTED OPTIONAL** — Generate CNCOpt links for the selected base.
- [x] 🟡 **IMPLEMENTED OPTIONAL** — Generate CNCTAOpt/CNCOpt+ links including faction, terrain, buildings, defense, offense, levels, and coordinates.
- [x] ✅ Open user-configured external analyzers with the generated target data after an explicit click.
- [x] ✅ View the selected player base through a user-configured external base analyzer.
- [x] ✅ Generate a server-specific CNC-Map link.

### Session and keyboard tools

- [x] ✅ Define hotkeys for common navigation, chat, player-data, combat, and UI actions.
- [ ] 🔴 **DO NOT IMPLEMENT** — Store credentials/profiles for accounts.
- [ ] 🔴 **DO NOT IMPLEMENT** — Log in, log out, or switch between configured accounts.
- [ ] 🔴 **DO NOT IMPLEMENT** — Create or manage multiple Tiberium Alliances sessions in one browser.

## UI and platform capabilities

- [x] ✅ Use native Qooxdoo windows, tabs, tables, buttons, icons, tooltips, and game themes.
- [x] ✅ Make normally fixed overlay windows movable, including mail and forum overlays.
- [x] ✅ Avoid top-bar/right-bar button collisions by consolidating enabled-module shortcuts in the responsive base-header/right-navigation dock.
- [x] ✅ Provide compact, resizable, movable, pinnable, lockable, and auto-hide window modes.
- [x] ✅ Persist window position, size, visibility, and module preferences.
- [x] ✅ Provide configurable auto-update intervals and manual refresh actions.
- [x] ✅ Detect game readiness and retry initialization safely.
- [x] ✅ Detect game build/perforce changes and isolate compatibility accessors.
- [x] ✅ Normalize obfuscated ClientLib fields and methods behind shared Hub services.
- [ ] Centralize timers, game events, cache invalidation, logging, translations, images, and local storage.
- [ ] Replace prototype monkey-patches with reversible hooks wherever possible.
- [ ] Remove use of dynamic `eval`/function construction and page-script self-injection.
- [ ] Ensure automated actions expose explicit enable switches, scopes, limits, status, and stop controls.

## Development/PTE-only capabilities

These functions occur in `TA_PTE_CheatScript.user.js`. The Suite will not implement or ship PTE tooling.

- [ ] 🔴 **DO NOT IMPLEMENT** — Detect, gate, or expose PTE tools.
- [ ] 🔴 **DO NOT IMPLEMENT** — Send PTE commands to set command points.
- [ ] 🔴 **DO NOT IMPLEMENT** — Reset base-move cooldown through PTE commands.
- [ ] 🔴 **DO NOT IMPLEMENT** — Repair bases or offense through PTE commands.
- [ ] 🔴 **DO NOT IMPLEMENT** — Maximize resources through PTE commands.
- [ ] 🔴 **DO NOT IMPLEMENT** — Collect completed resources through PTE automation.
- [ ] 🔴 **DO NOT IMPLEMENT** — Create or ship a developer-only PTE module.

## Source coverage index

The following index records what each legacy source contributed to the consolidated checklist.

| Legacy source | Principal capabilities found |
|---|---|
| `TA_ADDON_City_Online_Status_Colorer_SC` | Region-city online-state coloring |
| `TA_AlliancesMemberOnline` | Alliance online-member overview and sorting |
| `TA_Attack_Range` | Move-mode attack-range highlighting |
| `TA_Auto_Repair` | Ordered automatic building repair |
| `TA_Autopilot` | Per-base automatic building/defense/offense upgrades and detailed filters |
| `TA_BaseInfo` | General, per-base, and all-base information views |
| `TA_BaseShare` | Base scanning/sharing and attack/move integration patches |
| `TA_Battle_Simulator_V2_OLD` | Earlier generation of native simulation, stats, caching, and formation tools |
| `TA_CD_Compass` | Base-relative compass |
| `TA_CD_Player_Base_Info` | Region player-base offense/defense and repair information |
| `TA_CD_PvP_Alert_Status` | Incoming PvP attack alerts |
| `TA_CD_PvP_Quick_Map` | Alliance/enemy tactical quick map |
| `TA_CNCOptPLUS_Link_Button` | CNCOpt+ selected-base export (SC variant) |
| `TA_CNCOpt_Link_Button` | CNCOpt selected-base export |
| `TA_CNCOpt_Link_Button_SC` | CNCOpt selected-base export (SC variant) |
| `TA_Chat_Colorize` | Alliance-role chat colors |
| `TA_Chat_Helper_Enhanced_Mod` | Chat BBCode automation and whisper contacts |
| `TA_CityMoveInfoExtend` | Move completion time, nearby Forgotten counts/levels/waves |
| `TA_CnCTAOpt_Link_Button` | CNCTAOpt selected-base export |
| `TA_Compass_ALT` | Screen-center compass |
| `TA_Coord_Box_Shortcut` | Coordinate-entry navigator |
| `TA_Coords_Button_All` | Copy selected coordinates into chat/messages |
| `TA_Count_Forgotten_Bases_Range` | Forgotten count and chat output |
| `TA_Crucial_CNC_Map_Link` | Current-world CNC-Map link |
| `TA_Flunik_Tools_reloaded` | Base upgrade tables, POI information, production-category views, upgrade automation |
| `TA_Formation_Saver` | Persistent named formation save/load/delete and compact UI |
| `TA_Hotkeys` | Player-data hotkeys and nine-account login/logout support |
| `TA_Info_Sticker` | Movable resource/repair/MCV status sticker |
| `TA_Info_Sticker_SUPERCOMPACT` | Super-compact status-sticker variant |
| `TA_MHTools_Available_Loot_Summary_Info` | Cross-server loot, troops, bases, and distance summary |
| `TA_MaelstromTools_Dev_Mod_MCV` | Production, repair, resources, MCV ETA, support, collection, repair, and upgrade tools |
| `TA_Maelstrom_ADDON_Basescanner_AIO` | Combined scanner, infected camps, growth rate, and layout information |
| `TA_Maelstrom_ADDON_Basescanner_Basic` | Core nearby-base scanner |
| `TA_Maelstrom_ADDON_Basescanner_CNCOPTplus` | Scanner plus CNCOpt growth calculations |
| `TA_Maelstrom_ADDON_Basescanner_Infected_Camps` | Scanner with infected-camp support |
| `TA_Map` | Full region/POI map, alliance filters, colors, lines, and coordinates |
| `TA_MovableMenuOverlay` | Movable game overlay windows |
| `TA_Multissesion_MOD` | Multiple sessions in one browser |
| `TA_New_Custom_Flunik_Tools` | Category-filtered automatic upgrading |
| `TA_New_Resource_Trade_Window` | Multi-base resource transfer UI |
| `TA_POI_ExporterTools` | Free/alliance/all POI CSV export and sector counts |
| `TA_POIs_Analyser` | POI scores, tier requirements, and add/remove simulation |
| `TA_PTE_CheatScript` | Test-world-only CP, cooldown, repair, resources, and collection commands |
| `TA_PluginsLib_mhLoot` | Loot/troops/base/distance plugin service |
| `TA_PluginsLib_mhNavigator` | Navigation/compass plugin service |
| `TA_PvP_PvE_Player_Info_Mod` | PvP/PvE kill split and player-held POI tab |
| `TA_PvP_PvE_Ranking_POI_Holding_Split_Base_Kill_Score` | Rankings, player/alliance POIs, PvP/PvE scores, and base levels |
| `TA_Real_POI_Bonus` | Rank-adjusted POI gain/loss |
| `TA_Repair_Time_Of_Death` | Dead-base offense repair time |
| `TA_Report_Stats` | Multi-report repair, CP, and loot aggregation |
| `TA_Report_Summary` | Date/base report gains and losses |
| `TA_Shockr_Tools_Basescanner_Mailversion_reMod` | Base scanning with mail-oriented output |
| `TA_Supplies_Mod` | Improved Supplies behavior and Funds-disable option |
| `TA_TACS` | Combat simulator, live stats, formation controls, layouts, replay, safety locks, and options |
| `TA_TheMovement` | Strategic territory/move/ruin/level simulation with undo/reset |
| `TA_The_Green_Cross_Tools` | Resource transfer, POI management/simulation, and legacy scanner/upgrade concepts |
| `TA_Tiberium_Alliances_Battle_Simulator_V2` | Native simulation API, detailed stats, priorities, cache, replay, and formation manipulation |
| `TA_Transfer_All_resources` | One-click transfer-all with confirmation |
| `TA_Tunnel_Info` | Tunnel markers and required offense level during relocation |
| `TA_Upgrade_Top_ModButtonPos` | Upgrade highest selected building types |
| `TA_View_Player_Base` | External selected-player-base analyzer |
| `TA_Warchief_Sector_HUD` | Current-sector HUD |
| `TA_Warchief_Upgrade_Base_Defense_Army` | Target-level bulk upgrading and repair-time/resource projections |
| `TA_Wavy` | Forgotten wave zones, counts, levels, and move integration |
| `TA_Zoom` | Extended world zoom |
| `TA_infernal_wrapper` | Shared wrappers, compatibility accessors, and global script fixes |
| `TA_leoStats` | Base/player/alliance/POI/resource statistics, special-base actions, and scanner |
| `TA_xTrim_Base_Overlay_DR_4_3` | CTRL/AltGr base upgrade gain/cost overlay |
| `ta-attack-optimizer-v1.4` | Preview/commit optimizer, bulk formation transforms, visibility controls, undo/reset, and live simulation |

## Migration principles derived from the review

- [ ] Implement each ClientLib read once in the shared Game Data Hub and consume normalized data from modules.
- [x] ✅ Keep target selection authoritative to the native game state, not to individual search or utility modules.
- [x] ✅ Separate read-only analysis, reversible previews, and state-changing actions visibly in the UI.
- [ ] Require confirmation for attacks, sales, bulk upgrades, resource transfers, and other consequential actions.
- [x] ✅ Prefer native simulation results over inferred combat outcomes.
- [x] ✅ Preserve useful workflows while redesigning legacy UI rather than reproducing old windows exactly.
- [x] ✅ Consolidate forks and server variants behind compatibility adapters instead of shipping duplicate modules.
- [ ] Add fixtures/tests for normalized data, calculations, cache invalidation, and every state-changing workflow.

## Project coverage metrics

These figures are maintained with the checklist and module catalog. Red **DO NOT
IMPLEMENT** entries are policy exclusions and are not included in the eligible
legacy-feature denominator.

- **Legacy coverage:** 177/193 eligible legacy features complete.
- **Suite modules:** 22 cataloged modules, and growing.
- **Suite-exclusive features:** 11 implemented capabilities with no equivalent
  workflow found in the reviewed legacy ecosystem.

### Suite-exclusive feature inventory

- ✅ Permission-scoped module manifests with dependency resolution and a managed initialize/load/enable/disable/unload/destroy lifecycle.
- ✅ A user-facing Module Manager that persists independent module enable states and opens modules through a shared window service.
- ✅ A normalized Game Data Hub that separates ClientLib acquisition from module calculations and presentation.
- ✅ A read-only API Inspector that clones public service snapshots, documents callable examples, and exports redacted diagnostics without exposing mutable ClientLib objects or evaluating arbitrary code.
- ✅ Native-game target authority: opening any native attack setup supersedes search selections and synchronizes every War Room tab to that target.
- ✅ Objective-driven formation recommendations that search candidate layouts using native battle simulations without moving the live army.
- ✅ Conservative possible-attack estimates that combine command points with maximum offense repair time instead of using CP alone.
- ✅ A weighted Base Layout Optimizer with fixed-building constraints, minimum storage, move/replacement limits, ranked alternatives, and current-versus-proposed production.
- ✅ A responsive native-style Suite shortcut dock that relocates tools between the base header and right navigation, hides controls for disabled modules, exposes every openable module, and uses dual-purpose open/close buttons.
- ✅ Shared persistent window modes covering compact, resize, move, pin, lock, visibility, and auto-hide behavior.
- ✅ Alliance invitation discovery with world-ranking criteria, sortable candidate filtering, available-slot enforcement, multi-selection, and confirmed manual sending.

When a new Suite-only capability is added, append it here and increment the
Suite-exclusive count. If a legacy source is later found to provide the same
workflow, reclassify it under the applicable legacy checklist section instead.

### Remaining eligible work

The 16 unchecked eligible items are intentionally still open and are grouped as
follows; they are not included in the completed count until the full described
workflow is implemented and testable.

- **Combat simulation (1):** one additional multi-criteria native-simulation ranking mode covering loot, repair cost, and battle duration together.
- **Reports and native map integration (3):** repair time at base death, move-mode attack-range highlighting, and wave details injected into native tooltips.
- **Base lifecycle (3):** confirmed ordinary/special-base selling and special-base upgrading. These consequential actions require verified ClientLib validation paths before implementation.
- **Alliance player windows (2):** embedded PvP/PvE rankings and split PvP/PvE scores in the game's player window.
- **Architecture, safety, and verification (7):** complete service centralization, reversible-hook migration, removal of dynamic page injection, comprehensive automation controls, one-read-per-ClientLib-field Hub migration, universal consequential-action confirmation, and fixtures for every state-changing workflow.

The 14 red policy exclusions and the unchecked yellow CNCTAOpt interoperability
item remain separate and are not counted as eligible work. The two already-built
yellow external-link features remain documented as optional compatibility tools.

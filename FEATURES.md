# What CnC-TA-Suite Can Do

CnC-TA-Suite adds helpful tools to Command & Conquer: Tiberium Alliances. It can
help you find targets, plan attacks, care for bases, work with your alliance,
and understand game data.

This page lists features that are working in the extension now. It uses simple
words so a new player or a developer can quickly understand what is included.

> **Safety first:** The Suite does not launch attacks for you. Important actions,
> such as upgrades, transfers, research, support changes, and moving formations,
> happen only after you choose them. Automatic repair and collection tools start
> turned off and can be enabled separately.

## Plan attacks in the War Room

The **War Room** puts attack planning, battle tests, reports, and army details in
one place.

- [x] Find nearby Forgotten bases, camps, outposts, players, and alliance targets.
- [x] Choose a target type, level range, alliance, relationship, and highest Command Point cost.
- [x] Pause and continue a long search and watch its progress.
- [x] Skip targets that are destroyed, friendly, invalid, or cannot be attacked.
- [x] See a target's owner, alliance, level, coordinates, layout, buildings, army, defense, support, health, repair needs, loot, and nearby bases.
- [x] Estimate how many attacks your Command Points and repair storage can support.
- [x] Open a target on the map or in the game's attack screen.
- [x] Download search results as CSV, copy BBCode coordinates, or open a message draft.
- [x] Follow the target that is really open in the game's attack screen.

### Arrange an attack formation

- [x] See a suggested 9-by-4 troop formation before moving anything.
- [x] Move one troop, swap two troops, shift the whole army, mirror it, or swap rows.
- [x] Hide or show all troops, one troop, or only infantry, vehicles, or aircraft.
- [x] Undo, redo, and reset changes made in the preview.
- [x] Save, replace, load, and delete named formations for one attacker and target.
- [x] Check that a saved formation still matches the current army before loading it.
- [x] Mark map targets that have a saved formation.
- [x] Use a small Formation Controls pad beside the game's attack screen.
- [x] Apply a reviewed formation to the game only after confirmation.
- [x] Restore the formation that was present when attack setup opened.

### Find a stronger formation

- [x] Search for the best way to damage the Construction Yard, Defense Facility, total defense, a specific live target-base building or defensive unit, or earn Research Points.
- [x] Choose a Quick, Detailed, or Exhaustive search size.
- [x] Test choices with the game's real battle simulator without launching an attack.
- [x] Keep all troops active until a test destroys the Construction Yard, then find the smallest winning force.
- [x] Leave already-disabled troops parked during Best Formation unless an enabled troop needs their cell.
- [x] Run **Greedy Sim**, which places troops one at a time to seek the most Research Points.
- [x] Pause Greedy Sim, make manual changes, and continue without losing those changes.
- [x] Put the best Greedy layout into the active formation and save it automatically as **Greedy**.

### Test and compare battles

- [x] Test the live formation after troop movement, with a short delay to combine fast changes.
- [x] Remember test results for each target, attacker, formation, target version, and alliance bonus set.
- [x] Compare the live formation with earlier test results.
- [x] See damage to buildings, defenses, armored units, unarmored units, and your troop groups.
- [x] See repair time, repair resources, loot, Command Point efficiency, battle length, morale, and the outcome.
- [x] Replay a tested battle with start, pause, speed, skip, back, and return controls.
- [x] Lock the game's Attack and Repair buttons as a safety choice.
- [x] Hide selected attack-screen tooltips or skip the test-battle victory popup.
- [x] Use compact optimizer and result windows while native attack setup is open.

### Read reports and inspect armies

- [x] Load the game's Offense, Defense, Forgotten, and Other report folders.
- [x] Filter reports by date, base, target, and report type.
- [x] Total wins, losses, loot, damage, repair time, Command Points, and efficiency.
- [x] Compare PvP and PvE results and view per-target trends.
- [x] Open a report in the game's report screen or replay it when the game provides replay data.
- [x] Export report, army, and combat-stat tables as CSV.
- [x] Inspect every owned base with a Command Center and see troop role, level, health, position, range, speed, favorite target type, repair cost, and readiness.

## Find valuable base layouts with Scanner

The **Scanner** looks for nearby targets and useful resource-field layouts.

- [x] Search bases, camps, outposts, players, or alliances.
- [x] Filter by relationship, alliance, level, distance, and Command Point cost.
- [x] Find exact 7 Tiberium/5 Crystal, 6/6, and 5/7 layouts.
- [x] Find layouts with two different empty silo spots that touch four or five Tiberium fields.
- [x] Count diagonal fields when checking where a silo can go.
- [x] Select layout cards and see their field and silo information.
- [x] Save layouts so they remain after a refresh.
- [x] Reopen, remove, or focus a saved layout on the map.
- [x] Export selected coordinates with CNCOpt mini links.

## Understand players and bases

**Player Intelligence** gives a clear view of your account and every owned base.

- [x] See player, world, alliance, score, rank, Command Points, achievements, and progress.
- [x] List every base with its name, coordinates, faction, levels, health, and online state.
- [x] See buildings, offense, defense, support, resources, storage, production, packages, and time until storage is full.
- [x] See repair storage and repair time for infantry, vehicles, aircraft, and the base.
- [x] See lootable resources and nearby attack information.
- [x] Focus the map on a base or open it directly.
- [x] Add useful army, defense, repair, and online details to map tooltips.
- [x] Use compact or super-compact information stickers and move, pin, lock, minimize, or reorder them.

## Track the next MCV and research

- [x] See current Credits and Research Points for the next MCV.
- [x] See what is still needed, percent complete, and estimated completion time.
- [x] Add a small, readable Credit-ready time beside costs in the game's Research window.
- [x] Add a **Track** checkbox to research cards and remember one selected research item.
- [x] Open a Next-MCV-style tracker with separate Credit and Research Point bars, remaining amounts, and Credit ETA for the selected item.
- [x] Reopen the tracker from the **Research Center** Base Tools shortcut or the normal **Research ETA** Suite shortcut.
- [x] Refresh the tracker from live resources, preserve its selected item and open/closed state through game refreshes, and clear or replace the tracked item at any time.
- [x] Keep tracking read-only; research still starts only from the game's normal Research button.

## Repair bases and collect resources

The **Repair & Collection Manager** handles common base care.

- [x] Repair buildings, offense, and defense when the current game supports the action.
- [x] Collect completed resource packages and building production.
- [x] Show damage, repair resources, repair time, collection state, and recent actions.
- [x] Add quick repair buttons to the native base header.
- [x] Keep unavailable repair buttons visible but disabled so their state is clear.
- [x] Open base tools from a small, always-available shortcut dock.
- [x] Optionally check and repair buildings by defense-first, production-first, or core-first order.
- [x] Turn automatic building repair, offense repair, defense repair, and collection on or off separately.
- [x] Choose how often enabled automatic care checks run.

## Move resources between bases

The **Resource Transfer Manager** plans safe transfers between your bases.

- [x] Choose the destination and one, several, or all source bases.
- [x] Send 10%, 25%, 50%, 75%, or 100% of Tiberium and Crystal.
- [x] Keep a chosen reserve at every source base.
- [x] Check whether a trade is allowed and show its Credit cost.
- [x] Ask for confirmation before a bulk transfer when that setting is enabled.
- [x] Save a Quick Transfer plan for all resources, only Crystal, only Tiberium, or custom percentages.
- [x] Keep a different Quick Transfer plan for each destination base.
- [x] Send transfer commands one at a time and wait for each result.
- [x] Keep a history of manual transfers.
- [x] Open Supplies on the useful tab and optionally disable visible Funds buttons while it is open.

## Plan and make upgrades

The **Upgrade Manager** helps choose upgrades. It upgrades only after a click and,
for bulk actions, a confirmation.

- [x] List building, defense, and offense upgrades for owned bases.
- [x] Show level, cost, affordability, missing resources, and production wait time.
- [x] Filter by base, category, item type, affordability, target level, and resource-only rules.
- [x] Turn individual building and unit types on or off for each base.
- [x] Rank choices by production value, collector-heavy, power-heavy, lowest cost, or highest level.
- [x] Upgrade the selected choice or the highest-ranked choice.
- [x] Upgrade all eligible choices by one level or toward a chosen level.
- [x] Use the affordable part of a larger upgrade plan when all steps cannot be paid for.
- [x] Use **Quick Upgrade** on the currently selected building or unit and see its resource wait time.
- [x] Keep a log of manual upgrade actions.

## Design a better base layout

The **Base Layout Optimizer** compares layout ideas without buying or selling anything.

- [x] Aim for more Tiberium, Crystal, Power, Credits, a balanced mix, or custom percentages.
- [x] Mark buildings that must stay where they are.
- [x] Set storage needs and limits for moves or replacement ideas.
- [x] See the current layout beside the suggested layout.
- [x] See production estimates, expected gains, costs, limits, and up to five other choices.
- [x] Keep suggested additions, replacements, and upgrades as advice only.
- [x] Optionally use the clearly marked experimental mover after a separate warning and confirmation.

## Use maps and plan moves

### World Map Tools and Tactical Map

- [x] Jump to typed coordinates.
- [x] Use the current base or screen center as a starting point.
- [x] See a compass from the base or screen center to a target.
- [x] See the current sector in a small display and change map zoom.
- [x] Open the current server in an external CNC map.
- [x] Draw a regional map of bases and Points of Interest.
- [x] Give own, alliance, enemy, neutral, Forgotten, and POI objects different colors.
- [x] Filter objects by kind and level and draw target lines.
- [x] Save map zoom, filters, and line settings.
- [x] Switch to a quick PvP map.

### Strategic move planning

- [x] Preview a base move without making the real move.
- [x] Preview ruins, ruin ownership, base-level changes, and removed map objects.
- [x] Recalculate territory and influence after each planned change.
- [x] Undo the last change or reset the whole plan.
- [x] Show nearby tunnels, their required offense level, and whether they are blocked or usable.
- [x] Read an alliance's tunnel-range setting from its announcement when available.
- [x] Count Forgotten targets and attack waves around a selected or planned spot.
- [x] Show move cooldown time and the exact date and time it ends.

## Work with your alliance

**Alliance Intelligence** brings member, diplomacy, POI, invitation, and marker tools together.

- [x] List members and sort or group them by online state.
- [x] Color chat names by alliance role.
- [x] Show member score, rank, average score, event points, details, base levels, and held POIs.
- [x] List alliance POIs by type, level, owner, coordinates, and sector.
- [x] Calculate POI scores, nearby bonus levels, and real gain or loss after the alliance rank multiplier.
- [x] Compare the alliance with the alliances directly above and below it.
- [x] Try adding or removing POIs in a plan and reset the plan afterward.
- [x] Export free, owned, or all POIs as CSV with counts and sector totals.
- [x] Find possible recruits from live rankings, filter them, select several, check open alliance slots, and confirm invitations.
- [x] Add private map markers that stay in this browser.
- [x] Add shared Suite markers through the alliance marker channel.

### Alliance alerts and nearby enemies

- [x] Show a red alert when any alliance member is attacked.
- [x] Focus the attacked base so you can continue with the game's support controls.
- [x] Choose enemy alliances and find their bases near alliance-member bases.
- [x] Run that search once or repeat it on a chosen timer.
- [x] Export the friendly/enemy base pairs as CSV.

## Manage support weapons

- [x] See every base's support weapon, level, assigned target, and state.
- [x] Recall one selected support weapon or all assigned support weapons.
- [x] Calibrate one selected weapon or all weapons that can reach the target.
- [x] Check range and ask for confirmation before support changes.

## Communicate and share data

- [x] Build messages with coordinate, web link, player, alliance, bold, italic, strike, and underline BBCode.
- [x] Keep a whisper contact list.
- [x] Copy world coordinates to chat or mail.
- [x] Paste Forgotten-wave summaries into chat.
- [x] Make alliance mail drafts for role groups and send only after confirmation.
- [x] Optionally close or minimize chat when the game starts.
- [x] Create CNCOpt, CNCTAOpt/CNCOpt+, and server CNC-map links.
- [x] Send selected base or layout data to a developer-configured outside analyzer after a click.

## Reach tools quickly

- [x] Set keyboard shortcuts for the Module Manager, War Room, Scanner, Player Intelligence, and player details.
- [x] Open enabled tools from one responsive shortcut dock.
- [x] Move shortcuts between the base header and right side when space changes.
- [x] Click an open tool's shortcut again to close it.
- [x] Add chosen Suite actions to the game's map-object menus.
- [x] Open intelligence, scanning, combat, repair, upgrades, transfers, layouts, move plans, markers, or coordinate copying from those menus.

## Learn how to use the Suite

The **Command Manual** is help built into the extension.

- [x] Search help by topic or module.
- [x] Show guides only for modules that are currently enabled.
- [x] Open the correct help topic from a window's **? Help** link.
- [x] Read button guides, common workflows, beginner help, FAQ, troubleshooting, release notes, and a glossary.
- [x] Move through matching topics with Previous and Next controls.

## Manage the extension

- [x] See all 26 modules in the **Module Manager**.
- [x] Read each module's name, version, author, description, and current state.
- [x] Enable or disable modules and remember those choices.
- [x] See module dependencies and start them in the correct order.
- [x] Use the **Suite Dashboard** for live Suite, module, base, update, and dependency status.
- [x] Move, resize, pin, lock, hide, auto-hide, and use compact modes on supported Suite windows.
- [x] Remember window position, size, visibility, and module settings.
- [x] Make compatible game mail, forum, and message windows movable.

## Help developers understand problems

- [x] Wait for the game to be ready and retry startup safely.
- [x] Notice game build changes and keep version-specific game access in compatibility helpers.
- [x] Keep game data behind shared services so most screens do not need to understand hidden game field names.
- [x] Show framework, module, game compatibility, performance, hook, and observer health in **Suite Status**.
- [x] Inspect safe, read-only Suite data in **API Inspector**.
- [x] Copy public API examples, safe snapshots, and redacted diagnostics.
- [x] Keep private game objects and sensitive diagnostic values out of copied API data.
- [x] Keep bounded logs and report slow work that goes over a performance budget.
- [x] Build the module catalog from module folders and check module IDs, versions, permissions, APIs, and dependencies.

## Things the Suite purposely does not do

These limits protect accounts and keep important choices in the player's hands.

- [x] It does not automatically launch attacks.
- [x] It does not automatically sell bases or move bases.
- [x] It does not run unattended upgrades, transfers, support recalls, or support calibration.
- [x] It does not store game passwords or switch accounts.
- [x] It does not manage several game sessions at once.
- [x] It does not include PTE cheat commands.

For the detailed comparison with older community scripts, including unfinished
ideas and policy exclusions, see [script_functions.md](script_functions.md).

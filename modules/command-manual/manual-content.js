// Curated content for the interactive Command Manual.
const section = (id, title, summary, steps = [], controls = [], notes = []) =>
  Object.freeze({ id, title, summary, steps: Object.freeze(steps), controls: Object.freeze(controls), notes: Object.freeze(notes) });

export const MANUAL_SECTIONS = Object.freeze([
  section('welcome', 'Welcome to CnC-TA-Suite',
    'CnC-TA-Suite adds native-looking tools to Tiberium Alliances. Tools read normalized game data through Suite Core and the Hub. Features remain individually enabled or disabled through Module Manager.',
    ['Reload the unpacked extension after every new build.', 'Wait for the Suite-ready notification.', 'Open Module Manager from the top bar or the right-side Suite dock.', 'Enable only the tools you want. Disabled modules remove their hooks, buttons, and windows.'],
    [['Right-side icon dock', 'Quick access to every enabled module. Hover any icon to see its name.'], ['Top-bar Module Manager', 'Opens the installed-module list.'], ['Window X', 'Closes the current Suite window.'], ['Window –', 'Uses compact mode where that window supports it.'], ['Refresh', 'Requests a fresh Hub/provider snapshot without reloading the game.']]),

  section('getting-started', 'Getting Started',
    'A five-minute setup path for a newly installed Suite.',
    ['Build the Chrome extension and load the unpacked `dist/chrome` directory.', 'Open Tiberium Alliances and wait for the Suite-ready notification.', 'Open Module Manager and review enabled modules.', 'Open Command Manual from the book icon and use Search whenever a control is unfamiliar.', 'Open Suite Status once to confirm compatibility, monitor, and performance health.'],
    [['Module Manager', 'Controls which tools run.'], ['Command Manual', 'Provides contextual instructions.'], ['Suite Status', 'Confirms the integration is healthy.']]),

  section('new-player-guide', 'New Player Guide',
    'A suggested workflow for players who are new to either the game or the Suite.',
    ['Start with Base Intelligence to understand the current base.', 'Use Repair Manager after combat and Next MCV for expansion planning.', 'Use Scanner to find targets, then enter attack view so War Room receives the live target.', 'Use Resource Transfer and Upgrade Manager only after reviewing their confirmation data.', 'Keep automation-like experimental actions disabled until game-rule permission is confirmed.'],
    [['Base Intelligence', 'Learn resources, levels, repairs, and target information.'], ['Scanner → War Room', 'Find, inspect, simulate, and manually attack.'], ['Next MCV', 'Track long-term expansion requirements.']]),

  section('module-index', 'Module Index',
    'A live registry-derived inventory of every installed module, including version, enabled state, renderer type, and description.',
    ['Click Installed Modules beneath the table of contents.', 'Find the module by name.', 'Open its full guide from the table of contents or Search.'],
    [['Installed Modules', 'Opens the live module inventory.'], ['Table of Contents', 'Opens curated operating instructions.']]),

  section('search-guide', 'Search Command Manual',
    'Searches purposes, scenarios, walkthrough steps, features, button names, tips, FAQ answers, troubleshooting, and glossary definitions.',
    ['Type a term such as repair, MCV, simulation, transfer, or API.', 'Choose a chapter or matching subtopic from the result list.', 'Clear Search to restore the complete table of contents.'],
    [['Search', 'Filters continuously while you type.'], ['Subtopic result', 'Opens the parent module guide at once.']]),

  section('faq', 'Frequently Asked Questions',
    'Answers to common setup, data, MCV, repair, simulation, and button questions.', [], [
      ['Why is a button grey?', 'The module is enabled, but the current game view or data does not permit that action.'],
      ['Why did a module button disappear?', 'Disabled modules remove their buttons and hooks. Re-enable it in Module Manager.'],
      ['How do I unlock my next MCV?', 'Open Next MCV to see BaseFound Research Points and Credits required, current amounts, remaining amounts, and ETA.'],
      ['Why does War Room show a different target?', 'The currently open native attack screen always supersedes a prior Search result.'],
      ['Why is loot unavailable briefly?', 'EA publishes target combat data asynchronously; Base Intelligence retries while it loads.'],
      ['Does the Suite attack automatically?', 'No unattended attack launching is implemented. Simulations and explicit user actions remain separate from real attacks.'],
      ['Where are settings saved?', 'Module settings use Suite storage and persist across reloads.'],
      ['What should I send with a bug report?', 'Use the redacted diagnostic support bundle and describe the exact view/action that triggered the issue.']
    ]),

  section('troubleshooting', 'Troubleshooting',
    'A repeatable diagnostic path for missing buttons, empty data, compatibility failures, slow behavior, or windows that do not open.',
    ['Confirm the module is enabled.', 'Confirm you are in the required Base, Defense, Offense, World, or Attack view.', 'Open Suite Status and check Compatibility, Monitor Errors, Event Errors, and Performance Violations.', 'Use API Inspector only when deeper Hub/capability details are needed.', 'Reload the extension after rebuilding.', 'Capture `CnCTASuite.diagnostics.exportJson()` and review it before sharing.'],
    [['Suite Status Refresh', 'Captures current health.'], ['Module Manager Enabled', 'Restarts a failed optional module.'], ['Diagnostic Export', 'Creates a redacted support bundle.']],
    ['Browser Permissions Policy warnings originating in the game itself are not automatically Suite failures.']),

  section('whats-new', 'What’s New and Release Notes',
    'Current stabilization work emphasizes maintainability rather than additional regular-player features.',
    ['Review the repository CHANGELOG for release-by-release detail.', 'Use the Dashboard for installed versions and update availability.', 'Use this page for major user-facing changes.'],
    [['Current foundation', 'Versioned Client adapter, Hub schema, module API, diagnostics, performance budgets, EA migration workflow, and declarative module UI contract.'], ['Command Manual', 'Interactive searchable help and contextual module routing.']]),

  section('shared-interface', 'Shared Interface and Buttons',
    'Suite windows use the game’s Qooxdoo widgets and follow common behavior.',
    ['Click a right-side icon once to open its module; click it again to close the open module window.', 'Use Module Manager to enable, disable, open, or inspect module metadata.', 'Right-side groups organize Repair, Base Tools, World & Combat, Analysis, and Suite utilities.', 'Generated settings save immediately and persist across reloads.'],
    [['Enabled checkbox', 'Starts or stops a module and saves that choice.'], ['Open', 'Opens a module that provides a window.'], ['Refresh/Re-scan', 'Reads current game state again.'], ['Search', 'Filters or scans according to the fields beside it.'], ['Clear/Reset', 'Clears results or restores the current tool’s initial state.'], ['Copy', 'Copies formatted text, coordinates, or diagnostic output.'], ['Apply/Upgrade/Repair/Transfer', 'Executes the explicitly described action after any required confirmation.']],
    ['Buttons are visible only while their module is enabled.', 'Grey buttons are unavailable because the current view or game state does not support that action.']),

  section('module-manager', 'Module Manager',
    'Controls every installed Suite module and shows version, author, update date, UI schema, state, and description.',
    ['Open Module Manager from the top navigation or Suite dock.', 'Find a module in the scrollable list.', 'Toggle Enabled to start or stop it.', 'Click Open when the module has a window.'],
    [['Enabled', 'Enables or disables the module immediately.'], ['Open', 'Opens or closes the module window.']],
    ['Module Manager is required and cannot disable itself.']),

  section('launcher', 'Suite Dashboard',
    'A maintenance dashboard for installed, running, disabled, and update-available modules plus current-base and dependency information.',
    ['Open Suite Dashboard from the Suite icon group.', 'Click a metric card to filter Live Module Status.', 'Use Modules for detailed inventory and Dependencies for the dependency graph.'],
    [['Installed Modules', 'Lists every discovered module.'], ['Running', 'Shows enabled modules.'], ['Disabled', 'Shows disabled modules.'], ['Updates Available', 'Shows modules advertising a newer version.'], ['Refresh', 'Rebuilds live and static dashboard data.']]),

  section('war-room', 'War Room',
    'Target-centered attack planning, native simulations, cached results, reports, army analysis, target intelligence, formations, and combat statistics.',
    ['Enter any target’s attack screen; War Room makes that live target authoritative.', 'Use Search only to find and open a target—the search result does not own War Room state.', 'Choose an Attack Planner objective such as CY, DF, maximum RP, or destruction.', 'Click troops and then destination cells to test manual formations.', 'Run simulations, select a cached result to load its layout, and use play to show the game’s native animation.', 'Save useful formations and reload them later.'],
    [['Search', 'Finds bases, camps, outposts, or alliance targets by level and CP range.'], ['Simulate', 'Runs the current formation through the native simulator.'], ['Simulate & Play', 'Runs and displays native combat animation.'], ['Return to Attack Setup', 'Returns the game to editable attack formation.'], ['Save Formation', 'Stores the current offense arrangement.'], ['Load Formation', 'Restores a saved arrangement.'], ['Apply/Move Troops', 'Moves the live formation only after the user initiates it.']],
    ['Automated formation movement may be restricted by game rules; heed every warning and production setting.']),

  section('scanner', 'Scanner',
    'Searches visible world objects for camps, outposts, bases, and related targets using level, command-point, and filter criteria.',
    ['Choose target types.', 'Set minimum/maximum level and CP distance.', 'Start the scan and watch progress.', 'Filter or sort results.', 'Select a result to focus it or enter attack view.'],
    [['Scan', 'Starts a new scan.'], ['Pause/Resume', 'Stops after current work and later continues.'], ['Stop', 'Cancels the scan.'], ['Clear', 'Removes cached results.'], ['Focus', 'Centers the world on the selected result.'], ['Attack', 'Opens the target’s attack screen where supported.']]),

  section('base-intelligence', 'Base Intelligence',
    'Shows owned-base details, production, storage, repairs, composition, compact stickers, target attack capacity, loot, and nearby Forgotten-wave information.',
    ['Open the module for the owned-base overview.', 'Select a base to inspect its detailed data.', 'Click a world target to see injected attack capacity, lootable resources, per-CP values, and wave estimates.', 'Use compact or super-compact sticker settings where desired.'],
    [['Focus/Open Base', 'Makes the selected owned base current.'], ['Compact mode', 'Reduces the information sticker.'], ['Pin/Lock', 'Keeps or protects the sticker position.'], ['Refresh', 'Reads the latest Hub data.']]),

  section('repair-manager', 'Repair & Collection Manager',
    'Displays current-base repair/collection state, manual repair actions, optional automatic behaviors, quick buttons, and an activity log.',
    ['Open Repair Settings from the right navigation.', 'Enable only the automatic behaviors you approve.', 'Use quick repair icons when they become active.', 'Review the activity log for base name, action, and result.'],
    [['Repair Buildings', 'Repairs eligible damaged buildings.'], ['Repair Offense', 'Repairs eligible offense units.'], ['Repair Defense', 'Repairs eligible defense units.'], ['Collect Packages', 'Collects completed packages across owned bases where supported.'], ['Checkboxes', 'Independently enable each supported automatic behavior.']],
    ['Idle icons remain visible but grey; active icons become colored and clickable.']),

  section('upgrade-manager', 'Upgrade Manager and Quick Upgrade',
    'Calculates upgrade candidates, costs, affordability, shortfalls, and selected/all-eligible upgrades for the current Base, Defense, or Offense view.',
    ['Open the relevant Base, Defense, or Offense view.', 'Open Quick Upgrade from the base header or Upgrade Manager from the right dock.', 'Choose a target level.', 'Review Tiberium, Crystal, Credits, and Power requirements.', 'Upgrade the selected item or all currently affordable eligible items.'],
    [['– / +', 'Changes the target level and recalculates costs.'], ['Upgrade Selected', 'Upgrades the last selected building or unit.'], ['Upgrade N Now', 'Upgrades the affordable subset; it does not require every item to be affordable.'], ['Filters', 'Limit candidate categories and affordability.']],
    ['The Suite does not run unattended automatic upgrading.']),

  section('resource-transfer', 'Resource Transfer',
    'Plans and confirms resource movement from selected owned bases into the current base while respecting storage and transfer constraints.',
    ['Make the destination base current.', 'Open Resource Transfer.', 'Select source bases and resource percentages or amounts.', 'Review capacity, fees, and proposed transfers.', 'Confirm the transfer.', 'Configure a per-destination Quick Transfer profile if desired.'],
    [['All Resources', 'Transfers configured Tiberium and Crystal.'], ['All Crystal', 'Transfers available Crystal only.'], ['All Tiberium', 'Transfers available Tiberium only.'], ['Percentage fields', 'Sets the share taken from each source.'], ['Source checkboxes', 'Include or exclude individual bases.'], ['Confirm', 'Submits the displayed transfer plan.']]),

  section('layout-optimizer', 'Layout Optimizer',
    'Creates ranked 9×4 proposed base layouts for resource goals and constraints and compares current versus proposed production.',
    ['Open the base you want to optimize.', 'Choose Tiberium, Crystal, Power, Balanced, or custom weights.', 'Mark fixed buildings and allowed replacements.', 'Set storage and maximum-move constraints.', 'Generate alternatives and inspect the visual grid.', 'Use one-click movement only in explicitly permitted testing conditions.'],
    [['Generate/Optimize', 'Calculates ranked layouts.'], ['Alternative selector', 'Changes the displayed proposal.'], ['Fixed', 'Prevents a building from moving.'], ['Replaceable', 'Allows replacement recommendations.'], ['Apply Moves', 'Performs proposed moves after a rule warning and confirmation.']],
    ['Proposals are advisory; automatic building movement may violate game rules and should remain disabled for production unless officially permitted.']),

  section('next-mcv', 'Next MCV',
    'Shows Credits and Research Points required for the next base, current amounts, remaining amounts, ETA, and combined progress.',
    ['Open Next MCV from its clock icon or Module Manager.', 'Read current, required, and remaining values.', 'Use Refresh after research or credit changes.', 'Use standalone compact/expanded controls as needed.'],
    [['Clock icon', 'Opens or closes the right-side MCV panel.'], ['Refresh/Base Data', 'Reads the current Research_BaseFound requirement from the Hub.'], ['–', 'Reduces the standalone window.'], ['X', 'Closes the standalone window.']]),

  section('context-actions', 'Context Actions and Strategic Planning',
    'Adds configurable actions to native map-object menus and supports non-committing strategic-map plans.',
    ['Click a base, camp, outpost, ruin, or supported map object.', 'Use added actions such as War Room, Scan Nearby, Base Information, or planning actions.', 'For planning, choose move, ruin, ruin-for, level, or remove and preview territory/tunnel effects.', 'Undo or reset planned changes when finished.'],
    [['Options', 'Chooses which contextual actions appear.'], ['Copy Coordinates', 'Copies selected coordinates.'], ['Plan Move Base', 'Previews relocation effects without committing a real move.'], ['Plan Ruin / Ruin For', 'Previews ruin ownership and influence.'], ['Plan Level', 'Changes simulated object level.'], ['Plan Remove', 'Removes an object only from simulated state.'], ['Undo', 'Reverts the latest planned change.'], ['Reset', 'Returns the simulated map to live state.']]),

  section('alliance', 'Alliance Intelligence',
    'Alliance overview, roster and member analysis, invitations, alerts, and information tools in a Suite-owned window.',
    ['Open Alliance Intelligence from the right dock or Module Manager.', 'Use overview/roster information for current alliance state.', 'In Invitations, choose a search criterion and filters.', 'Sort results and select no more players than available invitation slots.', 'Only send invitations when your rank and game rules permit it.'],
    [['Search', 'Finds ranked, unaffiliated, or specified-alliance players.'], ['Filters/columns', 'Limit and sort by score, bases, offense, defense, or alliance.'], ['Select', 'Marks invitation candidates.'], ['Send Invitations', 'Submits selected invitations after confirmation.']],
    ['CiC/SiC/officer restrictions and expanded alliance-management workflows remain a later development area.']),

  section('combat-reports', 'Combat Reports',
    'Filters and aggregates PvE/PvP report history, loot, experience, repairs, outcomes, trends, and favorite targets.',
    ['Open Combat Reports.', 'Choose report type, outcome, target, or date filters.', 'Sort the report table.', 'Inspect totals and averages.', 'Open a report or save a target as a favorite where available.'],
    [['Filters', 'Select report subsets.'], ['Refresh', 'Reads report data again.'], ['Favorite', 'Saves or removes the selected target.'], ['Open', 'Opens the native report when available.']]),

  section('communications', 'Communications',
    'Composes reusable game BBCode, inserts selected player/base details, summarizes nearby waves, and stores whisper contacts.',
    ['Type or paste text in the editor.', 'Use formatting buttons around the current content.', 'Insert coordinates, player details, or Forgotten-wave summaries.', 'Maintain whisper contacts.', 'Copy the final text into game chat or mail.'],
    [['Bold/Italic/Strike/Underline', 'Wraps editor text in BBCode.'], ['Player/Alliance/Coordinates', 'Adds the matching BBCode tags.'], ['URL', 'Adds a URL tag.'], ['Selected Coordinates', 'Appends the current coordinates.'], ['Player Details', 'Appends formatted player/base information.'], ['Forgotten Waves', 'Appends a nearby-wave summary.'], ['Add/Remove Selected', 'Maintains contacts.'], ['Copy for Chat or Mail', 'Copies the composition.']]),

  section('tactical-map', 'Tactical Map',
    'Displays a compact categorized map around the current location with own, alliance, enemy, Forgotten, POI, and saved-target markers.',
    ['Open Tactical Map.', 'Choose radius/zoom and visible categories.', 'Inspect marker tooltips.', 'Save important targets or focus them in the world.'],
    [['Zoom/Radius', 'Changes map scale and scan area.'], ['Category controls', 'Shows or hides object classes.'], ['Lines', 'Shows configured relationships or paths.'], ['Save Target', 'Marks a target for later reference.'], ['Focus', 'Centers the game map.']]),

  section('world-tools', 'World and POI Tools',
    'World-object, POI, tunnel, route, and center-path analysis for planning movement and alliance digs.',
    ['Open World Tools.', 'Choose current origin, destination/center, and corridor width.', 'Run POI or tunnel search.', 'Sort results by distance, type, level, or route position.', 'Use results as planning information.'],
    [['POI Search', 'Finds POIs along the configured center path.'], ['Corridor width', 'Sets distance allowed from the route line.'], ['Tunnel search', 'Finds relevant tunnels and requirements.'], ['Focus', 'Centers the map on a result.']]),

  section('support-manager', 'Support Manager',
    'Displays support-building composition, calibration state, ranges, and related planning information.',
    ['Open an owned base and Support Manager.', 'Review support type, level, condition, and calibration.', 'Use the information to perform permitted native support actions manually.'],
    [['Refresh', 'Reads support state again.'], ['Focus/Open Base', 'Moves to the support-owning base.']],
    ['The Suite does not perform unattended support calibration or recalls.']),

  section('api-inspector', 'API Inspector',
    'Developer and support tool for viewing safe snapshots of the public Suite API, Hub, compatibility capabilities, and registered objects.',
    ['Open API Inspector.', 'Choose a snapshot category.', 'Refresh after changing game state.', 'Export only when troubleshooting.'],
    [['Refresh', 'Rebuilds the selected snapshot.'], ['Copy/Export', 'Copies a sanitized diagnostic representation.']],
    ['Sensitive and mutable fields are omitted or redacted; still review exports before sharing.']),

  section('suite-status', 'Suite Status',
    'Generated live view of integration health, compatibility, EA build verification, event errors, logs, performance, cache, hooks, and observers.',
    ['Open Suite Status.', 'Look for red Needs Attention rows.', 'Use Refresh to capture current state.', 'Use diagnostics export when reporting persistent failures.'],
    [['Refresh', 'Refreshes diagnostic providers.']],
    ['One isolated performance spike is retained statistically; warnings require three consecutive budget breaches.']),

  section('ui-tools', 'UI Tools',
    'Manages Suite window pin, lock, compact, auto-hide, visibility, and compatible native overlay movement.',
    ['Select an open Suite window.', 'Choose the desired window action.', 'Re-scan after opening new native overlays.'],
    [['Pin / Unpin', 'Controls always-on-top state.'], ['Lock / Unlock', 'Prevents or permits moving/resizing.'], ['Compact / Expand', 'Changes supported window size.'], ['Auto-hide On / Off', 'Hides inactive windows.'], ['Show Window', 'Reveals the selected window.'], ['Re-scan UI', 'Finds compatible native overlays.']]),

  section('hotkeys', 'Keyboard Shortcuts (Hotkeys)',
    'Configures keyboard shortcuts for common Suite navigation and insertion actions.',
    ['Open Hotkeys.', 'Enter combinations such as Alt+M or Ctrl+Shift+W.', 'Click elsewhere to commit the field.', 'Test outside text-entry fields.'],
    [['Shortcut fields', 'Save immediately through the settings schema.']],
    ['Shortcuts are ignored while typing in input or text-area controls.']),

  section('external-tools', 'External Analysis',
    'Provides optional links or export formats for external analysis without making external services the owner of Suite data.',
    ['Open External Analysis.', 'Choose the supported output/tool.', 'Review the generated data or destination.', 'Explicitly continue to the external tool if desired.'],
    [['Generate/Copy', 'Creates the selected interchange data.'], ['Open', 'Opens an external destination after user action.']],
    ['External services have their own privacy and availability policies.']),

  section('command-manual', 'Command Manual',
    'The searchable manual you are reading. It covers shared controls, every installed module, workflows, safety notes, troubleshooting concepts, and glossary terms.',
    ['Open the booklet from the book icon in the Suite group.', 'Type in Search to filter titles and full instruction text.', 'Choose an entry in the table of contents.', 'Use Previous and Next to read sequentially.', 'Use Installed Modules to see live version and enabled-state information.'],
    [['Search', 'Filters the table of contents and matching subtopics.'], ['Table of Contents', 'Opens a guide.'], ['Previous / Next', 'Moves between guide sections.'], ['Installed Modules', 'Shows registry-derived module metadata.'], ['Close', 'Closes Command Manual; no game state is changed.']]),

  section('glossary', 'Glossary of Terms',
    'Common game and Suite terminology.', [], [
      ['Base', 'A player-owned or player-controlled city.'], ['Camp', 'A temporary Forgotten NPC target.'], ['Outpost', 'A Forgotten NPC target that may become a base.'], ['POI', 'Point of Interest providing alliance bonuses.'], ['MCV', 'Mobile Construction Vehicle; shorthand for founding the next base.'], ['CY', 'Construction Yard.'], ['DF', 'Defense Facility.'], ['CC', 'Command Center.'], ['CP', 'Command Points spent to attack.'], ['RT', 'Repair Time or stored repair charge.'], ['RP', 'Research Points.'], ['PvE', 'Player versus environment/Forgotten combat.'], ['PvP', 'Player versus player combat.'], ['CiC', 'Commander in Chief.'], ['SiC', 'Second in Command.'], ['Hub', 'Suite-owned normalized data layer between ClientLib and modules.'], ['ClientLib', 'EA game client API; modules should access it through Suite adapters/Hub.'], ['Qooxdoo', 'The UI framework used by Tiberium Alliances and Suite native widgets.'], ['Native simulation', 'A battle calculation performed through the game simulator.'], ['Formation', 'Offense troop arrangement before an attack.'], ['Loot', 'Resources gained from attacking a target.'], ['Waves', 'Estimated groups of Forgotten attacks/bases in range.'], ['Runtime fingerprint', 'Suite-generated identifier for an EA client build when no version is exposed.'], ['Capability', 'A detected game API function the Suite can use.'], ['Degraded mode', 'Core remains usable while an optional capability is unavailable.'], ['Module API', 'Versioned contract between Suite Core and modules.'], ['Hub schema', 'Versioned shape of normalized Hub snapshots.'], ['Declarative module', 'Module whose common UI and behavior are defined as structured data.'], ['Custom-renderer bridge', 'Declarative contract wrapper for specialized Qooxdoo interfaces.'], ['Quick dock', 'Suite icon buttons placed in the base header or right navigation.'], ['Context action', 'Action added to the menu of a selected map object.'], ['Support bundle', 'Redacted diagnostic JSON produced for troubleshooting.']
    ])
]);

export const MANUAL_BY_ID = Object.freeze(Object.fromEntries(MANUAL_SECTIONS.map((entry) => [entry.id, entry])));

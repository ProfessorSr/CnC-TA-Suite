# War Room

War Room v1.0.0 is the Suite's unified combat workspace.

Data flow:

`ClientLib -> GameDataHub -> WarRoomHub -> analyzers -> WarRoomWindow`

Sections:

- Search and Target Information
- Attack Planner
- Battle Simulator
- Report Summary
- Army Analyzer
- Combat Statistics

Search is the first/default tab and reuses the shared Scanner Hub discovery service. It can search from the current attacker base by target type, minimum/maximum level, distance, and maximum command-point cost. Base, Camp, and Outpost filters can be combined. Alliance mode is mutually exclusive and supplies an alliance selector populated from the alliances in the loaded world-sector data. Search only discovers targets; it does not own War Room selection. Selecting a result opens the game's native attack screen, and the target currently open in that screen is the sole authoritative subject for every War Room tab. The same rule applies when an attack screen is opened from the world map or another tool.

Select an attacker and target in the game before opening or refreshing War Room. The simulator action opens the native combat-setup view. Native battle results, attack history, and favorite targets persist locally between sessions. Alliance-shared intelligence remains a planned extension.

Attack Planner analyzes the current offensive formation and loaded target defense, then renders a visual 9×4 recommendation for Construction Yard, Defense Facility, Command Center, total defense damage, or maximum Research Points goals. Its initial preview uses unit roles and lane threats. Preview controls provide undo, redo, reset, four-way shifts, horizontal/vertical mirrors, and row swaps without touching the live formation. Clicking Simulate Best Formation submits non-destructive candidates to the game's native `SimulateBattle` command and ranks the returned combat results by the selected objective. The search does not move live units and observes the game's simulation cooldown.

The user-initiated **one-click formation arranger** can apply the displayed preview or any cached simulated formation to the active attack setup through the game's formation movement API. It requires explicit confirmation, never launches an attack, and remains independently disableable with `EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED` without removing read-only planning or simulation.

Formation presets are stored persistently by attacking base. A preset captures unit positions and enabled state, can be overwritten by saving the same name, and can be loaded into any active attack screen using the same attacking base and matching army composition. Loading a preset changes the live combat-setup formation and therefore queues a fresh native simulation.

The Battle Simulator automatically shows the current and cached native results as sortable text data plus side-by-side result cards. Each card includes defender condition, own repair, loot, outcome, and duration. Its **Sim** button switches the main game play area to that exact cached battle animation; **Use** arranges the active formation after confirmation. Compact selected-unit arrows and Hide/Show controls edit the reversible preview before **Use Preview** commits it. Automatic simulations caused by troop movement update results silently and never interrupt combat setup.

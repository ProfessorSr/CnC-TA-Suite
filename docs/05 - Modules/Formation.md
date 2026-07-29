# Formation

> Status: Implemented through War Room and shared formation models

Core `FormationModel` and `UnitModel` wrap battle formations, slots, sides, and units. War Room provides the formation UI as a native Qooxdoo 9-by-4 grid.

Users can select a troop and then select a destination cell. Empty destinations move the troop; occupied destinations swap the two troops. Preview operations also include undo, redo, reset, four-direction shifts, horizontal and vertical mirrors, row swaps, individual visibility, and bulk visibility by troop class or row. The troop legend is displayed vertically beside the planner and uses distinct multi-character codes for similarly named units.

Preview changes remain in Suite memory until the user explicitly confirms Apply. **Simulate Preview** sends the exact preview arrangement to the native simulator without changing the live formation. Saved presets retain unit identity, level, coordinates, enabled state, and transporter/garrison identifiers and are validated against the active attacking army before loading.

Opening or changing a native attack target gives that target authority over War Room, automatically opens the planner, and refreshes every dependent tab. Search results only locate targets; they do not own War Room state.

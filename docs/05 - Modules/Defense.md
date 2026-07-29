# Defense

> Status: Implemented across War Room, Base Intelligence, Repair Manager, and Upgrade Manager

Defense functionality is intentionally distributed rather than exposed as a redundant standalone window. War Room reads target defensive units and structures for native simulation, objective ranking, target intelligence, and damage summaries. Base Intelligence reports owned-base defense levels, composition, condition, repair capacity, and region details. Repair Manager provides explicit defense repair controls, while Quick Upgrade follows the active Defense view and upgrades the currently affordable eligible subset toward the selected level.

All data flows through shared game/Hub services. Repairs and upgrades are user-initiated; no unattended defense automation is enabled.

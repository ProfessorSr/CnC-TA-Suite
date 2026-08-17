# Scanner

Scanner v0.6.0 searches nearby bases, camps, outposts, and player/alliance targets through the shared Scanner Hub. Target type, relationship, level, distance, and command-point controls limit discovery before layouts are loaded.

Two independent layout filters apply together. The resource filter supports All Layouts, 7 Tiberium/5 Crystal, 6 Tiberium/6 Crystal, and 5 Tiberium/7 Crystal. The silo filter supports N/A, 2 Touch 4 Tiberium, and 2 Touch 5 Tiberium. A silo match requires at least two separate empty positions that can each touch the selected minimum number of adjacent Tiberium fields, including diagonal adjacency.

**Get Layouts** renders selectable cards with field counts and the number of four-touch and five-touch silo positions. Selected cards can be exported as coordinates plus CNCOpt mini links, saved in Suite storage across refreshes, reopened under **Saved Layouts**, removed, or focused on the world map. Scanning and export do not launch attacks.

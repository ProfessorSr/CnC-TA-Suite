# Alliance Intelligence

The **Invitations** tab searches live world player rankings for top players,
players without an alliance, or members of a selected alliance. Results support
native table sorting and live filters for name, alliance, base count, score,
offense level, and defense level. Multiple selected candidates can be invited up
to the alliance's available membership/invitation capacity. Sending always
requires an explicit confirmation; server permission errors remain visible while
rank-based UI gating is intentionally disabled during testing.

Alliance Intelligence provides a Suite-owned window with alliance score,
rank, bonuses, members, owned POIs, POI score/rank/tier comparisons, and map
markers. Suite markers can remain browser-private or be shared with alliance
members who use CnC-TA-Suite through the native alliance-marker channel.
Private markers persist locally through refreshes. Shared marker creation is
verified against the game's returned marker collection before success is shown.

Native base, camp, and outpost menus expose **Add Custom Marker** and
**Remove Custom Marker** actions through Context Actions. Marker labels, colors,
coordinates, ownership scope, and saved state are managed from the Alliance
Intelligence marker view.

Enable it in Module Manager, then open it from Module Manager or the right-side
Suite shortcut panel. The game's native Alliance navigation and window remain
unchanged. The module reads already-loaded game data and performs no automatic
alliance actions or background commands.

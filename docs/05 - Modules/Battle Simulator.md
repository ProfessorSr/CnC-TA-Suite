# Battle Simulator

> Status: Implemented in War Room; live-game compatibility validation remains ongoing

War Room uses the game's native `SimulateBattle` command rather than an extension-owned combat approximation. It submits the active or previewed formation, receives native combat data, normalizes build-dependent callback collections, and presents defender health, own-army health, objective damage, repair time, loot, duration, outcome, morale, and auto-repair information.

The Battle Simulator tab compares cached candidates and the live formation. Results can be replayed through the game's animated battleground; Return to Attack Setup restores the last target. Replay loading discovers the current obfuscated ClientLib loader using the same runtime relationship used by the native simulation API rather than assuming a stable internal method name.

Attack Planner supports three bounded search sizes:

- **Quick:** a smaller representative candidate set.
- **Detailed:** whole-formation transforms plus targeted individual moves and swaps.
- **Exhaustive:** a larger bounded set of individual placement alternatives.

Candidate construction, deduplication, caching, and ranking happen locally. Every uncached candidate is sent to EA's native simulator, so EA can observe these requests. Searches respect a cooldown between requests. Repeating an unchanged target/version/formation can reuse the local cache.

The planner prioritizes a true one-shot result when total defender health reaches zero, then ranks remaining candidates by the chosen objective, total defender health, and blocking-column health. Goals currently include Construction Yard, Defense Facility, Command Center, total defense damage, and research/loot targeting.

Simulation never launches an attack. Applying a proposed formation is a distinct confirmed action; manual preview simulation does not move live troops.

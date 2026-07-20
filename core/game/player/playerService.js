function resourceAmount(value) {
  if (value != null) {
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;
  }

  for (const key of ['Base', 'base', 'Current', 'current', 'Value', 'value', 'Amount', 'amount', 'Count', 'count']) {
    const candidate = Number(value?.[key]);
    if (Number.isFinite(candidate)) return candidate;
  }
  for (const method of ['get_Base', 'get_Current', 'get_Value', 'get_Amount', 'get_Count']) {
    try {
      const candidate = Number(value?.[method]?.());
      if (Number.isFinite(candidate)) return candidate;
    } catch {
      // Guarded ClientLib resource object.
    }
  }
  return null;
}

export class PlayerService {
  constructor({ clientLib, cache, logger }) {
    this.clientLib = clientLib;
    this.cache = cache;
    this.logger = logger;
  }

  raw() {
    return this.cache.get('player:raw', () => this.clientLib.getPlayer(), {
      ttl: 500
    }) ?? null;
  }

  snapshot({ refresh = false } = {}) {
    if (refresh) this.invalidate();

    return this.cache.get('player:snapshot', () => {
      const player = this.raw();
      if (!player) return null;

      return Object.freeze({
        id: this.clientLib.call(player, ['get_Id', 'get_PlayerId']) ?? null,
        name: this.clientLib.call(player, ['get_Name', 'get_PlayerName']) ?? null,
        faction: this.clientLib.call(player, ['get_Faction', 'get_FactionId']) ?? null,
        allianceId: this.clientLib.call(player, ['get_AllianceId']) ?? null,
        allianceName: this.clientLib.call(player, ['get_AllianceName']) ?? null,
        rank: this.clientLib.call(player, ['get_Rank', 'get_PlayerRank']) ?? null,
        score: this.clientLib.call(player, ['get_ScorePoints', 'get_Score']) ?? null,
        commandPoints: this.clientLib.call(player, ['get_CommandPointCount', 'get_CommandPoints']) ?? null,
        credits: resourceAmount(this.clientLib.call(player, [
          'GetCreditsCount',
          'get_CreditsCount',
          'GetCredits',
          'get_Credits'
        ])),
        researchPoints: resourceAmount(this.clientLib.call(player, [
          'GetResearchPoints',
          'get_ResearchPoints'
        ]))
      });
    }, { ttl: 1000 }) ?? null;
  }

  current(options) { return this.snapshot(options); }
  getId() { return this.snapshot()?.id ?? null; }
  getName() { return this.snapshot()?.name ?? null; }
  getFaction() { return this.snapshot()?.faction ?? null; }

  invalidate() {
    this.cache.invalidate('player');
  }
}

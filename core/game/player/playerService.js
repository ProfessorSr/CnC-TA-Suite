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
        credits: this.clientLib.call(player, ['get_CreditsCount', 'get_Credits']) ?? null,
        researchPoints: this.clientLib.call(player, ['get_ResearchPoints']) ?? null
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

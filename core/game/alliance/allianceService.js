export class AllianceService {
  constructor({ clientLib, cache, player, logger }) {
    this.clientLib = clientLib;
    this.cache = cache;
    this.player = player;
    this.logger = logger;
  }

  raw() {
    return this.cache.get('alliance:raw', () => {
      const mainData = this.clientLib.getMainData();
      return this.clientLib.call(mainData, [
        'get_Alliance',
        'get_AllianceData'
      ]) ?? null;
    }, { ttl: 1500 }) ?? null;
  }

  current() {
    return this.cache.get('alliance:snapshot', () => {
      const raw = this.raw();
      const player = this.player.current();
      if (!raw && !player?.allianceId) return null;

      return Object.freeze({
        raw,
        id: this.clientLib.call(raw, ['get_Id', 'get_AllianceId'])
          ?? player?.allianceId
          ?? null,
        name: this.clientLib.call(raw, ['get_Name', 'get_AllianceName'])
          ?? player?.allianceName
          ?? null,
        rank: this.clientLib.call(raw, ['get_Rank']) ?? null,
        memberCount: this.clientLib.call(raw, ['get_MemberCount', 'get_NumMembers']) ?? null
      });
    }, { ttl: 2500 }) ?? null;
  }

  invalidate() {
    this.cache.invalidate('alliance');
  }
}

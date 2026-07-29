function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] !== 'function') continue;
      const value = target[name](...args);
      if (value != null) return value;
    } catch { /* Alliance data can be incomplete while the overlay loads. */ }
  }
  return null;
}

function values(collection) {
  if (!collection) return [];
  const source = collection.d ?? collection.l ?? collection;
  return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const ONLINE = Object.freeze({
  0: Object.freeze({ label: 'Offline', order: 3 }),
  1: Object.freeze({ label: 'Online', order: 0 }),
  2: Object.freeze({ label: 'Away', order: 1 }),
  3: Object.freeze({ label: 'Hidden', order: 2 })
});

export class AllianceHub {
  constructor(context) { this.context = context; }

  client() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.client()?.root ?? globalThis.ClientLib ?? null; }
  main() { return this.client()?.getMainData?.() ?? this.root()?.Data?.MainData?.GetInstance?.(); }
  alliance() { return call(this.main(), ['get_Alliance']); }

  command(name, payload, timeoutMs = 15000) {
    const communication = this.root()?.Net?.CommunicationManager?.GetInstance?.();
    const commandResult = this.root()?.Net?.CommandResult;
    const delegateFactory = globalThis.webfrontend?.phe?.cnc?.Util?.createEventDelegate
      ?? globalThis.webfrontend?.Util?.createEventDelegate;
    if (!communication?.SendSimpleCommand || !delegateFactory) {
      return Promise.reject(new Error('The game command service is unavailable.'));
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${name} timed out.`)), timeoutMs);
      const receiver = { done(_status, response) {
        clearTimeout(timeout);
        if (response == null) reject(new Error(`${name} returned no data.`));
        else resolve(response);
      } };
      communication.SendSimpleCommand(
        name, payload, delegateFactory(commandResult, receiver, receiver.done), null
      );
    });
  }

  async rankedAlliances(limit = 3000) {
    const response = await this.command('RankingGetData', {
      firstIndex: 0, lastIndex: Math.max(0, limit - 1), ascending: true,
      view: this.root()?.Data?.Ranking?.EViewType?.Alliance ?? 1,
      rankingType: this.root()?.Data?.Ranking?.ERankingType?.Score ?? 0,
      sortColumn: 2
    });
    return values(response.a ?? response.alliances).map((entry, index) => ({
      id: String(entry.a ?? entry.i ?? entry.id ?? ''),
      name: String(entry.an ?? entry.n ?? entry.name ?? 'Unknown alliance'),
      rank: finite(entry.r ?? entry.rank ?? index + 1),
      score: finite(entry.s ?? entry.score)
    })).filter((entry) => entry.id || entry.name !== 'Unknown alliance');
  }

  normalizeRankedPlayer(entry, index) {
    const allianceId = entry.a ?? entry.ai ?? entry.allianceId ?? 0;
    return {
      id: String(entry.p ?? entry.pi ?? entry.i ?? entry.id ?? ''),
      name: String(entry.pn ?? entry.n ?? entry.name ?? 'Unknown player'),
      rank: finite(entry.r ?? entry.rank ?? index + 1),
      score: finite(entry.s ?? entry.score ?? entry.ps),
      bases: finite(entry.bc ?? entry.b ?? entry.bases ?? entry.baseCount),
      offense: finite(entry.ol ?? entry.o ?? entry.offense ?? entry.offenseLevel),
      defense: finite(entry.dl ?? entry.d ?? entry.defense ?? entry.defenseLevel),
      allianceId: String(allianceId || ''),
      alliance: String(entry.an ?? entry.allianceName ?? ''),
      faction: String(entry.f ?? entry.faction ?? '')
    };
  }

  async searchPlayers({ mode = 'top', limit = 100, allianceId = '', allianceName = '' } = {}) {
    const response = await this.command('RankingGetData', {
      firstIndex: 0, lastIndex: Math.max(0, Math.min(2999, limit - 1)), ascending: true,
      view: this.root()?.Data?.Ranking?.EViewType?.Player ?? 0,
      rankingType: this.root()?.Data?.Ranking?.ERankingType?.Score ?? 0,
      sortColumn: 2
    });
    let players = values(response.p ?? response.players ?? response.a)
      .map((entry, index) => this.normalizeRankedPlayer(entry, index))
      .filter((player) => player.id || player.name !== 'Unknown player');
    if (mode === 'no-alliance') players = players.filter((player) => !player.allianceId && !player.alliance);
    if (mode === 'alliance') players = players.filter((player) =>
      (allianceId && player.allianceId === String(allianceId))
      || (allianceName && player.alliance.toLowerCase() === allianceName.toLowerCase())
    );
    return players;
  }

  invitationCapacity() {
    const alliance = this.alliance();
    const overview = this.overview();
    const server = call(this.main(), ['get_Server']);
    const maximum = finite(call(alliance, ['get_MaxMembers', 'get_MemberLimit'])
      ?? call(server, ['get_MaxAllianceMembers'])) || 50;
    const pending = values(call(alliance, [
      'get_SentInvitations', 'get_OutgoingInvitations', 'get_Invitations'
    ])).length;
    return { maximum, members: overview.members, pending,
      available: Math.max(0, maximum - overview.members - pending) };
  }

  async invitePlayer(player) {
    if (!player?.name) throw new Error('Select a valid player.');
    const response = await this.command('InvitePlayer', { name: player.name });
    const errorCode = finite(response.ec ?? response.errorCode ?? response.e);
    if (response.ok === false || errorCode) {
      throw new Error(response.message ?? response.m ?? `The server rejected the invite (code ${errorCode}).`);
    }
    return response;
  }

  overview() {
    const alliance = this.alliance();
    return {
      exists: Boolean(call(alliance, ['get_Exists'])),
      id: call(alliance, ['get_Id']) ?? 0,
      name: String(call(alliance, ['get_Name']) ?? 'No alliance'),
      abbreviation: String(call(alliance, ['get_Abbreviation']) ?? ''),
      rank: finite(call(alliance, ['get_Rank'])),
      eventRank: finite(call(alliance, ['get_EventRank'])),
      totalScore: finite(call(alliance, ['get_TotalScore'])),
      averageScore: finite(call(alliance, ['get_AverageScore'])),
      eventScore: finite(call(alliance, ['get_EventScore'])),
      members: finite(call(alliance, ['get_NumMembers'])),
      bonuses: {
        tiberium: finite(call(alliance, ['get_POITiberiumBonus'])),
        crystal: finite(call(alliance, ['get_POICrystalBonus'])),
        power: finite(call(alliance, ['get_POIPowerBonus'])),
        infantry: finite(call(alliance, ['get_POIInfantryBonus'])),
        vehicle: finite(call(alliance, ['get_POIVehicleBonus'])),
        air: finite(call(alliance, ['get_POIAirBonus'])),
        defense: finite(call(alliance, ['get_POIDefenseBonus']))
      }
    };
  }

  members() {
    const alliance = this.alliance();
    const members = values(call(alliance, ['get_MemberDataAsArray']))
      .concat(values(call(alliance, ['get_MemberData'])));
    const unique = new Map();
    for (const member of members) {
      const name = String(member.Name ?? member.n ?? call(member, ['get_Name']) ?? 'Unknown');
      const id = String(member.Id ?? member.i ?? member.PlayerId ?? name);
      const onlineState = finite(member.OnlineState ?? member.o ?? call(member, ['get_OnlineState']));
      unique.set(id, {
        id, name,
        role: String(member.RoleName ?? member.rn ?? member.Role ?? 'Member'),
        onlineState,
        online: ONLINE[onlineState]?.label ?? 'Unknown',
        onlineOrder: ONLINE[onlineState]?.order ?? 4,
        score: finite(member.Score ?? member.s),
        rank: finite(member.Rank ?? member.r),
        bases: finite(member.Bases ?? member.BaseCount ?? member.bc),
        pvp: finite(member.PvPScore ?? member.pvp),
        pve: finite(member.PvEScore ?? member.pve),
        pvpKills: finite(member.PvPKills ?? member.pvpk ?? member.PlayerKills),
        pveKills: finite(member.PvEKills ?? member.pvek ?? member.NpcKills),
        veteranPoints: finite(member.VeteranPoints ?? member.vp),
        eventPoints: finite(member.EventPoints ?? member.ep),
        baseLevels: values(member.BaseLevels ?? member.Cities ?? member.bl).map((base) =>
          finite(base.Level ?? base.l ?? base)
        ).filter(Boolean)
      });
    }
    return [...unique.values()].sort((a, b) =>
      a.onlineOrder - b.onlineOrder || a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
    );
  }

  poiName(type) {
    try {
      const info = globalThis.webfrontend?.phe?.cnc?.gui?.util?.Text?.getPoiInfosByType?.(type);
      return String(info?.name ?? info?.type ?? `Type ${type}`);
    } catch { return `Type ${type}`; }
  }

  pois() {
    const score = this.root()?.Base?.PointOfInterestTypes?.GetScoreByLevel;
    return values(call(this.alliance(), ['get_OwnedPOIs'])).map((poi) => ({
      typeId: finite(poi.t ?? poi.Type),
      type: this.poiName(poi.t ?? poi.Type),
      level: finite(poi.l ?? poi.Level),
      score: typeof score === 'function' ? finite(score(poi.l ?? poi.Level)) : 0,
      x: finite(poi.x ?? poi.X),
      y: finite(poi.y ?? poi.Y),
      owner: String(poi.OwnerName ?? poi.on ?? this.overview().name),
      player: String(poi.PlayerName ?? poi.pn ?? ''),
      base: String(poi.BaseName ?? poi.bn ?? ''),
      sector: String(poi.SectorName ?? poi.sector ?? poi.s ?? '—')
    })).sort((a, b) => a.type.localeCompare(b.type) || b.level - a.level);
  }

  poiAnalysis() {
    const ranks = values(call(this.alliance(), ['get_POIRankScore']));
    const util = this.root()?.Base?.PointOfInterestTypes;
    const start = finite(this.root()?.Base?.EPOIType?.RankedTypeBegin);
    const server = call(this.main(), ['get_Server']);
    const globalFactor = finite(call(server, ['get_POIGlobalBonusFactor'])) || 1;
    return ranks.map((rank, index) => {
      const type = util?.GetPOITypeFromPOIRanking?.(index) ?? (start + index);
      const score = finite(rank.s ?? rank.Score);
      const previous = finite(rank.ps ?? rank.PreviousScore);
      const next = finite(rank.ns ?? rank.NextScore);
      const nextTier = finite(util?.GetNextScore?.(score));
      const previousTier = finite(util?.GetPreviousScore?.(score));
      const multiplier = finite(util?.GetBoostModifierByRank?.(finite(rank.r ?? rank.Rank)));
      const baseBonus = finite(util?.GetBonusByType?.(type, score, globalFactor));
      const totalBonus = baseBonus * (1 + multiplier / 100);
      return {
        type: this.poiName(type),
        rank: finite(rank.r ?? rank.Rank),
        score, previous, next,
        below: Math.max(0, score - previous),
        above: Math.max(0, next - score),
        previousTier,
        previousTierMargin: Math.max(0, score - previousTier),
        nextTier,
        tierShortfall: Math.max(0, nextTier - score), multiplier, baseBonus, totalBonus
      };
    });
  }

  simulatePoiChanges(changes = []) {
    const util = this.root()?.Base?.PointOfInterestTypes;
    const server = call(this.main(), ['get_Server']);
    const factor = finite(call(server, ['get_POIGlobalBonusFactor'])) || 1;
    const start = finite(this.root()?.Base?.EPOIType?.RankedTypeBegin);
    return this.poiAnalysis().map((current, index) => {
      const type = start + index;
      const delta = changes.filter((item) => Number(item.typeId) === Number(type))
        .reduce((sum, item) => sum + finite(item.score) * (item.action === 'remove' ? -1 : 1), 0);
      const projectedScore = Math.max(0, current.score + delta);
      const projectedBaseBonus = finite(util?.GetBonusByType?.(type, projectedScore, factor));
      const projectedTotalBonus = projectedBaseBonus * (1 + current.multiplier / 100);
      return { ...current, typeId: type, projectedScore, projectedTotalBonus,
        bonusChange: projectedTotalBonus - current.totalBonus };
    });
  }

  focusPoi(poi) {
    if (!poi) throw new Error('Select a POI first.');
    const vis = this.root()?.Vis?.VisMain?.GetInstance?.();
    if (typeof vis?.CenterGridPosition !== 'function') throw new Error('World-map focus is unavailable.');
    vis.CenterGridPosition(poi.x, poi.y);
    vis.Update?.();
    vis.ViewUpdate?.();
  }

  exportOwnedPois() {
    const header = 'Type,Level,Score,Owner,Coordinates,Sector';
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [header, ...this.pois().map((poi) => [
      poi.type, poi.level, poi.score, poi.owner, `${poi.x}:${poi.y}`, poi.sector
    ].map(quote).join(','))].join('\n');
  }

  exportOwnedBases() {
    const cities = call(this.main(), ['get_Cities']);
    const all = values(call(cities, ['get_AllCities']));
    const header = 'Base\tCoordinates\tBase level\tOffense\tDefense\tCondition\tSupport';
    return [header, ...all.map((city) => [
      call(city, ['get_Name']) ?? 'Base',
      `${finite(call(city, ['get_PosX']))}:${finite(call(city, ['get_PosY']))}`,
      finite(call(city, ['get_LvlBase', 'get_BaseLevel'])), finite(call(city, ['get_LvlOffense'])),
      finite(call(city, ['get_LvlDefense'])), finite(call(city, ['GetBuildingsConditionInPercent'])),
      call(call(city, ['get_SupportWeapon']), ['get_Name']) ?? 'None'
    ].join('\t'))].join('\n');
  }

  loadedPois(scope = 'all') {
    const main = this.main(), world = call(main, ['get_World']), cities = call(main, ['get_Cities']);
    const origins = values(call(cities, ['get_AllCities']));
    const allianceId = this.overview().id;
    const found = new Map();
    for (const city of origins) {
      const ox = finite(call(city, ['get_PosX'])), oy = finite(call(city, ['get_PosY']));
      for (let y = oy - 40; y <= oy + 40; y += 1) for (let x = ox - 40; x <= ox + 40; x += 1) {
        const object = world?.GetObjectFromPosition?.(x, y);
        if (!object || !/poi|pointofinterest/i.test(String(object.constructor?.name ?? ''))) continue;
        const ownerAllianceId = call(object, ['get_AllianceId', 'get_OwnerAllianceId']) ?? 0;
        if (scope === 'free' && ownerAllianceId) continue;
        if (scope === 'alliance' && String(ownerAllianceId) !== String(allianceId)) continue;
        found.set(`${x}:${y}`, { type: this.poiName(call(object, ['get_Type', 'get_POIType'])), level: finite(call(object, ['get_Level'])), score: finite(this.root()?.Base?.PointOfInterestTypes?.GetScoreByLevel?.(finite(call(object, ['get_Level'])))), owner: String(call(object, ['get_AllianceName', 'get_OwnerName']) ?? 'Free'), x, y, sector: String(call(object, ['get_SectorName']) ?? '—') });
      }
    }
    return [...found.values()];
  }

  exportPois(scope = 'alliance') {
    const rows = scope === 'alliance' ? this.pois() : this.loadedPois(scope);
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return ['Type,Level,Score,Owner,Coordinates,Sector', ...rows.map((poi) => [poi.type, poi.level, poi.score, poi.owner, `${poi.x}:${poi.y}`, poi.sector].map(quote).join(','))].join('\n');
  }
}

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
const ALLIANCE_MARKER_TYPES = Object.freeze({
  1: 'Watch Closely',
  2: 'Move Here',
  3: 'Conquer Area',
  4: 'Protect Area',
  5: 'Layout Reservation',
  6: 'Base Reservation'
});
const PRIVATE_MARKERS_KEY = 'module:alliance:private-markers:v1';
const SUITE_MARKER_PREFIX = '[CNC-TA-SUITE:v1]';

export function allianceCreateMarkerArguments(method, { x, y, type, description }) {
  const fallback = [x, y, type, description];
  try {
    const source = Function.prototype.toString.call(method);
    const names = source.match(/^[^(]*\(([^)]*)\)/)?.[1]?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
    if (names.length !== 4) return fallback;
    const values = new Array(4);
    const parameters = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const fields = { x, y, t: type, d: description };
    for (const [field, value] of Object.entries(fields)) {
      const match = source.match(new RegExp(`[,{]\\s*["']?${field}["']?\\s*:\\s*(${parameters})(?=\\s*[,}])`));
      if (!match) return fallback;
      values[names.indexOf(match[1])] = value;
    }
    return values.every((value) => value !== undefined) ? values : fallback;
  } catch { return fallback; }
}

const POI_NAMES = Object.freeze({
  2: 'Tiberium Control Network Hub',
  3: 'Crystal Control Network Hub',
  4: 'Reactor',
  5: 'Tungsten Compound',
  6: 'Uranium Compound',
  7: 'Aircraft Guidance Network',
  8: 'Resonator Network Tower'
});
const RANKED_POI_NAMES = Object.freeze({
  4: 'Tiberium Control Network Hub', 5: 'Crystal Control Network Hub', 6: 'Reactor',
  7: 'Tungsten Compound', 8: 'Uranium Compound', 9: 'Aircraft Guidance Network',
  10: 'Resonator Network Tower'
});
const POI_BONUS_META = Object.freeze({
  4: Object.freeze({ label: 'Tiberium Bonus', benefit: 'Tiberium/h', getter: 'get_POITiberiumBonus' }),
  5: Object.freeze({ label: 'Crystals Bonus', benefit: 'Crystals/h', getter: 'get_POICrystalBonus' }),
  6: Object.freeze({ label: 'Power Bonus', benefit: 'Power/h', getter: 'get_POIPowerBonus' }),
  7: Object.freeze({ label: 'Infantry Bonus', benefit: 'firepower', getter: 'get_POIInfantryBonus', percent: true }),
  8: Object.freeze({ label: 'Vehicles Bonus', benefit: 'firepower', getter: 'get_POIVehicleBonus', percent: true }),
  9: Object.freeze({ label: 'Aircraft Bonus', benefit: 'firepower', getter: 'get_POIAirBonus', percent: true }),
  10: Object.freeze({ label: 'Defense Bonus', benefit: 'defense durability', getter: 'get_POIDefenseBonus', percent: true })
});
const POI_BONUS_SEQUENCE = Object.freeze([
  Object.freeze({ label: 'Tiberium Bonus', benefit: 'Tiberium/h', getter: 'get_POITiberiumBonus' }),
  Object.freeze({ label: 'Crystals Bonus', benefit: 'Crystals/h', getter: 'get_POICrystalBonus' }),
  Object.freeze({ label: 'Power Bonus', benefit: 'Power/h', getter: 'get_POIPowerBonus' }),
  Object.freeze({ label: 'Infantry Bonus', benefit: 'firepower', getter: 'get_POIInfantryBonus', percent: true }),
  Object.freeze({ label: 'Vehicles Bonus', benefit: 'firepower', getter: 'get_POIVehicleBonus', percent: true }),
  Object.freeze({ label: 'Aircraft Bonus', benefit: 'firepower', getter: 'get_POIAirBonus', percent: true }),
  Object.freeze({ label: 'Defense Bonus', benefit: 'defense durability', getter: 'get_POIDefenseBonus', percent: true })
]);

export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export class AllianceHub {
  constructor(context) {
    this.context = context;
    this.memberDetails = new Map();
    this.memberDetailPending = new Map();
    this.privateMarkerRows = [];
    this.privateMarkersReady = this.loadPrivateMarkers();
  }

  client() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.client()?.root ?? globalThis.ClientLib ?? null; }
  main() { return this.client()?.getMainData?.() ?? this.root()?.Data?.MainData?.GetInstance?.(); }
  alliance() { return call(this.main(), ['get_Alliance']); }

  worldKey() {
    const server = call(this.main(), ['get_Server']);
    return String(call(server, ['get_WorldId', 'get_Id', 'get_Name']) ?? globalThis.location?.host ?? 'world');
  }

  async loadPrivateMarkers() {
    const rows = await this.context.storage?.get?.(PRIVATE_MARKERS_KEY, []) ?? [];
    this.privateMarkerRows = Array.isArray(rows) ? rows.filter((item) => item && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) : [];
    this.context.eventBus?.emit?.('alliance:private-markers-changed', this.privateMarkers());
    return this.privateMarkers();
  }

  privateMarkers() {
    const world = this.worldKey();
    return this.privateMarkerRows.filter((marker) => String(marker.world) === world);
  }

  sharedSuiteMarkers() {
    return this.markers().flatMap((marker) => {
      if (!marker.description.startsWith(SUITE_MARKER_PREFIX)) return [];
      try {
        const data = JSON.parse(marker.description.slice(SUITE_MARKER_PREFIX.length));
        return [{
          id: `shared:${marker.id}`, nativeId: marker.id, scope: 'Alliance Suite',
          world: this.worldKey(), x: marker.x, y: marker.y,
          label: String(data.label || 'Alliance marker').slice(0, 80),
          color: String(data.color || '#45d7ff'), createdAt: Number(data.createdAt || 0),
          createdBy: marker.createdBy
        }];
      } catch { return []; }
    });
  }

  displaySuiteMarkers() {
    return [
      ...this.privateMarkers().map((marker) => ({ ...marker, scope: 'Private' })),
      ...this.sharedSuiteMarkers()
    ];
  }

  async savePrivateMarkers() {
    await this.context.storage?.set?.(PRIVATE_MARKERS_KEY, this.privateMarkerRows);
    this.context.eventBus?.emit?.('alliance:private-markers-changed', this.privateMarkers());
  }

  async addPrivateMarker({ x, y, label, color = '#ffcc33' }) {
    const marker = Object.freeze({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      world: this.worldKey(), x: Number(x), y: Number(y),
      label: String(label || 'Private marker').trim().slice(0, 80), color: String(color), createdAt: Date.now()
    });
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) throw new Error('Valid marker coordinates are required.');
    this.privateMarkerRows.push(marker);
    await this.savePrivateMarkers();
    return marker;
  }

  async addSharedSuiteMarker({ x, y, label, color = '#45d7ff' }) {
    const alliance = this.alliance();
    if (typeof alliance?.CreateMarker !== 'function') {
      throw new Error('Alliance marker creation is unavailable or your alliance role cannot create markers.');
    }
    const markerX = Number(x), markerY = Number(y);
    if (!Number.isFinite(markerX) || !Number.isFinite(markerY)) throw new Error('Valid marker coordinates are required.');
    const description = SUITE_MARKER_PREFIX + JSON.stringify({
      label: String(label || 'Alliance Suite marker').trim().slice(0, 80),
      color: String(color), createdAt: Date.now()
    });
    const before = new Set(this.sharedSuiteMarkers().map((marker) => marker.nativeId));
    const args = allianceCreateMarkerArguments(alliance.CreateMarker, {
      x: markerX, y: markerY, type: 1, description
    });
    alliance.CreateMarker(...args);
    let created = false;
    for (let attempt = 0; attempt < 15 && !created; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      created = this.sharedSuiteMarkers().some((marker) =>
        !before.has(marker.nativeId) && marker.x === markerX && marker.y === markerY);
    }
    if (!created) {
      throw new Error('The game did not create the alliance marker. Check your alliance-marker permission and try again.');
    }
    this.context.eventBus?.emit?.('alliance:private-markers-changed', this.displaySuiteMarkers());
    return true;
  }

  async deletePrivateMarker(id) {
    this.privateMarkerRows = this.privateMarkerRows.filter((marker) => marker.id !== id);
    await this.savePrivateMarkers();
  }

  async deleteSuiteMarker(marker) {
    if (marker?.scope === 'Alliance Suite') {
      return this.deleteMarker({ id: marker.nativeId });
    }
    return this.deletePrivateMarker(marker?.id);
  }

  currentSelectionCoordinates() {
    const vis = this.root()?.Vis?.VisMain?.GetInstance?.();
    const selected = call(vis, ['get_SelectedObject']);
    return {
      x: Number(call(selected, ['get_RawX', 'get_X', 'get_PosX']) ?? NaN),
      y: Number(call(selected, ['get_RawY', 'get_Y', 'get_PosY']) ?? NaN)
    };
  }

  focusPrivateMarker(marker) {
    if (!marker) throw new Error('Select a private marker first.');
    const vis = this.root()?.Vis?.VisMain?.GetInstance?.();
    if (typeof vis?.CenterGridPosition !== 'function') throw new Error('World-map focus is unavailable.');
    vis.CenterGridPosition(marker.x, marker.y); vis.Update?.(); vis.ViewUpdate?.();
  }

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
      description: String(call(alliance, ['get_Description', 'get_DescriptionText']) ?? ''),
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
    call(alliance, ['RefreshMemberData']);
    const members = values(call(alliance, ['get_MemberDataAsArray']))
      .concat(values(call(alliance, ['get_MemberData'])));
    const unique = new Map();
    for (const member of members) {
      const name = String(member.Name ?? member.n ?? call(member, ['get_Name']) ?? 'Unknown');
      const id = String(member.Id ?? member.i ?? member.PlayerId ?? name);
      const onlineState = finite(member.OnlineState ?? member.o ?? call(member, ['get_OnlineState']));
      const detail = this.memberDetails.get(name.toLowerCase()) ?? {};
      unique.set(id, {
        id, name,
        role: String(member.RoleName ?? member.rn ?? member.Role ?? 'Member'),
        onlineState,
        online: ONLINE[onlineState]?.label ?? 'Unknown',
        onlineOrder: ONLINE[onlineState]?.order ?? 4,
        score: finite(member.Score ?? member.s ?? call(member, ['get_Score', 'get_TotalScore', 'get_PlayerScore']) ?? detail.score),
        rank: finite(member.Rank ?? member.r),
        bases: finite(member.Bases ?? member.BaseCount ?? member.bc ?? call(member, ['get_NumBases', 'get_BaseCount', 'get_CitiesCount']) ?? detail.bases),
        pvp: finite(member.PvPScore ?? member.PVPScore ?? member.pvp ?? call(member, ['get_PvPScore', 'get_PVPScore', 'get_CombatScore']) ?? detail.pvp),
        pve: finite(member.PvEScore ?? member.PVEScore ?? member.pve ?? call(member, ['get_PvEScore', 'get_PVEScore', 'get_NpcScore']) ?? detail.pve),
        pvpKills: finite(member.PvPKills ?? member.PVPKills ?? member.pvpk ?? member.PlayerKills
          ?? call(member, ['get_PvPKills', 'get_PVPKills', 'get_PlayerKills']) ?? detail.pvpKills),
        pveKills: finite(member.PvEKills ?? member.PVEKills ?? member.pvek ?? member.NpcKills
          ?? call(member, ['get_PvEKills', 'get_PVEKills', 'get_NpcKills']) ?? detail.pveKills),
        veteranPoints: finite(member.VeteranPoints ?? member.vp ?? call(member, ['get_VeteranPoints', 'get_VeteranScore']) ?? detail.veteranPoints),
        eventPoints: finite(member.EventPoints ?? member.ep ?? call(member, ['get_EventPoints', 'get_EventScore']) ?? detail.eventPoints),
        baseLevels: values(member.BaseLevels ?? member.Cities ?? member.bl).map((base) =>
          finite(base.Level ?? base.l ?? base)
        ).filter(Boolean)
      });
    }
    return [...unique.values()].sort((a, b) =>
      a.onlineOrder - b.onlineOrder || a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
    );
  }

  async enrichMembers(members = this.members()) {
    const requests = members.map((member) => {
      const key = member.name.toLowerCase();
      if (this.memberDetails.has(key)) return null;
      if (this.memberDetailPending.has(key)) return this.memberDetailPending.get(key);
      const request = this.command('GetPublicPlayerInfoByName', { name: member.name }).then((data) => {
        const bases = values(data.c ?? data.cities);
        const totalBattleScore = finite(data.bd ?? data.battleScore ?? data.d);
        const pve = finite(data.bde ?? data.pveScore ?? data.pve);
        this.memberDetails.set(key, {
          score: finite(data.s ?? data.score ?? data.ps) || bases.reduce((sum, base) => sum + finite(base.p ?? base.points), 0), bases: bases.length || finite(data.bc ?? data.baseCount),
          pvp: finite(data.d ?? data.pvpScore ?? data.pvp) || Math.max(0, totalBattleScore - pve), pve,
          pvpKills: finite(data.pvpKills ?? data.pk ?? data.bdk), pveKills: finite(data.pveKills ?? data.nk ?? data.bdek),
          veteranPoints: finite(data.vp ?? data.veteranPoints), eventPoints: finite(data.ep ?? data.eventPoints ?? data.es)
        });
      }).catch(() => {}).finally(() => this.memberDetailPending.delete(key));
      this.memberDetailPending.set(key, request); return request;
    }).filter(Boolean);
    await Promise.all(requests);
    return this.members();
  }

  openPlayerProfile(name) {
    const playerName = String(name ?? '').trim();
    if (!playerName) throw new Error('Select a valid alliance member.');
    const opener = globalThis.webfrontend?.gui?.util?.BBCode?.openPlayerProfile;
    if (typeof opener !== 'function') throw new Error('The game player-profile window is unavailable.');
    opener(playerName);
  }

  diplomacy() {
    const alliance = this.alliance();
    const page = globalThis.webfrontend?.gui?.alliance?.DiplomacyPage ?? {};
    const types = [
      { label: 'Allies', value: page.ERelationTypeAlly ?? 1 },
      { label: 'Non-aggression pacts', value: page.ERelationTypeNAP ?? 2 },
      { label: 'Enemies', value: page.ERelationTypeEnemy ?? 3 }
    ];
    return types.flatMap((type) => values(alliance?.GetAllianceRelationshipsByType?.(type.value, true))
      .map((relation) => ({
        type: type.label,
        alliance: String(relation.OtherAllianceName ?? relation.Name ?? relation.n ?? relation.AllianceName ?? relation.an
          ?? call(relation, ['get_OtherAllianceName', 'get_AllianceName', 'get_Name']) ?? 'Unknown'),
        abbreviation: String(relation.OtherAllianceAbbreviation ?? relation.Abbreviation ?? relation.ab
          ?? call(relation, ['get_OtherAllianceAbbreviation', 'get_AllianceAbbreviation', 'get_Abbreviation']) ?? ''),
        id: String(relation.OtherAllianceId ?? relation.Id ?? relation.i ?? relation.AllianceId ?? relation.aid
          ?? call(relation, ['get_OtherAllianceId', 'get_AllianceId', 'get_Id']) ?? '')
      })));
  }

  async setDiplomacy(allianceId, relationType) {
    const id = finite(allianceId);
    const relation = finite(relationType);
    if (!id) throw new Error('Select a valid alliance.');
    const alliance = this.alliance();
    for (const name of ['SetAllianceRelationship', 'SetRelationship', 'ChangeRelationship']) {
      if (typeof alliance?.[name] !== 'function') continue;
      const result = alliance[name](id, relation);
      if (result?.then) await result;
      return true;
    }
    throw new Error('The native diplomacy setter is unavailable or your alliance role cannot change diplomacy.');
  }

  markers() {
    const alliance = this.alliance();
    const collections = values(call(alliance, ['get_Markers']));
    const unique = new Map();
    for (const marker of collections) {
      const x = finite(call(marker, ['get_CoordX']) ?? marker.CoordX ?? marker.x ?? marker.X);
      const y = finite(call(marker, ['get_CoordY']) ?? marker.CoordY ?? marker.y ?? marker.Y);
      if (x <= 0 || y <= 0) continue;
      const id = String(call(marker, ['get_Id']) ?? marker.Id ?? marker.i ?? marker.id ?? `${x}:${y}`);
      const typeId = finite(call(marker, ['get_Type']) ?? marker.Type ?? marker.t);
      const createdBy = String(call(marker, ['get_NamePlayerCreated']) ?? marker.NamePlayerCreated ?? '');
      const nativeDescription = String(call(marker, ['get_Description']) ?? marker.Description ?? marker.d ?? marker.Text ?? '').trim();
      const description = nativeDescription || ([5, 6].includes(typeId)
        ? `${ALLIANCE_MARKER_TYPES[typeId]}${createdBy ? ` for ${createdBy}` : ''}` : 'No description');
      unique.set(id, {
        id, x, y, typeId,
        type: ALLIANCE_MARKER_TYPES[typeId] ?? `Marker Type ${typeId}`,
        name: String(marker.Name ?? marker.n ?? marker.Title ?? call(marker, ['get_Name', 'get_Title'])
          ?? (description.split(/\r?\n|<br\s*\/?\s*>/i)[0] || '') ?? 'Alliance marker'),
        description,
        createdBy,
        editedBy: String(call(marker, ['get_NamePlayerEdited']) ?? marker.NamePlayerEdited ?? '')
      });
    }
    return [...unique.values()];
  }

  deleteMarker(marker) {
    if (!marker?.id) throw new Error('Select a valid marker.');
    const alliance = this.alliance();
    if (typeof alliance?.DeleteMarker !== 'function') throw new Error('Marker deletion is unavailable or your alliance role cannot delete markers.');
    alliance.DeleteMarker(Number(marker.id), null);
    return true;
  }

  poiName(type) {
    const id = finite(type);
    if (POI_NAMES[id]) return POI_NAMES[id];
    try {
      const info = globalThis.webfrontend?.phe?.cnc?.gui?.util?.Text?.getPoiInfosByType?.(type);
      return String(info?.name ?? info?.type ?? `Unknown POI (${id})`);
    } catch { return `Unknown POI (${id})`; }
  }
  rankedPoiName(type) { return RANKED_POI_NAMES[finite(type)] ?? this.poiName(type); }

  poiTypeId(poi) {
    const stored = [poi?.t, poi?.POIType, poi?.poiType, poi?.Type]
      .map(finite).find((type) => POI_NAMES[type]);
    if (stored) return stored;
    const worldSubtype = finite(call(poi, ['get_POIType', 'get_SubType', 'get_Type']));
    if (worldSubtype >= 1 && worldSubtype <= 7) return worldSubtype + 1;
    return 0;
  }

  isWorldPoi(object) {
    if (!object) return false;
    const PoiClass = this.root()?.Data?.WorldSector?.WorldObjectPointOfInterest;
    try { if (PoiClass && object instanceof PoiClass) return true; } catch { /* Cross-frame constructors can reject instanceof. */ }
    return /(?:WorldObject)?PointOfInterest/i.test(String(object.constructor?.name ?? object.classname ?? ''));
  }

  pois() {
    const score = this.root()?.Base?.PointOfInterestTypes?.GetScoreByLevel;
    return values(call(this.alliance(), ['get_OwnedPOIs'])).map((poi) => {
      const typeId = this.poiTypeId(poi);
      return {
        typeId, type: this.poiName(typeId), level: finite(poi.l ?? poi.Level),
        score: typeof score === 'function' ? finite(score(poi.l ?? poi.Level)) : 0,
        x: finite(poi.x ?? poi.X), y: finite(poi.y ?? poi.Y),
        owner: String(poi.OwnerName ?? poi.on ?? this.overview().name),
        player: String(poi.PlayerName ?? poi.pn ?? ''), base: String(poi.BaseName ?? poi.bn ?? ''),
        sector: String(poi.SectorName ?? poi.sector ?? poi.s ?? '—')
      };
    }).filter((poi) => poi.typeId).sort((a, b) => a.type.localeCompare(b.type) || b.level - a.level);
  }

  poiAnalysis() {
    const rankCollection = call(this.alliance(), ['get_POIRankScore']);
    const ranks = rankCollection?.d ?? rankCollection?.l ?? rankCollection ?? [];
    const util = this.root()?.Base?.PointOfInterestTypes;
    const poiEnums = this.root()?.Base?.EPOIType ?? {};
    const start = finite(poiEnums.RankedTypeBegin) || 4;
    const rankedTypes = [
      poiEnums.TiberiumBonus, poiEnums.CrystalBonus, poiEnums.PowerBonus,
      poiEnums.InfanteryBonus ?? poiEnums.InfantryBonus, poiEnums.VehicleBonus,
      poiEnums.AirBonus ?? poiEnums.AircraftBonus, poiEnums.DefenseBonus
    ];
    const server = call(this.main(), ['get_Server']);
    const globalFactor = finite(call(server, ['get_POIGlobalBonusFactor'])) || 1;
    const alliance = this.alliance();
    return Array.from({ length: 7 }, (_, index) => {
      // POI rank-score entries are already ordered from RankedTypeBegin.
      // GetPOITypeFromPOIRanking expects a ranking enum, not this zero-based
      // array index; passing the index can resolve an unrelated resource curve.
      const type = Number.isFinite(Number(rankedTypes[index])) ? Number(rankedTypes[index]) : start + index;
      const rank = ranks[index] ?? ranks[String(index)] ?? {};
      const score = finite(rank.s ?? rank.Score);
      const previous = finite(rank.ps ?? rank.PreviousScore);
      const next = finite(rank.ns ?? rank.NextScore);
      const nextTier = finite(util?.GetNextScore?.(score));
      const previousTier = finite(util?.GetPreviousScore?.(score));
      const multiplier = finite(util?.GetBoostModifierByRank?.(finite(rank.r ?? rank.Rank)));
      const rawBaseBonus = finite(util?.GetBonusByType?.(type, score, globalFactor));
      const rawNextBaseBonus = finite(util?.GetBonusByType?.(type, nextTier, globalFactor));
      const meta = POI_BONUS_SEQUENCE[index] ?? POI_BONUS_META[type] ?? {};
      const nativeTotal = finite(call(alliance, [meta.getter]));
      // Alliance getters are display-rounded (for example 52 instead of
      // 52.095). Keep them only as a fallback; the native calculation API
      // retains the precision used by the game's POI details panel.
      const calculatedTotal = finite(util?.GetTotalBonusByType?.(type, finite(rank.r ?? rank.Rank), score, globalFactor));
      const totalBonus = calculatedTotal || nativeTotal;
      const nextTotalBonus = finite(util?.GetTotalBonusByType?.(
        type, finite(rank.r ?? rank.Rank), nextTier, globalFactor
      ));
      const affectedPercentageType = index >= 4;
      const rankFactor = 1 + multiplier / 100;
      // Vehicle, aircraft, and defense GetBonusByType values are exposed in
      // an internal scaled unit in current clients. The precise total API is
      // correct, so reverse the rank multiplier exactly as the native panel
      // does: 52.095 / 1.51 = 34.5.
      const baseBonus = affectedPercentageType && rankFactor > 0
        ? totalBonus / rankFactor
        : rawBaseBonus;
      const nextBaseBonus = affectedPercentageType && rankFactor > 0 && nextTotalBonus
        ? nextTotalBonus / rankFactor
        : rawNextBaseBonus;
      return {
        typeId: type,
        type: POI_NAMES[index + 2] ?? this.rankedPoiName(type),
        label: meta.label ?? this.rankedPoiName(type), benefit: meta.benefit ?? '', percent: Boolean(meta.percent),
        rank: finite(rank.r ?? rank.Rank),
        score, previous, next,
        below: Math.max(0, score - previous),
        above: Math.max(0, next - score),
        previousTier,
        previousTierMargin: Math.max(0, score - previousTier),
        nextTier,
        tierShortfall: Math.max(0, nextTier - score), multiplier, baseBonus, nextBaseBonus, totalBonus
      };
    });
  }

  simulatePoiChanges(changes = []) {
    const start = finite(this.root()?.Base?.EPOIType?.RankedTypeBegin) || 4;
    return this.poiAnalysis().map((current, index) => {
      const type = start + index;
      const delta = changes.filter((item) => Number(item.typeId) === Number(type))
        .reduce((sum, item) => sum + finite(item.score) * (item.action === 'remove' ? -1 : 1), 0);
      const projectedScore = Math.max(0, current.score + delta);
      const projectedTotalBonus = this.previewPoiBenefit(type, projectedScore, current.rank).totalBonus;
      return { ...current, typeId: type, projectedScore, projectedTotalBonus,
        bonusChange: projectedTotalBonus - current.totalBonus };
    });
  }

  previewPoiBenefit(typeId, score, rank) {
    const util = this.root()?.Base?.PointOfInterestTypes;
    const server = call(this.main(), ['get_Server']);
    const factor = finite(call(server, ['get_POIGlobalBonusFactor'])) || 1;
    const projectedScore = Math.max(0, finite(score));
    const baseBonus = finite(util?.GetBonusByType?.(typeId, projectedScore, factor));
    const totalBonus = finite(util?.GetTotalBonusByType?.(typeId, finite(rank), projectedScore, factor))
      || baseBonus * (1 + finite(util?.GetBoostModifierByRank?.(finite(rank))) / 100);
    const nextTier = finite(util?.GetNextScore?.(projectedScore));
    const multiplier = finite(util?.GetBoostModifierByRank?.(finite(rank)));
    const rankFactor = 1 + multiplier / 100;
    const start = finite(this.root()?.Base?.EPOIType?.RankedTypeBegin) || 4;
    const affectedPercentageType = Number(typeId) >= start + 4 && Number(typeId) <= start + 6;
    const nextTotalBonus = finite(util?.GetTotalBonusByType?.(typeId, finite(rank), nextTier, factor));
    return {
      score: projectedScore,
      baseBonus: affectedPercentageType && rankFactor > 0 ? totalBonus / rankFactor : baseBonus,
      totalBonus,
      nextTier,
      nextBaseBonus: affectedPercentageType && rankFactor > 0 && nextTotalBonus
        ? nextTotalBonus / rankFactor
        : finite(util?.GetBonusByType?.(typeId, nextTier, factor))
    };
  }

  poiGainLoss(typeId, currentScore, scoreDelta, rank) {
    const current = this.previewPoiBenefit(typeId, currentScore, rank);
    const projected = this.previewPoiBenefit(typeId, Number(currentScore) + Number(scoreDelta), rank);
    return Number(scoreDelta) < 0
      ? current.totalBonus - projected.totalBonus
      : projected.totalBonus - current.totalBonus;
  }

  poiRealLoss(analysis, currentScore, removedScore) {
    const projected = this.previewPoiChange(analysis, Number(currentScore) - Number(removedScore));
    return Math.max(0, finite(analysis?.totalBonus) - finite(projected?.totalBonus));
  }

  previewPoiChange(analysis, projectedScore) {
    const score = Math.max(0, finite(projectedScore));
    let rank = Math.max(1, finite(analysis?.rank));
    if (finite(analysis?.next) > 0 && score >= finite(analysis.next)) rank = Math.max(1, rank - 1);
    if (finite(analysis?.previous) > 0 && score < finite(analysis.previous)) rank += 1;
    const preview = this.previewPoiBenefit(analysis?.typeId, score, rank);
    const multiplier = finite(this.root()?.Base?.PointOfInterestTypes?.GetBoostModifierByRank?.(rank));
    return { ...preview, rank, multiplier };
  }

  focusPoi(poi) {
    if (!poi) throw new Error('Select a POI first.');
    const vis = this.root()?.Vis?.VisMain?.GetInstance?.();
    if (typeof vis?.CenterGridPosition !== 'function') throw new Error('World-map focus is unavailable.');
    vis.CenterGridPosition(poi.x, poi.y);
    vis.Update?.();
    vis.ViewUpdate?.();
  }

  focusOwnedPoiType(typeId) {
    const selected = this.pois().filter((poi) => Number(poi.typeId) === Number(typeId));
    if (!selected.length) throw new Error('Your alliance does not currently own a POI of this type.');
    const cities = call(this.main(), ['get_Cities']);
    const city = call(cities, ['get_CurrentOwnCity']) ?? call(cities, ['get_CurrentCity']);
    const x = finite(call(city, ['get_PosX'])), y = finite(call(city, ['get_PosY']));
    selected.sort((left, right) => Math.hypot(left.x - x, left.y - y) - Math.hypot(right.x - x, right.y - y));
    this.focusPoi(selected[0]);
    return selected[0];
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
        const typeId = this.poiTypeId(object);
        if (!typeId) continue;
        found.set(`${x}:${y}`, { typeId, type: this.poiName(typeId), level: finite(call(object, ['get_Level'])), score: finite(this.root()?.Base?.PointOfInterestTypes?.GetScoreByLevel?.(finite(call(object, ['get_Level'])))), owner: String(call(object, ['get_AllianceName', 'get_OwnerName']) ?? 'Free'), x, y, sector: String(call(object, ['get_SectorName']) ?? '—') });
      }
    }
    return [...found.values()];
  }

  exportPois(scope = 'alliance') {
    const rows = scope === 'alliance' ? this.pois() : this.loadedPois(scope);
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return ['Type,Level,Score,Owner,Coordinates,Sector', ...rows.map((poi) => [poi.type, poi.level, poi.score, poi.owner, `${poi.x}:${poi.y}`, poi.sector].map(quote).join(','))].join('\n');
  }

  exportOwnedPoiAnalysis(rows = []) {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return ['DROP CANDIDATE,Real Gain/Loss,POI Type,Level,Score,Coordinates,Rank,Multiplier,Current Bonus,Below Alliance,Above Alliance,Previous Tier,Next Tier,Tier Shortfall',
      ...rows.map((poi) => {
        const item = poi.analysis ?? {};
        return [poi.dropCandidate ? '*** DROP — ZERO REAL LOSS ***' : '', poi.realGainLoss ?? '',
          poi.type, poi.level, poi.score, `${poi.x}:${poi.y}`, item.rank ?? 0,
          `${item.multiplier ?? 0}%`, item.totalBonus ?? 0, item.below ?? 0, item.above ?? 0,
          item.previousTier ?? 0, item.nextTier ?? 0, item.tierShortfall ?? 0].map(quote).join(',');
      })].join('\n');
  }

  poiTypes() { return Object.entries(POI_NAMES).map(([id, name]) => ({ id: Number(id), name })); }

  worldPoiRecords() {
    const world = call(this.main(), ['get_World']);
    const records = values(call(world, ['GetPOIs', 'get_POIs']));
    const ctor = this.root()?.Data?.WorldSector?.WorldObjectPointOfInterest?.prototype?.$ctor;
    const match = String(ctor ?? '').match(/this\.([A-Z]{6})=-1[\s\S]+?this\.([A-Z]{6})=e&255,this\.([A-Z]{6})=e>>[\s\S]+?,this\.([A-Z]{6})=e>>11[\s\S]+?=4,this\.([A-Z]{6})[\s\S]+?,this\.([A-Z]{6})=o\.[A-Z]{6}/m);
    if (!match) return [];
    const keys = { allianceId: match[1], level: match[2], subtype: match[3], allianceName: match[6] };
    const decode = this.root()?.Base?.MathUtil?.DecodeCoordId;
    if (typeof decode !== 'function') return [];
    return records.map((poi) => {
      const position = {}; decode(poi.worldId, position);
      const subtype = finite(poi[keys.subtype]);
      const liveObject = world?.GetObjectFromPosition?.(finite(position.b), finite(position.c));
      // A loaded coordinate is authoritative. Reject stale/misclassified
      // registry rows when the live sector says this is a base, camp, or city.
      if (liveObject && !this.isWorldPoi(liveObject)) return null;
      return {
        typeId: subtype >= 1 && subtype <= 7 ? subtype + 1 : 0,
        level: finite(poi[keys.level]), score: finite(this.root()?.Base?.PointOfInterestTypes?.GetScoreByLevel?.(finite(poi[keys.level]))), x: finite(position.b), y: finite(position.c),
        owner: finite(poi[keys.allianceId]) < 0 ? 'Free' : String(poi[keys.allianceName] ?? 'Occupied')
      };
    }).filter((poi) => poi?.typeId);
  }

  searchPoiCorridor(width = 50) {
    const main = this.main(), world = call(main, ['get_World']), server = call(main, ['get_Server']);
    const cities = call(main, ['get_Cities']);
    const city = call(cities, ['get_CurrentOwnCity']) ?? call(cities, ['get_CurrentCity']);
    if (!city) throw new Error('Select one of your bases before searching.');
    const start = { x: finite(call(city, ['get_PosX'])), y: finite(call(city, ['get_PosY'])) };
    const worldWidth = finite(call(server, ['get_WorldWidth']) ?? call(world, ['get_WorldWidth']));
    const worldHeight = finite(call(server, ['get_WorldHeight']) ?? call(world, ['get_WorldHeight']));
    if (!worldWidth || !worldHeight) throw new Error('World dimensions are unavailable.');
    const end = { x: Math.floor(worldWidth / 2), y: Math.floor(worldHeight / 2) };
    const halfWidth = Math.max(0.5, finite(width) / 2);
    const minX = Math.max(0, Math.floor(Math.min(start.x, end.x) - halfWidth));
    const maxX = Math.min(worldWidth - 1, Math.ceil(Math.max(start.x, end.x) + halfWidth));
    const minY = Math.max(0, Math.floor(Math.min(start.y, end.y) - halfWidth));
    const maxY = Math.min(worldHeight - 1, Math.ceil(Math.max(start.y, end.y) + halfWidth));
    const found = new Map();
    const registry = this.worldPoiRecords();
    for (const poi of registry) {
      const distance = Math.hypot(poi.x - start.x, poi.y - start.y);
      if (poi.x < minX || poi.x > maxX || poi.y < minY || poi.y > maxY
        || distanceToSegment(poi, start, end) > halfWidth) continue;
      found.set(`${poi.x}:${poi.y}`, { ...poi, type: this.poiName(poi.typeId), distance, sector: '—' });
    }
    return [...found.values()].sort((left, right) => left.distance - right.distance);
  }

  exportPoiSearch(rows) {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return ['POI Type,Level,Distance,Coordinates,Owner,Sector', ...(rows ?? []).map((poi) => [
      poi.type, poi.level, poi.distance.toFixed(2), `${poi.x}:${poi.y}`, poi.owner, poi.sector
    ].map(quote).join(','))].join('\n');
  }
}

function source(fn) {
  const candidate = fn?.$$original ?? fn;
  try {
    const exposed = candidate?.toString?.();
    if (typeof exposed === 'string' && exposed.length > 20 && !exposed.includes('[native code]')) return exposed;
  } catch { /* Fall through to the native renderer. */ }
  try { return Function.prototype.toString.call(candidate); } catch { return ''; }
}

function match(sourceText, expression, description) {
  const result = sourceText.match(expression);
  if (!result) throw new Error(`This game build does not expose ${description}.`);
  return result;
}

function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') return target[name](...args);
    } catch { /* Runtime game objects can be replaced between ticks. */ }
  }
  return null;
}

export function findShiftedMember(functionSource, shifts) {
  const expected = new Set(shifts.flatMap((shift) => [String(shift), `0x${Number(shift).toString(16)}`]));
  for (const assignment of String(functionSource ?? '').matchAll(/this\.([\w$]+)\s*=\s*([^,;}]*)/g)) {
    const expression = assignment[2].replaceAll(/\s+/g, '').toLowerCase();
    const shifted = [...expected].some((shift) => expression.includes(`>>${shift}`) || expression.includes(`>>>${shift}`));
    const masked = expression.includes('&15') || expression.includes('&0xf');
    if (shifted && masked) return assignment[1];
  }
  return null;
}

/**
 * Preview-only strategic world editor. It deliberately works on ClientLib's
 * local world cache and never invokes a server command.
 */
export class StrategicMapPlanner {
  constructor(context) {
    this.context = context;
    this.history = [];
    this.dirtySectors = new Map();
    this.discovery = null;
    this.activeMove = null;
    this.refreshTimer = null;
  }

  root() {
    return this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib;
  }

  mainData() { return this.root()?.Data?.MainData?.GetInstance?.(); }
  world() { return this.mainData()?.get_World?.(); }
  region() { return this.root()?.Vis?.VisMain?.GetInstance?.()?.get_Region?.(); }

  discover() {
    if (this.discovery) return this.discovery;
    const root = this.root();
    if (!root?.Data?.WorldSector || !root?.Vis?.Region) throw new Error('The region world model is unavailable.');
    const setDetails = source(root.Data.WorldSector.prototype.SetDetails);
    const objectMap = match(setDetails, /case \$I\.[A-Z]{6}\.City:.+?this\.([A-Z]{6})\.[A-Z]{6}\(/, 'the sector object map')[1];
    const version = match(source(root.Data.WorldSector.prototype.get_Version), /return this\.([A-Z]{6})/, 'sector refresh versions')[1];
    const cityLevel = match(source(root.Vis.Region.RegionCity.prototype.get_BaseLevel), /return this\.[A-Z]{6}\.([A-Z]{6})/, 'city levels')[1];
    const npcLevel = match(source(root.Vis.Region.RegionNPCBase.prototype.get_BaseLevel), /return this\.[A-Z]{6}\.([A-Z]{6})/, 'Forgotten base levels')[1];
    const ruinLevel = root.Vis.Region.RegionRuin
      ? match(source(root.Vis.Region.RegionRuin.prototype.get_BaseLevel), /return this\.[A-Z]{6}\.([A-Z]{6})/, 'ruin levels')[1]
      : null;
    const territoryMethod = match(
      source(root.Data.EndGame?.HubCenter?.prototype?.$ctor),
      /[a-z]\.([A-Z]{6})\([a-z],[a-z],\$I\.[A-Z]{6}\.NPC,0,0,100,(?:true|!0)\)/,
      'territory projection'
    )[1];
    const regionRefresh = match(source(root.Vis.Region.Region.prototype.SetPosition), /this\.([A-Z]{6})\(\)/, 'region refresh')[1];
    this.discovery = { objectMap, version, territoryMethod, regionRefresh, levelByType: new Map([
      [root.Data.WorldSector.ObjectType.City, cityLevel],
      [root.Data.WorldSector.ObjectType.NPCBase, npcLevel],
      [root.Data.WorldSector.ObjectType.Ruin, ruinLevel]
    ]) };
    return this.discovery;
  }

  coordinates(selection) {
    const x = Number(call(selection?.raw, ['get_RawX', 'get_X']) ?? selection?.x);
    const y = Number(call(selection?.raw, ['get_RawY', 'get_Y']) ?? selection?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('The selected object has no world coordinates.');
    return { x, y };
  }

  sectorAt(x, y) {
    const sector = this.world()?.GetWorldSectorByCoords?.(x, y);
    if (!sector) throw new Error(`World sector ${x}:${y} is not loaded.`);
    return sector;
  }

  key(x, y) { return ((y % 32) << 16) | (x % 32); }

  markDirty(sector) {
    if (!this.dirtySectors.has(sector.get_Id())) this.dirtySectors.set(sector.get_Id(), sector);
  }

  objectAt(x, y) {
    return this.world()?.GetObjectFromPosition?.(x, y) ?? null;
  }

  selectedWorldObject(selection) {
    const raw = selection?.raw;
    for (const getterName of ['get_BaseLevel', 'get_ConditionDefense']) {
      const getter = raw?.[getterName];
      if (typeof getter !== 'function') continue;
      const backingMember = source(getter).match(/return\s+this\.([\w$]+)\.[\w$]+/)?.[1]
        ?? source(getter).match(/(?:return\s+|:)this\.([\w$]+)/)?.[1];
      const object = backingMember ? raw?.[backingMember] : null;
      if (object && typeof object === 'object') return object;
    }
    const { x, y } = this.coordinates(selection);
    return this.objectAt(x, y);
  }

  insert(object, x, y) {
    const sector = this.sectorAt(x, y);
    sector[this.discover().objectMap].d[this.key(x, y)] = object;
    this.markDirty(sector);
  }

  remove(x, y) {
    const sector = this.sectorAt(x, y);
    delete sector[this.discover().objectMap].d[this.key(x, y)];
    this.markDirty(sector);
  }

  influence(x, y, ownerType, ownerId, radius, level, blocked = true) {
    return this.world()[this.discover().territoryMethod](x, y, ownerType, ownerId, radius, level, blocked);
  }

  refresh() {
    // Region redraw is expensive and several planning operations update both
    // object and territory caches. Coalesce bursts into one redraw instead of
    // blocking the UI once per low-level mutation.
    if (this.refreshTimer != null) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshNow();
    }, 40);
  }

  refreshNow() {
    if (this.refreshTimer != null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.region()?.[this.discover().regionRefresh]?.();
  }

  levelField(object) {
    const name = this.discover().levelByType.get(object?.Type);
    if (!name) throw new Error('The selected world object does not expose a level.');
    return name;
  }

  radius(object, selection = null) {
    const rawPublicValue = call(selection?.raw, ['get_TerritoryRadius', 'get_InfluenceRadius'])
      ?? call(object, ['get_TerritoryRadius', 'get_InfluenceRadius']);
    const publicValue = Number(rawPublicValue);
    if (rawPublicValue != null && Number.isFinite(publicValue) && publicValue >= 0) return publicValue;
    const root = this.root();
    const objectTypes = root.Data.WorldSector.ObjectType;
    const likelyNpc = object?.Type === objectTypes.NPCBase
      || ['Camp', 'Outpost', 'Forgotten Base'].includes(selection?.type);
    const likelyRuin = object?.Type === objectTypes.Ruin || selection?.type === 'Ruin';
    const shifts = likelyRuin ? [9] : likelyNpc ? [18] : [17];
    const preferredClass = likelyRuin ? root.Data.WorldSector.WorldObjectRuin
      : likelyNpc ? root.Data.WorldSector.WorldObjectNPCBase
        : root.Data.WorldSector.WorldObjectCity;
    const constructors = [
      preferredClass?.prototype?.$ctor,
      object?.constructor?.prototype?.$ctor,
      object?.constructor,
      root.Data.WorldSector.WorldObjectCity?.prototype?.$ctor,
      root.Data.WorldSector.WorldObjectNPCBase?.prototype?.$ctor,
      root.Data.WorldSector.WorldObjectRuin?.prototype?.$ctor
    ].filter(Boolean);
    const shiftCandidates = [...new Set([...shifts, 17, 18, 9])];
    for (const ctor of constructors) {
      for (const shift of shiftCandidates) {
        const field = findShiftedMember(source(ctor), [shift]);
        const value = Number(object?.[field]);
        if (field && Number.isInteger(value) && value >= 0 && value <= 15) return value;
      }
    }
    const described = Number(selection?.territoryRadius);
    if (Number.isFinite(described) && described > 0) return described;
    throw new Error('This game build does not expose territory radius through a public getter or recognizable world-object field.');
  }

  owner(selection) {
    const root = this.root();
    const allianceId = Number(call(selection.raw, ['get_AllianceId']) ?? selection.allianceId ?? 0);
    const playerId = Number(call(selection.raw, ['get_PlayerId']) ?? selection.playerId ?? 0);
    return allianceId
      ? { type: root.Data.EOwnerType.Alliance, id: allianceId }
      : { type: root.Data.EOwnerType.Player, id: playerId };
  }

  activateTerritoryIdentity(selection) {
    const root = this.root();
    const world = this.world();
    const playerId = Number(call(selection.raw, ['get_PlayerId']) ?? selection.playerId ?? 0);
    const allianceId = Number(call(selection.raw, ['get_AllianceId']) ?? selection.allianceId ?? 0);
    const method = match(
      source(root.Data.World.prototype.CheckFoundBase),
      /switch\s?\(this\.([A-Z]{6})\([a-z],[a-z]\)\)/,
      'territory ownership checks'
    )[1];
    const original = world[method];
    world[method] = function projectedTerritory(x, y) {
      const packed = this.GetOwner(x, y);
      const ownerType = packed >> 29;
      const ownerId = packed & 536870911;
      if (ownerType === root.Data.EOwnerType.Player) {
        if (ownerId === playerId) return root.Data.ETerritoryType.Own;
        if (ownerId === 0) return root.Data.ETerritoryType.Neutral;
      } else if (ownerType === root.Data.EOwnerType.Alliance && ownerId === allianceId) {
        return root.Data.ETerritoryType.Alliance;
      } else if (ownerType === root.Data.EOwnerType.StartSlot) {
        return root.Data.ETerritoryType.SpawnZone;
      } else if (ownerType === root.Data.EOwnerType.NPC && ownerId === 1) {
        return root.Data.ETerritoryType.Restricted;
      }
      return root.Data.ETerritoryType.Enemy;
    };
    return () => { world[method] = original; };
  }

  push(label, undo) {
    this.history.push({ label, undo });
    this.context.notifications?.show?.(`${label} preview applied. Use Undo or Reset Plans to restore the live map.`);
  }

  canUndo() { return this.history.length > 0; }
  isDirty() { return this.dirtySectors.size > 0 || this.history.length > 0; }
  undoLabel() { return this.canUndo() ? `Undo ${this.history.at(-1).label.toLowerCase()}` : 'Undo'; }

  undo({ refresh = true } = {}) {
    const entry = this.history.pop();
    if (!entry) return false;
    entry.undo();
    if (refresh) this.refresh();
    return true;
  }

  async reset() {
    this.cancelMove();
    // Restore every operation first, then redraw once. Previously a reset of
    // N plans forced N full region rebuilds on the UI thread.
    while (this.history.length) this.undo({ refresh: false });
    const { version } = this.discover();
    for (const sector of this.dirtySectors.values()) sector[version] = 0;
    this.dirtySectors.clear();
    this.refreshNow();
    this.context.notifications?.show?.('Strategic map plans reset; affected sectors will refresh from the live world.');
  }

  planRemove(selection) {
    const { x, y } = this.coordinates(selection);
    const object = this.selectedWorldObject(selection);
    if (!object) throw new Error('The selected world object is no longer available.');
    const owner = this.owner(selection);
    const radius = this.radius(object, selection);
    const level = Number(call(selection.raw, ['get_BaseLevel']) ?? selection.level ?? 0);
    this.remove(x, y);
    this.influence(x, y, this.root().Data.EOwnerType.Player, 0, 0, 0, false);
    this.refresh();
    this.push('Plan remove', () => {
      this.insert(object, x, y);
      this.influence(x, y, owner.type, owner.id, radius, level, true);
    });
  }

  planLevel(selection) {
    const { x, y } = this.coordinates(selection);
    const object = this.selectedWorldObject(selection);
    if (!object) throw new Error('The selected base is no longer available.');
    const field = this.levelField(object);
    const oldLevel = Number(object[field]);
    const owner = this.owner(selection);
    const radius = this.radius(object, selection);
    object[field] = oldLevel + 1;
    this.markDirty(this.sectorAt(x, y));
    this.influence(x, y, owner.type, owner.id, radius, oldLevel + 1, true);
    this.refresh();
    this.push('Plan level up', () => {
      object[field] = oldLevel;
      this.influence(x, y, owner.type, owner.id, radius, oldLevel, true);
    });
  }

  planRuin(selection, alliance = null) {
    const { x, y } = this.coordinates(selection);
    const object = this.selectedWorldObject(selection);
    if (!object) throw new Error('The selected target is no longer available.');
    const owner = this.owner(selection);
    const radius = this.radius(object, selection);
    const level = Number(call(selection.raw, ['get_BaseLevel']) ?? selection.level ?? 0);
    const sector = this.sectorAt(x, y);
    this.markDirty(sector);
    const hash = this.ruinDetails(selection, sector, alliance);
    sector.SetDetails(hash, 1);
    this.refresh();
    const label = alliance ? `Plan ruin for ${alliance.label}` : 'Plan ruin';
    this.push(label, () => {
      this.insert(object, x, y);
      this.influence(x, y, owner.type, owner.id, radius, level, true);
    });
  }

  hashCodec() {
    if (this.discovery?.hashTable) return this.discovery;
    const root = this.root();
    const registry = globalThis.$I;
    const update = source(root.Data.AllianceSupportState?.prototype?.Update);
    const names = match(update, /switch\s?\(\$I\.([A-Z]{6})\.([A-Z]{6})\([a-z]\.c\[[a-z]\]\.charCodeAt\(0\)\)\)/, 'world-detail encoding');
    const decoder = registry?.[names[1]]?.[names[2]];
    const tableName = match(source(decoder), /return \$I\.[A-Z]{6}\.([A-Z]{6})\[[a-z]\]/, 'world-detail character table')[1];
    const table = registry[names[1]][tableName];
    const encodeNumber = (input, length = 5) => {
      let value = Number(input) || 0;
      const result = [];
      for (let index = length - 1; index >= 0; index -= 1) {
        const exponent = 91 ** index;
        const digit = Math.floor(value / exponent);
        value %= exponent;
        result.push(String.fromCharCode(table.indexOf(digit)));
      }
      return result.reverse().join('');
    };
    this.discover().hashTable = table;
    this.discover().encodeNumber = encodeNumber;
    this.discover().encodeString = (value) => `${encodeNumber(String(value).length, 1)}${value}`;
    return this.discovery;
  }

  sectorIdentityDiscovery() {
    const discovered = this.discover();
    if (discovered.playersMap) return discovered;
    const root = this.root();
    const details = source(root.Data.WorldSector.prototype.SetDetails);
    const fields = match(details,
      /case \$I\.[A-Z]{6}\.City:.+?this\.([A-Z]{6})\.[A-Z]{6}\(.+?[a-z]=this\.([A-Z]{6})\.d\[[a-z]\.[A-Z]{6}\].+?[a-z]=\(?\(?[a-z]\.([A-Z]{6})!=0.+?this\.([A-Z]{6})\.d\[[a-z]\.\3\]/,
      'sector player and alliance tables');
    discovered.playersMap = fields[2];
    discovered.playerAllianceIndex = fields[3];
    discovered.alliancesMap = fields[4];
    discovered.playerId = match(source(root.Vis.Region.RegionCity.prototype.get_PlayerId), /(?:return |:)[A-Za-z]+\.([A-Z]{6})/, 'player identifiers')[1];
    discovered.playerName = match(source(root.Vis.Region.RegionCity.prototype.get_PlayerName), /(?:return |:)[A-Za-z]+\.([A-Z]{6})/, 'player names')[1];
    discovered.playerFaction = match(source(root.Vis.Region.RegionCity.prototype.get_PlayerFaction), /(?:return |:)[A-Za-z]+\.([A-Z]{6})/, 'player factions')[1];
    discovered.allianceId = match(source(root.Vis.Region.RegionCity.prototype.get_AllianceId), /(?:return |:)[A-Za-z]+\.([A-Z]{6})/, 'alliance identifiers')[1];
    discovered.allianceName = match(source(root.Vis.Region.RegionCity.prototype.get_AllianceName), /(?:return |:)[A-Za-z]+\.([A-Z]{6})/, 'alliance names')[1];
    discovered.cityPlayerIndex = match(details,
      /case \$I\.[A-Z]{6}\.City:.+?([a-z])=this\.[A-Z]{6}\.d\[[a-z]\.([A-Z]{6})\].+?\1==null/,
      'city player references')[2];
    return discovered;
  }

  playerDataId(sector, identity) {
    const root = this.root();
    const d = this.sectorIdentityDiscovery();
    const players = sector[d.playersMap];
    const alliances = sector[d.alliancesMap];
    for (const [key, player] of Object.entries(players.d)) {
      if (Number(player[d.playerId]) === Number(identity.playerId) && Number(identity.playerId) !== 0) return Number(key);
    }
    let allianceDataId = Object.keys(alliances.d).find((key) => Number(alliances.d[key][d.allianceId]) === Number(identity.allianceId));
    const codec = this.hashCodec();
    if (allianceDataId == null) {
      let index = 1023;
      while (alliances.d[index]) index -= 1;
      alliances.d[index] = new root.Data.WorldSector.Alliance().$ctor(
        codec.encodeNumber(identity.allianceId) + codec.encodeNumber(0) + identity.allianceName, 0
      );
      alliances.c += 1;
      allianceDataId = index;
    }
    const factionMask = ((Number(identity.faction) % 4) << 1) | (Number(allianceDataId) << 3);
    let index = 1023;
    while (players.d[index]) index -= 1;
    players.d[index] = new root.Data.WorldSector.Player().$ctor(
      codec.encodeNumber(identity.playerId) + codec.encodeNumber(0) + codec.encodeNumber(factionMask, 2) + identity.playerName, 0
    );
    players.c += 1;
    return index;
  }

  ruinDetails(selection, sector, alliance) {
    const root = this.root();
    const codec = this.hashCodec();
    const current = this.mainData()?.get_Cities?.()?.get_CurrentOwnCity?.();
    const identity = alliance
      ? { playerId: 0, playerName: '\uFEFF', faction: root.Base.EFactionType.NotInitialized, allianceId: alliance.id, allianceName: alliance.label }
      : {
          playerId: Number(current?.get_PlayerId?.() ?? 0),
          playerName: String(current?.get_PlayerName?.() ?? ''),
          faction: Number(current?.get_CityFaction?.() ?? root.Base.EFactionType.NotInitialized),
          allianceId: Number(current?.get_AllianceId?.() ?? 0),
          allianceName: String(current?.get_AllianceName?.() ?? '')
        };
    const playerDataId = this.playerDataId(sector, identity);
    const raw = selection.raw;
    const playerCity = call(raw, ['get_VisObjectType']) === root.Vis.VisObject.EObjectType.RegionCityType;
    const object = this.selectedWorldObject(selection);
    let mask = playerCity ? 1 : 0;
    mask |= (Number(selection.level) & 255) << 1;
    mask |= (this.radius(object, selection) & 15) << 9;
    mask |= (playerDataId & 1023) << 13;
    let details = codec.encodeNumber(this.mainData().get_Time().GetServerStep());
    const attackerName = alliance?.label ?? current?.get_Name?.() ?? '';
    details += codec.encodeString(attackerName);
    if (playerCity) {
      details += codec.encodeNumber(Number(call(raw, ['get_PlayerId']) ?? 0));
      details += codec.encodeNumber(Number(call(raw, ['get_AllianceId']) ?? 0));
      details += codec.encodeNumber(Number(call(raw, ['get_PlayerFaction']) ?? 0));
      details += codec.encodeString(String(call(raw, ['get_PlayerName']) ?? ''));
      details += codec.encodeString(String(call(raw, ['get_AllianceName']) ?? ''));
      details += String(call(raw, ['get_Name']) ?? selection.name ?? '');
    }
    const location = (selection.x % 32) | ((selection.y % 32) << 5) | (root.Data.WorldSector.ObjectType.Ruin << 10);
    return `C${codec.encodeNumber(location, 2)}${codec.encodeNumber(mask, 4)}${details}`;
  }

  allianceOptions() {
    const alliance = this.mainData()?.get_Alliance?.();
    const result = [{ id: 0, label: 'No alliance', color: '#fb7a4b' }];
    const colors = ['#fb7a4b', '#00cc00', '#31eddd', '#fb607a', '#fb7a4b'];
    const relationships = alliance?.get_Relationships?.();
    if (Array.isArray(relationships)) {
      for (const relation of relationships) result.push({
        id: Number(relation.OtherAllianceId ?? 0),
        label: String(relation.OtherAllianceName ?? 'Alliance'),
        color: relation.IsConfirmed === false ? '#f5f5dc' : colors[Number(relation.Relationship)] ?? '#ffffff'
      });
    }
    return result.sort((a, b) => a.id === 0 ? -1 : b.id === 0 ? 1 : a.label.localeCompare(b.label));
  }

  moveHandlerName(info, mouseTool) {
    const ctorSource = source(info?.constructor?.$$original ?? info?.constructor);
    const named = ctorSource.match(/attachNetEvent\(this\.[\w$]+,[\w$]+,ClientLib\.Vis\.MouseTool\.OnMouseUp,this,this\.([\w$]+)\)/)?.[1];
    if (named && typeof info[named] === 'function') return named;
    return Object.keys(info ?? {}).find((key) => typeof info[key] === 'function'
      && source(info[key]).includes('GetCheckMoveBaseResult'))
      ?? Object.getOwnPropertyNames(Object.getPrototypeOf(info ?? {})).find((key) => typeof info?.[key] === 'function'
        && source(info[key]).includes('GetCheckMoveBaseResult'));
  }

  planMove(selection) {
    this.cancelMove();
    const root = this.root();
    const vis = root.Vis.VisMain.GetInstance();
    const tools = root.Vis.MouseTool;
    const mouseTool = vis.GetMouseTool(tools.EMouseTool.MoveBase);
    const info = globalThis.webfrontend?.gui?.region?.RegionCityMoveInfo?.getInstance?.();
    const utilities = globalThis.webfrontend?.phe?.cnc?.Util;
    if (!mouseTool || !info || !utilities) throw new Error('The native move-base preview tool is unavailable.');
    const originalHandler = this.moveHandlerName(info, mouseTool);
    if (!originalHandler) throw new Error('The native move-base click handler could not be identified.');
    const cities = this.mainData().get_Cities();
    const regionCity = selection.raw;
    const previousOwnCityId = cities.get_CurrentOwnCityId?.();
    const selectedId = call(regionCity, ['get_Id']);
    let restoreTerritoryIdentity = null;
    if (selectedId != null && call(regionCity, ['get_Type']) !== root.Vis.Region.RegionCity.ERegionCityType.Own) {
      const city = cities.GetCity?.(selectedId);
      if (city && city.get_Version?.() < 0) {
        city.SetPosition?.(selection.x, selection.y);
        city.set_BaseLevel?.(selection.level);
      }
      cities.set_CurrentOwnCityId?.(selectedId);
      restoreTerritoryIdentity = this.activateTerritoryIdentity(selection);
    }
    const deactivate = () => this.cancelMove();
    const mouseUp = (visX, visY, button) => {
      if (button === 'right') return;
      const region = this.region();
      const x = Math.floor(visX / region.get_GridWidth());
      const y = Math.floor(visY / region.get_GridHeight());
      const result = mouseTool.GetCheckMoveBaseResult(x, y);
      const ok = result === root.Data.EMoveBaseResult.OK || result === root.Data.EMoveBaseResult.FailCampIsAttacked;
      if (!ok) {
        if (result & root.Data.EMoveBaseResult.FailOldBasePosition) vis.SetMouseTool(tools.EMouseTool.SelectRegion, null);
        return;
      }
      const from = this.coordinates(selection);
      const object = this.selectedWorldObject(selection);
      const owner = this.owner(selection);
      const radius = this.radius(object, selection);
      const level = Number(selection.level ?? 0);
      const sourceSector = this.sectorAt(from.x, from.y);
      const destinationSector = this.sectorAt(x, y);
      const identityFields = this.sectorIdentityDiscovery();
      const oldPlayerIndex = object[identityFields.cityPlayerIndex];
      if (sourceSector !== destinationSector) {
        object[identityFields.cityPlayerIndex] = this.playerDataId(destinationSector, {
          playerId: Number(call(regionCity, ['get_PlayerId']) ?? 0),
          playerName: String(call(regionCity, ['get_PlayerName']) ?? ''),
          faction: Number(call(regionCity, ['get_PlayerFaction']) ?? root.Base.EFactionType.NotInitialized),
          allianceId: Number(call(regionCity, ['get_AllianceId']) ?? 0),
          allianceName: String(call(regionCity, ['get_AllianceName']) ?? '')
        });
      }
      this.influence(from.x, from.y, root.Data.EOwnerType.Player, 0, 0, 0, false);
      this.influence(x, y, owner.type, owner.id, radius, level, true);
      this.insert(object, x, y);
      this.remove(from.x, from.y);
      const city = cities.GetCity?.(selectedId);
      city?.SetPosition?.(x, y);
      this.refresh();
      vis.SetMouseTool(tools.EMouseTool.SelectRegion, null);
      this.push('Plan move base', () => {
        this.influence(x, y, root.Data.EOwnerType.Player, 0, 0, 0, false);
        this.influence(from.x, from.y, owner.type, owner.id, radius, level, true);
        this.insert(object, from.x, from.y);
        this.remove(x, y);
        object[identityFields.cityPlayerIndex] = oldPlayerIndex;
        city?.SetPosition?.(from.x, from.y);
      });
    };
    this.activeMove = { mouseTool, info, originalHandler, mouseUp, deactivate, cities, previousOwnCityId, restoreTerritoryIdentity };
    utilities.attachNetEvent(mouseTool, 'OnDeactivate', tools.OnDeactivate, this, deactivate);
    utilities.detachNetEvent(mouseTool, 'OnMouseUp', tools.OnMouseUp, info, info[originalHandler]);
    utilities.attachNetEvent(mouseTool, 'OnMouseUp', tools.OnMouseUp, this, mouseUp);
    info.setCity(regionCity);
    vis.SetMouseTool(tools.EMouseTool.MoveBase, cities.get_CurrentOwnCityId());
  }

  cancelMove() {
    const state = this.activeMove;
    if (!state) return;
    this.activeMove = null;
    const root = this.root();
    const utilities = globalThis.webfrontend?.phe?.cnc?.Util;
    try { utilities.detachNetEvent(state.mouseTool, 'OnDeactivate', root.Vis.MouseTool.OnDeactivate, this, state.deactivate); } catch { /* no-op */ }
    try { utilities.detachNetEvent(state.mouseTool, 'OnMouseUp', root.Vis.MouseTool.OnMouseUp, this, state.mouseUp); } catch { /* no-op */ }
    try { utilities.attachNetEvent(state.mouseTool, 'OnMouseUp', root.Vis.MouseTool.OnMouseUp, state.info, state.info[state.originalHandler]); } catch { /* no-op */ }
    if (state.previousOwnCityId != null) state.cities.set_CurrentOwnCityId?.(state.previousOwnCityId);
    try { state.restoreTerritoryIdentity?.(); } catch { /* no-op */ }
  }

  execute(type, selection, option = null) {
    if (type === 'move') return this.planMove(selection);
    if (type === 'ruin') return this.planRuin(selection);
    if (type === 'ruin-for') return this.planRuin(selection, option);
    if (type === 'level') return this.planLevel(selection);
    if (type === 'remove') return this.planRemove(selection);
    if (type === 'undo') return this.undo();
    if (type === 'reset') return this.reset();
    throw new Error(`Unknown strategic map action: ${type}`);
  }

  async destroy() {
    if (this.isDirty()) await this.reset();
    this.cancelMove();
    if (this.refreshTimer != null) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
}

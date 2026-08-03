function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value !== undefined && value !== null) return value;
      }
    } catch {
      // ClientLib can refresh objects while the War Room is reading them.
    }
  }
  return null;
}

function invoke(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] !== 'function') continue;
      target[name](...args);
      return true;
    } catch {
      // Try the next compatible native action name.
    }
  }
  return false;
}

function values(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection.filter(Boolean);
  // ClientLib dictionaries expose their authoritative entities in `d`; some
  // builds also expose an auxiliary `l` list which can be partial or contain
  // duplicate references. Legacy working scripts read `d` first.
  const source = collection.d ?? collection.l ?? collection;
  return Array.isArray(source)
    ? source.filter(Boolean)
    : Object.values(source).filter((value) => value && typeof value === 'object');
}

function unitValues(collection, depth = 0, seen = new Set()) {
  if (!collection || depth > 4 || seen.has(collection)) return [];
  if (typeof collection !== 'object' && typeof collection !== 'function') return [];
  seen.add(collection);
  const units = [];
  for (const candidate of values(collection)) {
    if (typeof candidate?.get_UnitGameData_Obj === 'function'
      || typeof candidate?.get_UnitGameData === 'function'
      || typeof candidate?.get_MdbUnitId === 'function') units.push(candidate);
    else units.push(...unitValues(candidate, depth + 1, seen));
  }
  return units;
}

const VERIFIED_OFFENSE_RANGES = new Map([
  ['pitbull', 2.5], ['predator', 2.5], ['predatortank', 2.5],
  ['firehawk', 1.5], ['paladin', 2.5], ['guardian', 1.5],
  ['rifleman', 1.5], ['riflemansquad', 1.5],
  ['zonetrooper', 1.5], ['zonetroopers', 1.5], ['missilesquad', 1.5],
  ['reckoner', 1.5], ['militant', 1.5], ['militants', 1.5],
  ['militantsquad', 1.5], ['venom', 2.5], ['cobra', 1.5],
  ['scorpion', 2.5], ['scorpiontank', 2.5], ['blackhand', 1.5],
  ['commando', 1.5], ['confessor', 2.5], ['avatar', 1.5],
  ['salamander', 2.5], ['spectre', 2.5], ['specter', 2.5]
]);

export function verifiedOffenseRange(name) {
  const normalized = String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (VERIFIED_OFFENSE_RANGES.has(normalized)) return VERIFIED_OFFENSE_RANGES.get(normalized);
  for (const [unitName, range] of VERIFIED_OFFENSE_RANGES) {
    if (normalized.endsWith(unitName)) return range;
  }
  return null;
}

export function estimatePossibleAttacks({ cpAvailable = 0, cpCost = 0, repair = {}, repairStorage = {} } = {}) {
  const commandPointAttacks = Number(cpCost) > 0
    ? Math.floor(Math.max(0, Number(cpAvailable) || 0) / Number(cpCost))
    : 0;
  const activeGroups = ['infantry', 'vehicle', 'aircraft']
    .map((name) => ({
      name,
      required: Math.max(0, Number(repair[name]) || 0),
      available: Math.max(0, Number(repairStorage[name]?.stored) || 0)
    }))
    .filter((group) => group.required > 0);
  const maxRepairSeconds = Math.max(0, ...activeGroups.map((group) => group.required));
  const repairAvailableSeconds = activeGroups.length
    ? Math.min(...activeGroups.map((group) => group.available))
    : 0;
  const fullyRepairableAttacks = maxRepairSeconds > 0
    ? Math.floor(repairAvailableSeconds / maxRepairSeconds)
    : Infinity;
  // Repair storage limits how many hits can be fully recovered, not whether the
  // next healthy formation may attack. Include one final partially/unrepaired
  // hit, then let command points apply the real upper bound.
  const repairTimeAttacks = Number.isFinite(fullyRepairableAttacks)
    ? fullyRepairableAttacks + 1
    : Infinity;
  return Object.freeze({
    cpAvailable: Math.max(0, Number(cpAvailable) || 0),
    cpCost: Math.max(0, Number(cpCost) || 0),
    commandPointAttacks,
    maxRepairSeconds,
    repairAvailableSeconds,
    fullyRepairableAttacks,
    repairTimeAttacks,
    possibleAttacks: Math.max(0, Math.min(commandPointAttacks, repairTimeAttacks))
  });
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function describeUnit(unit, root = null) {
  const mdbId = call(unit, ['get_MdbUnitId', 'get_MdbId', 'get_Id']);
  const resourceData = root?.Res?.ResMain?.GetInstance?.()?.GetUnit_Obj?.(mdbId) ?? null;
  const data = call(unit, ['get_UnitGameData_Obj', 'get_UnitGameData']) ?? resourceData;
  const weapon = call(unit, ['get_PrimaryWeapon', 'get_Weapon', 'get_WeaponData'])
    ?? call(data, ['get_PrimaryWeapon', 'get_Weapon', 'get_WeaponData'])
    ?? data?.pw ?? data?.w ?? data?.weapon ?? resourceData?.pw ?? resourceData?.w ?? null;
  const attackRange = call(unit, ['get_AttackRange', 'get_Range', 'get_WeaponRange', 'get_MaxAttackRange', 'get_AttackDistance'])
    ?? call(data, ['get_AttackRange', 'get_Range', 'get_WeaponRange', 'get_MaxAttackRange', 'get_AttackDistance'])
    ?? call(weapon, ['get_AttackRange', 'get_Range', 'get_WeaponRange', 'get_MaxRange'])
    ?? weapon?.r ?? weapon?.range ?? weapon?.rng
    ?? weapon?.rg ?? weapon?.wr ?? weapon?.maxRange
    ?? data?.ar ?? data?.r ?? data?.range ?? data?.rng ?? data?.rg ?? data?.wr
    ?? resourceData?.ar ?? resourceData?.r ?? resourceData?.range ?? resourceData?.rng
    ?? resourceData?.rg ?? resourceData?.wr;
  const speed = call(unit, ['get_MovementSpeed', 'get_Speed'])
    ?? call(data, ['get_MovementSpeed', 'get_Speed'])
    ?? data?.ms ?? data?.s ?? data?.speed;
  const preferredArmorType = call(data, [
    'get_PreferredArmorType', 'get_PreferedArmorType', 'get_TargetArmorType', 'get_PrimaryTargetType'
  ]) ?? data?.pat ?? data?.pt ?? null;
  const name = call(data, ['get_Name', 'get_DisplayName']) ?? data?.dn ?? data?.n ?? 'Unit';
  const nativeRange = Number(attackRange);
  return Object.freeze({
    id: mdbId,
    entityId: call(unit, ['get_Id']),
    name,
    level: Number(call(unit, ['get_CurrentLevel', 'get_Level', 'get_Lvl']) ?? 0),
    health: percent(call(unit, ['get_HitpointsPercent', 'get_HealthPercent', 'get_Health']) ?? 1),
    enabled: Boolean(call(unit, ['get_Enabled']) ?? true),
    x: Number(call(unit, ['get_CoordX', 'get_X']) ?? unit?.x ?? 0),
    y: Number(call(unit, ['get_CoordY', 'get_Y']) ?? unit?.y ?? 0),
    group: call(data, ['get_UnitGroupType', 'get_UnitGroup']) ?? data?.ug ?? null,
    movementType: call(data, ['get_MovementType', 'get_UnitMovementType']) ?? data?.mt ?? null,
    armorType: call(data, ['get_ArmorType', 'get_UnitArmorType']) ?? data?.ptt ?? null,
    attackRange: Number.isFinite(nativeRange) && nativeRange > 0
      ? nativeRange : Number(verifiedOffenseRange(name) ?? 0),
    speed: Number(speed ?? 0)
    , preferredArmorType
    , transporterId: call(unit, ['get_TransporterId', 'get_TransportUnitId', 'get_CarrierId']) ?? null
    , garrisonId: call(unit, ['get_GarrisonId', 'get_GarrisonUnitId', 'get_TransportedById']) ?? null
  });
}

function describeTargetEntity(entity) {
  const data = call(entity, ['get_UnitGameData_Obj', 'get_UnitGameData']);
  const requirements = values(call(entity, ['get_UnitLevelRepairRequirements']));
  return Object.freeze({
    id: call(entity, ['get_MdbUnitId', 'get_MdbId', 'get_Id']),
    name: call(data, ['get_Name', 'get_DisplayName']) ?? data?.dn ?? data?.n ?? 'Unknown',
    level: Number(call(entity, ['get_CurrentLevel', 'get_Level', 'get_Lvl']) ?? 0),
    health: percent(call(entity, ['get_HitpointsPercent', 'get_Health']) ?? 1),
    x: Number(call(entity, ['get_CoordX', 'get_X']) ?? 0),
    y: Number(call(entity, ['get_CoordY', 'get_Y']) ?? 0),
    movementType: call(data, ['get_MovementType', 'get_UnitMovementType']) ?? data?.mt ?? null,
    armorType: call(data, ['get_ArmorType', 'get_UnitArmorType']) ?? data?.ptt ?? null,
    attackRange: Number(call(data, ['get_AttackRange', 'get_Range']) ?? data?.ar ?? 0),
    attackCounter: Number(call(entity, ['get_AttackCounter', 'get_Attacks', 'get_AttackCount']) ?? 0),
    requirements: Object.freeze(requirements.map((item) => Object.freeze({
      type: item.Type,
      amount: Number(item.Count ?? 0)
    })))
  });
}

function describeCity(city) {
  if (!city) return null;
  return Object.freeze({
    raw: city,
    id: call(city, ['get_Id', 'get_CityId']),
    version: call(city, ['get_Version', 'get_BaseVersion', 'get_LayoutVersion']) ?? 0,
    name: call(city, ['get_Name', 'get_CityName']) ?? 'Unknown target',
    level: Number(call(city, ['get_LvlBase', 'get_BaseLevel', 'get_BaseLevelFloat', 'get_Level']) ?? 0),
    offenseLevel: Number(call(city, ['get_LvlOffense', 'get_OffenseLevel'])
      ?? call(call(city, ['get_CityUnitsData']), ['get_OffenseLevel', 'get_LvlOffense']) ?? 0),
    x: Number(call(city, ['get_PosX', 'get_RawX', 'get_X']) ?? 0),
    y: Number(call(city, ['get_PosY', 'get_RawY', 'get_Y']) ?? 0),
    owner: call(city, ['get_PlayerName', 'get_OwnerName']) ?? 'Forgotten',
    alliance: call(city, ['get_AllianceName', 'get_OwnerAllianceName']) ?? '',
    npc: Boolean(call(city, ['IsNPC', 'get_IsNPC']))
  });
}

export class WarRoomHub {
  constructor(context) {
    this.context = context;
    this.hub = context?.hub;
    this.lastCombatTargetId = null;
    this.reportCache = null;
    this.reportCacheCategory = null;
    this.reportCaches = new Map();
    this.reportRefreshPromises = new Map();
    this.reportRefreshQueue = Promise.resolve();
    this.combatStatisticsReports = Object.freeze([]);
    this.offenseBaseCache = new Map();
    this.targetDescriptionCache = new Map();
  }

  clientLib() {
    return this.hub?.game?.services?.tryGet?.('clientLib') ?? null;
  }

  mainData() {
    return this.clientLib()?.getMainData?.() ?? null;
  }

  resolveTarget(cities, targetRaw, attacker) {
    const initial = describeCity(targetRaw);
    if (!initial?.id || String(initial.id) === String(attacker?.id)) {
      return Object.freeze({ raw: null, target: null });
    }
    const targetId = String(initial.id);
    const resolvedCity = call(cities, ['GetCity', 'get_City'], initial.id);
    const selection = this.hub?.game?.services?.tryGet?.('selection')?.current?.() ?? null;
    const selectionId = call(selection, ['get_Id', 'get_CityId', 'get_BaseId']);
    const candidates = [];
    if (selection && String(selectionId) === targetId) candidates.push(selection);
    candidates.push(resolvedCity, targetRaw);
    const descriptions = candidates.map(describeCity).filter(Boolean);
    const cached = this.targetDescriptionCache.get(targetId);
    const usefulName = (value) => value && value !== 'Unknown target';
    const first = (field, predicate = (value) => value != null) =>
      descriptions.map((item) => item[field]).find(predicate) ?? cached?.[field];
    const target = Object.freeze({
      ...(cached ?? initial),
      raw: resolvedCity ?? targetRaw,
      id: initial.id,
      version: first('version', (value) => Number(value) > 0) ?? 0,
      name: first('name', usefulName) ?? 'Unknown target',
      level: Number(first('level', (value) => Number(value) > 0) ?? 0),
      offenseLevel: Number(first('offenseLevel', (value) => Number(value) > 0) ?? 0),
      x: Number(first('x', (value) => Number.isFinite(Number(value)) && Number(value) >= 0) ?? 0),
      y: Number(first('y', (value) => Number.isFinite(Number(value)) && Number(value) >= 0) ?? 0),
      owner: first('owner', (value) => Boolean(value && value !== 'Forgotten')) ?? cached?.owner ?? 'Forgotten',
      alliance: first('alliance', Boolean) ?? cached?.alliance ?? '',
      npc: Boolean(first('npc', (value) => value === true) ?? cached?.npc ?? false)
    });
    if (usefulName(target.name) || target.level > 0) this.targetDescriptionCache.set(targetId, target);
    return Object.freeze({ raw: resolvedCity ?? targetRaw, target });
  }

  snapshot() {
    const clientLib = this.clientLib();
    const root = clientLib?.root;
    const main = this.mainData();
    const cities = call(main, ['get_Cities']);
    const attackerRaw = call(cities, ['get_CurrentOwnCity']);
    const targetRaw = call(cities, ['get_CurrentCity']);
    const attacker = describeCity(attackerRaw);
    const resolvedTarget = this.resolveTarget(cities, targetRaw, attacker);
    const target = resolvedTarget.target;
    const selectedTargetRaw = resolvedTarget.raw;
    const formationManager = call(attackerRaw, ['get_CityArmyFormationsManager']);
    const formation = target?.id == null
      ? null
      : call(formationManager, ['GetFormationByTargetBaseId'], target.id);
    const resourceTypes = root?.Base?.EResourceType ?? {};
    const repairCostApi = root?.API?.Util?.GetUnitRepairCostsForCity;
    const units = values(call(formation, ['get_ArmyUnits'])).map((rawUnit) => {
      const unit = describeUnit(rawUnit);
      const repairCosts = {};
      if (typeof repairCostApi === 'function' && attackerRaw) {
        try {
          for (const cost of values(repairCostApi(
            attackerRaw, unit.level, unit.id, 1
          ))) {
            const type = cost.Type ?? cost.type ?? cost.t;
            if (type != null) repairCosts[type] = Number(cost.Count ?? cost.count ?? cost.c ?? 0);
          }
        } catch (error) {
          this.logger?.debug?.('Unable to read full unit repair cost.', {
            unitId: unit.id, error: error?.message ?? String(error)
          });
        }
      }
      return Object.freeze({ ...unit, repairCosts: Object.freeze(repairCosts) });
    });
    const targetUnitData = call(selectedTargetRaw, ['get_CityUnitsData']);
    const targetRepairApi = root?.API?.Util?.GetUnitRepairCosts;
    const targetMaxHealthApi = root?.API?.Util?.GetUnitMaxHealthByLevel;
    const resourceMain = root?.Res?.ResMain?.GetInstance?.();
    const activeTargetModules = values(call(selectedTargetRaw, ['get_ActiveModules']))
      .map((module) => Number(module?.i ?? module?.Id ?? module))
      .filter(Number.isFinite);
    const hitpointOverrideType = root?.Base?.EUnitModuleType?.HitpointOverride;
    const unitWithActiveHitpointOverride = (unitData) => {
      if (!unitData || hitpointOverrideType == null || !activeTargetModules.length) return unitData;
      const override = values(unitData.m).find((module) =>
        Number(module?.t) === Number(hitpointOverrideType)
        && activeTargetModules.includes(Number(module?.i)));
      if (!override || override.h == null) return unitData;
      return { ...unitData, lp: override.h };
    };
    const withTargetResourceValue = (rawEntity) => {
      const entity = describeTargetEntity(rawEntity);
      const resourceValue = {};
      if (typeof targetRepairApi === 'function') {
        try {
          for (const cost of values(targetRepairApi(
            entity.level, entity.id, 1
          ))) {
            const type = cost.Type ?? cost.type ?? cost.t;
            if (type != null) resourceValue[type] = Number(cost.Count ?? cost.count ?? cost.c ?? 0);
          }
        } catch (error) {
          this.context?.logger?.debug?.('Unable to read target resource value.', {
            unitId: entity.id, error: error?.message ?? String(error)
          });
        }
      }
      let maxHealth = 0;
      if (typeof targetMaxHealthApi === 'function') {
        try {
          const unitData = unitWithActiveHitpointOverride(resourceMain?.GetUnit_Obj?.(entity.id));
          maxHealth = Math.floor(Number(targetMaxHealthApi(entity.level, unitData, !target?.npc)) || 0) * 16;
        } catch { /* The simulation start health remains the compatibility fallback. */ }
      }
      return Object.freeze({ ...entity, maxHealth, resourceValue: Object.freeze(resourceValue) });
    };
    const defenseUnits = values(call(targetUnitData, ['get_DefenseUnits']))
      .map(withTargetResourceValue);
    const buildings = values(call(selectedTargetRaw, ['get_Buildings']))
      .map(withTargetResourceValue);
    const cpCost = target && attackerRaw
      ? Number(call(attackerRaw, ['CalculateAttackCommandPointCostToCoord'], target.x, target.y) ?? 0)
      : 0;
    const player = call(main, ['get_Player']);
    const cpAvailable = Number(call(player, ['GetCommandPointCount', 'get_CommandPointCount']) ?? 0);
    const loot = {};
    for (const entry of values(root?.API?.Battleground?.GetInstance?.()?.GetLootFromCurrentCity?.())) {
      const type = entry.Type ?? entry.type ?? entry.t;
      if (type != null) loot[type] = Number(entry.Count ?? entry.count ?? entry.c ?? 0);
    }
    const unitData = call(attackerRaw, ['get_CityUnitsData']);
    const groups = root?.Data?.EUnitGroup ?? {};
    const repair = {};
    const repairStorage = {};
    for (const [name, group] of [
      ['infantry', groups.Infantry],
      ['vehicle', groups.Vehicle],
      ['aircraft', groups.Aircraft]
    ]) {
      repair[name] = Number(call(unitData, ['GetRepairTimeFromEUnitGroup'], group, false) ?? 0);
      const type = name === 'infantry' ? resourceTypes.RepairChargeInf
        : name === 'vehicle' ? resourceTypes.RepairChargeVeh : resourceTypes.RepairChargeAir;
      repairStorage[name] = Object.freeze({
        stored: Number(call(attackerRaw, ['GetResourceCount'], type) ?? 0),
        capacity: Number(call(attackerRaw, ['GetResourceMaxStorage'], type) ?? 0)
      });
    }
    const alliance = call(main, ['get_Alliance']);
    const allianceBonuses = [
      'get_POIInfantryBonus', 'get_POIVehicleBonus', 'get_POIAirBonus', 'get_POIDefenseBonus'
    ].map((name) => Number(call(alliance, [name]) ?? 0));

    const attackEstimate = estimatePossibleAttacks({ cpAvailable, cpCost, repair, repairStorage });
    let morale = Object.freeze({ enabled: false, kind: 0, deficit: 0, effectiveness: 100 });
    try {
      const sign = root?.Base?.Util?.GetMoralSignType?.(attacker?.offenseLevel ?? 0, target?.level ?? 0);
      const serverUsesMorale = Boolean(call(call(main, ['get_Server']), ['get_CombatUseMoral']));
      const kind = Number(sign?.k ?? 0);
      const deficit = serverUsesMorale && target?.npc && (kind === 1 || kind === 2)
        ? Math.max(0, Number(sign?.v ?? 0)) : 0;
      morale = Object.freeze({ enabled: serverUsesMorale && Boolean(target?.npc), kind,
        deficit, effectiveness: Math.max(0, 100 - deficit) });
    } catch {}
    return Object.freeze({
      generatedAt: Date.now(),
      attacker,
      target,
      units: Object.freeze(units),
      defenseUnits: Object.freeze(defenseUnits),
      buildings: Object.freeze(buildings),
      resourceTypes: Object.freeze({ ...(root?.Base?.EResourceType ?? {}) }),
      movementTypes: Object.freeze({ ...(root?.Base?.EUnitMovementType ?? {}) }),
      armorTypes: Object.freeze({ ...(root?.Base?.EArmorType ?? {}) }),
      cpCost,
      cpAvailable,
      attackEstimate,
      loot: Object.freeze(loot),
      repair: Object.freeze(repair),
      repairStorage: Object.freeze(repairStorage),
      morale,
      allianceBonuses: Object.freeze(allianceBonuses),
      canSimulate: Boolean(attacker && target && units.length)
    });
  }

  offenseBases() {
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const cities = call(this.mainData(), ['get_Cities']);
    const owned = values(call(cities, ['get_AllCities', 'get_Cities']) ?? cities);
    const commandCenterTech = root?.Base?.ETechName?.Command_Center;
    const unique = new Map();
    const seenLocations = new Set();
    for (const city of owned) {
      const id = call(city, ['get_Id', 'get_CityId']);
      // get_AllCities().d is the authoritative owned-city collection and is
      // also where non-current bases retain their CityUnitsData. Resolving the
      // same id through GetCity can return a lightweight region instance with
      // no offense collection.
      const signature = `${call(city, ['get_Name', 'get_CityName']) ?? ''}:`
        + `${call(city, ['get_PosX', 'get_X']) ?? ''}:${call(city, ['get_PosY', 'get_Y']) ?? ''}`;
      if (seenLocations.has(signature)) continue;
      seenLocations.add(signature);
      if (id != null && !unique.has(String(id))) unique.set(String(id), city);
    }
    const activeSnapshot = this.snapshot();
    const described = [...unique.values()].map((city) => {
      const id = call(city, ['get_Id', 'get_CityId']);
      const resolvedCity = id == null ? null : call(cities, ['GetCity', 'get_City'], id);
      const citySources = [city, resolvedCity].filter(Boolean);
      const buildings = citySources.map((source) => call(source, ['get_CityBuildingsData'])).find(Boolean);
      const commandCenter = commandCenterTech == null ? null
        : call(buildings, ['GetUniqueBuildingByTechName'], commandCenterTech);
      if (!commandCenter) return null;
      let rawUnits = [];
      for (const source of citySources) {
        const unitData = call(source, ['get_CityUnitsData']);
        rawUnits = unitValues(call(unitData, ['get_OffenseUnits', 'get_ArmyUnits'])
          ?? call(source, ['get_OffenseUnits', 'get_ArmyUnits'])
          ?? unitData?.m_OffenseUnits ?? unitData?.OffenseUnits);
        if (!rawUnits.length) {
          // Some minified builds hide the public offense getter. Discover the
          // collection by the same stable unit-group shape used by Upgrade
          // Manager, without patching ClientLib prototypes.
          for (const collection of Object.values(unitData ?? {})) {
            const entries = unitValues(collection);
            const sample = entries[0];
            if (!sample) continue;
            const group = call(sample, ['GetUnitGroupType', 'get_UnitGroupType']);
            if (group != null && Number(group) !== 0) {
              rawUnits = entries;
              break;
            }
          }
        }
        if (rawUnits.length) break;
      }
      const cacheKey = String(id);
      const normalizedActiveUnits = String(activeSnapshot.attacker?.id) === String(id)
        ? activeSnapshot.units : [];
      const units = rawUnits.length
        ? rawUnits.map((rawUnit) => {
          const unit = describeUnit(rawUnit, root);
          const repairCosts = {};
          const damageRatio = Math.max(0, Math.min(1, (100 - Number(unit.health || 0)) / 100));
          const repairApi = root?.API?.Util?.GetUnitRepairCostsForCity;
          if (damageRatio > 0 && typeof repairApi === 'function') {
            const ownerCity = call(rawUnit, ['get_City']) ?? citySources[0];
            try {
              for (const cost of values(repairApi(ownerCity, unit.level, unit.id, damageRatio))) {
                repairCosts[cost.Type] = Number(cost.Count ?? 0);
              }
            } catch { /* Unit data can be briefly incomplete during a city refresh. */ }
          }
          return Object.freeze({ ...unit, repairCosts: Object.freeze(repairCosts) });
        })
        : normalizedActiveUnits.length ? normalizedActiveUnits
        : this.offenseBaseCache.get(cacheKey)?.units ?? [];
      const base = Object.freeze({
        id: call(city, ['get_Id', 'get_CityId']),
        name: call(city, ['get_Name', 'get_CityName']) ?? 'Unknown base',
        commandCenterLevel: Number(call(commandCenter, ['get_CurrentLevel', 'get_Level']) ?? 0),
        units: Object.freeze(units),
        resourceTypes: Object.freeze({ ...(root?.Base?.EResourceType ?? {}) }),
        movementTypes: Object.freeze({ ...(root?.Base?.EUnitMovementType ?? {}) }),
        armorTypes: Object.freeze({ ...(root?.Base?.EArmorType ?? {}) })
      });
      if (units.length) this.offenseBaseCache.set(cacheKey, base);
      return base;
    }).filter(Boolean);
    const final = new Map();
    for (const base of described) {
      const key = `${base.id}:${base.name}`;
      if (!final.has(key)) final.set(key, base);
    }
    return [...final.values()];
  }

  openCombatSetup() {
    const snapshot = this.snapshot();
    const targetId = snapshot.target?.id ?? this.lastCombatTargetId;
    if (!targetId) throw new Error('Select a target in the game first.');
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const mode = root?.Data?.PlayerAreaViewMode?.pavmCombatSetupDefense;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    app?.getBackgroundArea?.()?.closeCityInfo?.();
    if (mode == null || !app?.getPlayArea?.()?.setView) {
      throw new Error('The native attack setup view is unavailable.');
    }
    app.getPlayArea().setView(mode, targetId, 0, 0);
    return snapshot;
  }

  isAttackSetupOpen(snapshot = null) {
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const playArea = globalThis.qx?.core?.Init?.getApplication?.()?.getPlayArea?.();
    const current = call(playArea, ['getViewMode', 'get_ViewMode', 'getMode']);
    const modes = [
      root?.Data?.PlayerAreaViewMode?.pavmCombatSetupDefense,
      root?.Data?.PlayerAreaViewMode?.pavmCombatSetupBase
    ].filter((value) => value != null).map(Number);
    return modes.includes(Number(current)) && Boolean((snapshot ?? this.snapshot()).target?.id);
  }

  searchTargets(options) {
    const scanner = this.hub?.scanner;
    if (!scanner?.findTargets) {
      const host = globalThis.window ?? globalThis;
      host.CnCTA?.installScannerHubExtension?.(this.hub);
    }
    if (!this.hub?.scanner?.findTargets) {
      throw new Error('The shared Scanner Hub service is unavailable.');
    }
    return this.hub.scanner.findTargets(options);
  }

  getSearchOptions() {
    const host = globalThis.window ?? globalThis;
    if (!this.hub?.scanner?.getOptionsSnapshot) host.CnCTA?.installScannerHubExtension?.(this.hub);
    return this.hub?.scanner?.getOptionsSnapshot?.() ?? { ownCities: [], maxAttackDistance: 10 };
  }

  getAllianceOptions(options) {
    const scanner = this.hub?.scanner;
    if (!scanner?.getAllianceOptions) {
      const host = globalThis.window ?? globalThis;
      host.CnCTA?.installScannerHubExtension?.(this.hub);
    }
    return this.hub?.scanner?.getAllianceOptions?.(options) ?? [];
  }

  selectSearchTarget(target) {
    if (!this.hub?.scanner?.selectTarget) throw new Error('Native map target selection is unavailable.');
    return this.hub.scanner.selectTarget(target);
  }

  repairOffense(baseId) {
    const cities = call(this.mainData(), ['get_Cities']);
    const city = call(cities, ['GetCity', 'get_City'], baseId)
      ?? values(call(cities, ['get_AllCities', 'get_Cities']) ?? cities)
        .find((candidate) => String(call(candidate, ['get_Id', 'get_CityId'])) === String(baseId));
    if (!city) throw new Error('The selected offense base is unavailable.');
    if (call(city, ['get_IsGhostMode']) || call(city, ['get_IsLocked'])) {
      throw new Error('The selected offense base cannot be repaired right now.');
    }
    const mode = this.clientLib()?.root?.Vis?.Mode?.ArmySetup
      ?? globalThis.ClientLib?.Vis?.Mode?.ArmySetup;
    const repair = call(city, ['get_CityRepairData']);
    if (mode == null || !repair) throw new Error('Offense repair is unavailable in this game build.');
    if (!call(repair, ['CanRepairAll'], mode)) return Object.freeze({ repaired: false, name: call(city, ['get_Name']) ?? 'Base' });
    if (!invoke(repair, ['RepairAll'], mode)) throw new Error('The game rejected the offense repair request.');
    return Object.freeze({ repaired: true, name: call(city, ['get_Name']) ?? 'Base' });
  }

  simulateFormation(units) {
    const hub = this;
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.attacker?.id) {
      return Promise.reject(new Error('Open a target in combat setup first.'));
    }
    const communication = this.clientLib()?.root?.Net?.CommunicationManager?.GetInstance?.();
    const commandResult = this.clientLib()?.root?.Net?.CommandResult;
    const delegateFactory = globalThis.webfrontend?.phe?.cnc?.Util?.createEventDelegate;
    const battleground = this.clientLib()?.root?.API?.Battleground?.GetInstance?.();
    const netUtil = globalThis.webfrontend?.phe?.cnc?.Util;
    const reportEventType = this.clientLib()?.root?.API?.OnSimulateCombatReport;
    if (!communication?.SendSimpleCommand || !delegateFactory) {
      return Promise.reject(new Error('The native battle simulation API is unavailable.'));
    }
    const armyUnits = units
      .filter((unit) => unit.entityId != null && unit.enabled !== false && Number(unit.health) > 0)
      .map((unit) => ({ i: unit.entityId, x: unit.x, y: unit.y }));
    return new Promise((resolve, reject) => {
      let nativeCombatReport = null;
      let reportAttachedWithNetUtil = false;
      const onReport = (event) => {
        const report = typeof event?.GetAttackerTotalResourceReceived === 'function'
          ? event : event?.getData?.() ?? event?.data ?? event;
        nativeCombatReport = this.readSimulationCombatReport(report);
      };
      try {
        if (netUtil?.attachNetEvent && reportEventType != null) {
          netUtil.attachNetEvent(battleground, 'OnSimulateCombatReport', reportEventType, this, onReport);
          reportAttachedWithNetUtil = true;
        }
      } catch {}
      if (!reportAttachedWithNetUtil) {
        try { battleground?.addListener?.('OnSimulateCombatReport', onReport, this); } catch {}
      }
      const cleanup = () => {
        clearTimeout(timeout);
        if (!reportAttachedWithNetUtil) {
          try { battleground?.removeListener?.('OnSimulateCombatReport', onReport, this); } catch {}
        }
        try {
          if (netUtil?.detachNetEvent && reportEventType != null) {
            netUtil.detachNetEvent(battleground, 'OnSimulateCombatReport', reportEventType, this, onReport);
          }
        } catch {}
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Battle simulation timed out.'));
      }, 12000);
      const receiver = {
        done(status, response) {
          // CommandResult delegates have changed argument order between game
          // builds. Some also wrap the command body in getData()/data. Accept
          // every observed shape instead of treating a valid response as an
          // empty simulation.
          const candidates = [
            response,
            response?.getData?.(),
            response?.data,
            status,
            status?.getData?.(),
            status?.data
          ];
          const payload = candidates.find((candidate) => candidate?.d && candidate?.e != null)
            ?? candidates.find((candidate) => candidate?.d?.d && candidate?.d?.e != null)?.d
            ?? null;
          if (!payload?.d || payload.e == null) {
            const detail = response?.error ?? response?.message ?? status?.error ?? status?.message;
            cleanup();
            reject(new Error(`The game returned no battle simulation data${detail ? `: ${detail}` : '.'}`));
            return;
          }
          const events = Array.isArray(payload.e)
            ? payload.e
            : typeof payload.e?.map === 'function'
              ? Array.from(payload.e)
              : values(payload.e);
          // The native combat-report event is delivered separately from the
          // command callback. Give it one UI tick to publish exact rewards.
          setTimeout(() => {
            cleanup();
            resolve(hub.enrichSimulationResponse(
              { ...payload, e: events, nativeCombatReport,
                nativeReportLoot: nativeCombatReport?.loot ?? null }, snapshot
            ));
          }, 150);
        }
      };
      communication.SendSimpleCommand('SimulateBattle', {
        battleSetup: {
          d: snapshot.target.id,
          a: snapshot.attacker.id,
          u: armyUnits,
          s: 0
        }
      }, delegateFactory(commandResult, receiver, receiver.done), null);
    });
  }

  simulateActiveFormation() {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.attacker?.id || !snapshot.units.length) {
      return Promise.reject(new Error('Open a target attack screen with an offensive formation first.'));
    }
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const api = root?.API?.Battleground?.GetInstance?.();
    const netUtil = globalThis.webfrontend?.phe?.cnc?.Util;
    const reportEventType = root?.API?.OnSimulateCombatReport;
    const finishedEventType = root?.API?.OnSimulateBattleFinished;
    const canAttachNativeEvents = Boolean(
      netUtil?.attachNetEvent && netUtil?.detachNetEvent
      && reportEventType != null && finishedEventType != null
    );
    const canAttachListeners = typeof api?.addListener === 'function';
    if (!api?.SimulateBattle || (!canAttachNativeEvents && !canAttachListeners)) {
      return Promise.reject(new Error('The native game simulation report API is unavailable.'));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      let nativeCombatReport = null;
      let finishedPayload = null;
      let reportWaitTimeout = null;
      const useNativeEvents = canAttachNativeEvents;
      const complete = () => {
        if (!finishedPayload) return;
        const events = Array.isArray(finishedPayload.e)
          ? finishedPayload.e
          : typeof finishedPayload.e?.map === 'function'
            ? Array.from(finishedPayload.e)
            : values(finishedPayload.e);
        finish(null, this.enrichSimulationResponse(
          { ...finishedPayload, e: events, nativeCombatReport,
            nativeReportLoot: nativeCombatReport?.loot ?? null }, snapshot
        ));
      };
      const onReport = (event) => {
        // attachNetEvent delivers ClientLib's report instance directly. Do not
        // call its unrelated getData() method; legacy TABS consumes this exact
        // object via GetAttackerTotalResourceReceived().
        const report = typeof event?.GetAttackerTotalResourceReceived === 'function'
          ? event : event?.getData?.() ?? event?.data ?? event;
        nativeCombatReport = this.readSimulationCombatReport(report);
        if (nativeCombatReport && finishedPayload) complete();
      };
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearTimeout(reportWaitTimeout);
        if (useNativeEvents) {
          try {
            netUtil.detachNetEvent(api, 'OnSimulateBattleFinished', finishedEventType, this, onFinished);
          } catch {}
          try {
            netUtil.detachNetEvent(api, 'OnSimulateCombatReport', reportEventType, this, onReport);
          } catch {}
        } else {
          try { api.removeListener?.('OnSimulateBattleFinished', onFinished, this); } catch {}
          try { api.removeListener?.('OnSimulateCombatReport', onReport, this); } catch {}
        }
        if (error) reject(error);
        else resolve(value);
      };
      const onFinished = (event) => {
        const payload = event?.d ? event : event?.getData?.() ?? event?.data ?? event;
        if (!payload?.d) {
          finish(new Error('The game returned no battle simulation data.'));
          return;
        }
        finishedPayload = payload;
        if (nativeCombatReport) complete();
        else {
          // The established simulators keep this event subscribed for the
          // lifetime of their UI. Use a bounded wait here so slower worlds can
          // publish their report without leaking listeners indefinitely.
          reportWaitTimeout = setTimeout(complete, 3000);
        }
      };
      const timeout = setTimeout(() => finish(new Error('Battle simulation timed out.')), 12000);
      try {
        if (useNativeEvents) {
          netUtil.attachNetEvent(api, 'OnSimulateBattleFinished', finishedEventType, this, onFinished);
          netUtil.attachNetEvent(api, 'OnSimulateCombatReport', reportEventType, this, onReport);
        } else {
          api.addListener('OnSimulateCombatReport', onReport, this);
          api.addListener('OnSimulateBattleFinished', onFinished, this);
        }
        api.SimulateBattle();
      } catch (error) {
        finish(error);
      }
    });
  }

  readSimulationReportLoot(report) {
    if (!report || typeof report.GetAttackerTotalResourceReceived !== 'function') return null;
    const types = this.clientLib()?.root?.Base?.EResourceType ?? {};
    const loot = {};
    for (const name of ['Tiberium', 'Crystal', 'Gold', 'Credits', 'ResearchPoints']) {
      const type = types[name];
      if (type == null || loot[type] != null) continue;
      try { loot[type] = Number(report.GetAttackerTotalResourceReceived(type) ?? 0); } catch {}
    }
    return Object.keys(loot).length ? Object.freeze(loot) : null;
  }

  readSimulationCombatReport(report) {
    if (!report) return null;
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const types = root?.Base?.EResourceType ?? {};
    const loot = this.readSimulationReportLoot(report) ?? {};
    const repairCosts = {};
    if (typeof report.GetAttackerRepairCosts === 'function') {
      for (const type of new Set(Object.values(types).filter((value) => Number.isFinite(Number(value))))) {
        try {
          const amount = Number(report.GetAttackerRepairCosts(type) ?? 0);
          if (amount) repairCosts[type] = amount;
        } catch {}
      }
    }
    const scalars = {};
    const seenNames = new Set();
    let cursor = report;
    for (let depth = 0; cursor && depth < 4; depth += 1, cursor = Object.getPrototypeOf(cursor)) {
      for (const name of Object.getOwnPropertyNames(cursor)) {
        if (seenNames.has(name) || name === 'constructor') continue;
        seenNames.add(name);
        let fn;
        try { fn = report[name]; } catch { continue; }
        if (typeof fn !== 'function' || fn.length !== 0
          || !/^(?:get_|Get).*(?:condition|state|health|result|outcome|repair|duration|combat)/i.test(name)) continue;
        try {
          const value = fn.call(report);
          if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) scalars[name] = value;
        } catch {}
      }
    }
    const ownData = {};
    for (const [name, value] of Object.entries(report)) {
      if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) ownData[name] = value;
    }
    return Object.freeze({
      raw: report,
      loot: Object.freeze({ ...loot }),
      repairCosts: Object.freeze(repairCosts),
      summary: this.readSimulationReportSummary(report),
      scalars: Object.freeze(scalars),
      ownData: Object.freeze(ownData)
    });
  }

  readSimulationReportSummary(report) {
    if (!report) return null;
    const getters = new Map();
    let cursor = report;
    for (let depth = 0; cursor && depth < 5; depth += 1, cursor = Object.getPrototypeOf(cursor)) {
      for (const name of Object.getOwnPropertyNames(cursor)) {
        if (name === 'constructor' || getters.has(name)) continue;
        try {
          if (typeof report[name] === 'function' && report[name].length === 0 && /^(?:get_|Get)/.test(name)) {
            getters.set(name, report[name]);
          }
        } catch {}
      }
    }
    const invokeGetter = (names) => {
      for (const name of names) {
        const fn = getters.get(name);
        if (!fn) continue;
        try {
          const value = fn.call(report);
          if (value !== undefined && value !== null) return value;
        } catch {}
      }
      return null;
    };
    const findGetter = ({ include, exclude = [] }) => {
      for (const [name, fn] of getters) {
        const normalized = name.toLowerCase();
        if (!include.every((token) => normalized.includes(token))
          || exclude.some((token) => normalized.includes(token))) continue;
        try {
          const value = fn.call(report);
          if (value !== undefined && value !== null) return value;
        } catch {}
      }
      return null;
    };
    const percentValue = (value) => {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) return null;
      const percent = number <= 1 ? number * 100 : number;
      return percent <= 100.5 ? Math.max(0, Math.min(100, percent)) : null;
    };
    const targetState = percentValue(invokeGetter([
      'GetDefenderConditionInPercent', 'get_DefenderConditionInPercent',
      'GetDefenderTotalConditionInPercent', 'get_DefenderTotalConditionInPercent',
      'GetTargetState', 'get_TargetState'
    ]) ?? findGetter({ include: ['defender', 'condition'], exclude: ['building', 'base', 'defense'] }));
    const baseState = percentValue(invokeGetter([
      'GetDefenderBuildingsConditionInPercent', 'get_DefenderBuildingsConditionInPercent',
      'GetDefenderBaseConditionInPercent', 'get_DefenderBaseConditionInPercent',
      'GetBaseState', 'get_BaseState'
    ]) ?? findGetter({ include: ['defender', 'building', 'condition'] })
      ?? findGetter({ include: ['base', 'state'] }));
    const defenseState = percentValue(invokeGetter([
      'GetDefenderDefenseConditionInPercent', 'get_DefenderDefenseConditionInPercent',
      'GetDefenseState', 'get_DefenseState'
    ]) ?? findGetter({ include: ['defender', 'defense', 'condition'] })
      ?? findGetter({ include: ['defense', 'state'] }));
    const armyState = percentValue(invokeGetter([
      'GetAttackerConditionInPercent', 'get_AttackerConditionInPercent',
      'GetAttackerArmyConditionInPercent', 'get_AttackerArmyConditionInPercent',
      'GetArmyState', 'get_ArmyState'
    ]) ?? findGetter({ include: ['attacker', 'condition'] })
      ?? findGetter({ include: ['army', 'state'] }));
    const outcomeValue = invokeGetter([
      'get_CombatResult', 'GetCombatResult', 'get_Result', 'GetResult',
      'get_Outcome', 'GetOutcome'
    ]) ?? findGetter({ include: ['combat', 'result'] });
    const resultEnums = this.clientLib()?.root?.Data?.Reports?.ECombatResult
      ?? this.clientLib()?.root?.Data?.Reports?.ECombatResultType ?? {};
    const resultName = typeof outcomeValue === 'string'
      ? outcomeValue
      : Object.entries(resultEnums)
        .find(([, value]) => Number(value) === Number(outcomeValue))?.[0] ?? null;
    const outcome = resultName == null ? null : String(resultName)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const duration = invokeGetter([
      'get_BattleDuration', 'GetBattleDuration', 'get_CombatDuration', 'GetCombatDuration',
      'get_Duration', 'GetDuration'
    ]) ?? findGetter({ include: ['duration'] });
    const timestamp = invokeGetter([
      'get_Time', 'GetTime', 'get_ReportTime', 'GetReportTime',
      'get_Timestamp', 'GetTimestamp', 'get_Date', 'GetDate'
    ]) ?? findGetter({ include: ['time'], exclude: ['duration', 'repair'] });
    return Object.freeze({
      targetState, baseState, defenseState, armyState,
      outcome,
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : null,
      durationSeconds: Number.isFinite(Number(duration))
        ? (Number(duration) > 10000 ? Number(duration) / 1000 : Number(duration)) : null,
      availableGetters: Object.freeze([...getters.keys()].sort())
    });
  }

  enrichSimulationResponse(response, snapshot) {
    if (!response?.d || !Array.isArray(response.e)) return response;
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const placement = root?.Base?.EPlacementType ?? {};
    const movement = root?.Base?.EUnitMovementType ?? {};
    const getMaximum = root?.API?.Util?.GetUnitMaxHealthByLevel;
    const resourceMain = root?.Res?.ResMain?.GetInstance?.();
    const activeModules = values(response.d.dm)
      .map((module) => Number(module?.i ?? module?.Id ?? module))
      .filter(Number.isFinite);
    const hitpointOverride = root?.Base?.EUnitModuleType?.HitpointOverride;
    const patchedUnit = (unit) => {
      if (!unit || hitpointOverride == null || !activeModules.length) return unit;
      const override = values(unit.m).find((module) =>
        Number(module?.t) === Number(hitpointOverride)
        && activeModules.includes(Number(module?.i)));
      return override?.h == null ? unit : { ...unit, lp: override.h };
    };
    const totals = {
      all: [0, 0], structures: [0, 0], defense: [0, 0], offense: [0, 0],
      infantry: [0, 0], vehicle: [0, 0], aircraft: [0, 0]
    };
    const objectives = { cy: null, df: null, dhq: null };
    const addHealth = (bucket, maximum, end) => {
      bucket[0] += maximum;
      bucket[1] += end;
    };
    const pct = ([maximum, end]) => maximum > 0
      ? Math.max(0, Math.min(100, end / maximum * 100)) : 100;
    for (const entry of response.e) {
      const state = entry?.Value ?? entry?.value;
      if (!state) continue;
      const unitId = Number(state.t ?? state.i ?? 0);
      const level = Number(state.l ?? 0);
      const rawUnit = resourceMain?.GetUnit_Obj?.(unitId);
      const unit = patchedUnit(rawUnit);
      if (!unit || typeof getMaximum !== 'function') continue;
      let maximum = 0;
      try { maximum = Number(getMaximum(level, unit, false) ?? 0) * 16; } catch {}
      maximum = Math.max(maximum, Number(state.sh ?? 0), Number(state.h ?? 0));
      const end = Math.max(0, Number(state.h ?? maximum));
      const placementType = Number(rawUnit.pt);
      if (placementType === Number(placement.Structure)) {
        addHealth(totals.structures, maximum, end);
        addHealth(totals.all, maximum, end);
      } else if (placementType === Number(placement.Defense)) {
        addHealth(totals.defense, maximum, end);
        addHealth(totals.all, maximum, end);
      } else if (placementType === Number(placement.Offense)) {
        addHealth(totals.offense, maximum, end);
        const mt = Number(rawUnit.mt);
        if (mt === Number(movement.Feet)) addHealth(totals.infantry, maximum, end);
        else if (mt === Number(movement.Air) || mt === Number(movement.Air2)) addHealth(totals.aircraft, maximum, end);
        else addHealth(totals.vehicle, maximum, end);
      }
      if ([112, 151, 177, 251].includes(unitId)) objectives.cy = end / maximum * 100;
      if ([131, 158, 195].includes(unitId)) objectives.df = end / maximum * 100;
      const techName = Number(root?.Base?.Tech?.GetTechNameFromTechId?.(rawUnit.tl, rawUnit.f));
      if (techName === Number(root?.Base?.ETechName?.Defense_HQ)) objectives.dhq = end / maximum * 100;
    }
    const nativeBattleStats = Object.freeze({
      targetState: pct(totals.all), baseState: pct(totals.structures),
      defenseState: pct(totals.defense), armyState: pct(totals.offense),
      infantryState: pct(totals.infantry), vehicleState: pct(totals.vehicle),
      aircraftState: pct(totals.aircraft), ...objectives
    });
    const getCosts = root?.API?.Util?.GetUnitRepairCosts;
    if (typeof getCosts !== 'function') return { ...response, nativeBattleStats };
    const cities = root?.Data?.MainData?.GetInstance?.()?.get_Cities?.();
    const setCostCity = (cityId) => {
      if (cityId == null || !cities?.set_CurrentCityId) return;
      cities.set_CurrentCityId(cityId);
    };
    const states = new Map(response.e.map((entry) => [entry.Key, entry.Value]));
    const resourceTypes = root?.Base?.EResourceType ?? {};
    const offenseRepairCostsByGroup = { infantry: {}, vehicle: {}, aircraft: {} };
    const offenseRepairTimeByGroup = { infantry: 0, vehicle: 0, aircraft: 0 };
    const attackerModules = values(response.d.am)
      .map((module) => Number(module?.i ?? module?.Id ?? module)).filter(Number.isFinite);
    const patchAttackerUnit = (unit) => {
      if (!unit || hitpointOverride == null || !attackerModules.length) return unit;
      const override = values(unit.m).find((module) =>
        Number(module?.t) === Number(hitpointOverride)
        && attackerModules.includes(Number(module?.i)));
      return override?.h == null ? unit : { ...unit, lp: override.h };
    };
    // TABS evaluates offense costs with the attacker as ClientLib's current
    // city. GetUnitRepairCosts is city-context-sensitive.
    setCostCity(response.d.ai);
    for (const record of response.d.a ?? []) {
      const state = states.get(record.ci) ?? {};
      const rawUnit = resourceMain?.GetUnit_Obj?.(Number(record.i));
      if (!rawUnit) continue;
      let maximum = 0;
      try {
        maximum = Number(getMaximum(Number(record.l), patchAttackerUnit(rawUnit), false) ?? 0) * 16;
      } catch {}
      const start = Math.max(0, Number(record.h ?? 0) * 16);
      const end = Math.max(0, Number(state.h ?? start));
      maximum = Math.max(1, maximum, start);
      const damageRatio = Math.max(0, Math.min(1, (start - end) / maximum));
      if (damageRatio <= 0) continue;
      const mt = Number(rawUnit.mt);
      const group = mt === Number(movement.Feet) ? 'infantry'
        : mt === Number(movement.Air) || mt === Number(movement.Air2) ? 'aircraft' : 'vehicle';
      try {
        for (const cost of values(getCosts(Number(record.l), Number(record.i), damageRatio))) {
          const type = parseInt(cost.Type, 10);
          const amount = Number(cost.Count ?? cost.count ?? cost.c ?? 0);
          offenseRepairCostsByGroup[group][type] =
            (offenseRepairCostsByGroup[group][type] ?? 0) + amount;
          switch (type) {
            case resourceTypes.RepairChargeBase:
            case resourceTypes.RepairChargeInf:
            case resourceTypes.RepairChargeVeh:
            case resourceTypes.RepairChargeAir:
              offenseRepairTimeByGroup[group] += amount;
              break;
            default:
              break;
          }
        }
      } catch {}
    }
    const researchType = resourceTypes.ResearchPoints;
    const structures = response.d.s ?? [];
    const defenders = response.d.d ?? [];
    const entities = [...structures, ...defenders];
    const structureRecords = new Set(structures);
    const normalized = {};
    const details = [];
    const factions = root?.Base?.EFactionType ?? {};
    const playerDefender = Number(response.d.df) === Number(factions.GDIFaction)
      || Number(response.d.df) === Number(factions.NODFaction);
    // TABS switches back to the defender before evaluating destroyed target
    // entities. Without this, ClientLib returns costs for the attacker's city.
    setCostCity(response.d.di);
    for (const record of entities) {
      const state = states.get(record.ci) ?? {};
      const rawUnit = resourceMain?.GetUnit_Obj?.(Number(record.i));
      let calculatedMaximum = 0;
      try {
        calculatedMaximum = Math.floor(Number(getMaximum(
          Number(record.l), patchedUnit(rawUnit), playerDefender
        )) || 0) * 16;
      } catch {}
      // This is the exact TABS split: player-owned structures use the
      // simulator event's h/mh; every NPC entity and every defense unit uses
      // the command payload's h*16 and GetUnitMaxHealthByLevel(...)*16.
      const playerStructure = playerDefender && structureRecords.has(record);
      const start = Math.max(0, playerStructure
        ? Number(state.h ?? 0)
        : Number(record.h ?? 0) * 16);
      const end = Math.max(0, Number(state.h ?? start));
      const maximum = Math.max(1,
        playerStructure ? Number(state.mh ?? 0) : calculatedMaximum,
        start);
      const damageRatio = Math.max(0, Math.min(1, (start - end) / maximum));
      if (damageRatio <= 0) continue;
      const attackCounter = Math.max(0, Number(record.ac ?? 0));
      const decay = Math.pow(0.7, attackCounter);
      const resources = {};
      try {
        for (const cost of values(getCosts(
          Number(record.l ?? 0), Number(record.i), damageRatio
        ))) {
          const type = parseInt(cost.Type, 10);
          switch (type) {
            case resourceTypes.Tiberium:
            case resourceTypes.Crystal:
            case resourceTypes.Gold:
            case resourceTypes.ResearchPoints: {
              let amount = Number(cost.Count ?? 0) * decay;
              // TABS uniquely applies the entity damage ratio a second time
              // to Research Points after attack-counter decay.
              if (type === researchType && amount > 0) {
                amount = Math.max(1, Math.floor(amount * damageRatio));
              }
              resources[type] = amount;
              normalized[type] = (normalized[type] ?? 0) + amount;
              break;
            }
            default:
              break;
          }
        }
      } catch (error) {
        this.logger?.debug?.('Unable to interpret simulated entity loot.', {
          unitId: record.i, error: error?.message ?? String(error)
        });
      }
      details.push(Object.freeze({
        id: Number(record.i ?? 0), level: Number(record.l ?? 0),
        start, end, maximum, damageRatio, attackCounter, decay,
        resources: Object.freeze(resources)
      }));
    }
    return {
      ...response,
      nativeBattleStats,
      nativeOffenseRepair: Object.freeze({
        timeByGroup: Object.freeze(offenseRepairTimeByGroup),
        costsByGroup: Object.freeze(Object.fromEntries(Object.entries(offenseRepairCostsByGroup)
          .map(([group, costs]) => [group, Object.freeze(costs)])))
      }),
      nativeEntityLoot: Object.keys(normalized).length ? Object.freeze(normalized) : null,
      nativeEntityDetails: Object.freeze(details)
    };
  }

  playSimulation(response) {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !response?.d) {
      throw new Error('No native simulation is available to replay.');
    }
    this.lastCombatTargetId = snapshot.target.id;
    const clientLib = this.clientLib()?.root ?? globalThis.ClientLib;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    const playArea = app?.getPlayArea?.();
    const mode = clientLib?.Data?.PlayerAreaViewMode?.pavmCombatReplay;
    const battleground = clientLib?.Vis?.VisMain?.GetInstance?.()?.get_Battleground?.();
    let loadCombat = battleground?.LoadCombatDirect;
    if (typeof loadCombat !== 'function') {
      try {
        const apiPrototype = clientLib?.API?.Battleground?.prototype;
        const simulateSource = apiPrototype?.SimulateBattle?.toString?.() ?? '';
        const callbackName = simulateSource.match(/\{battleSetup:[a-z]+\},\s?\(new \$I\.[A-Z]{6}\)\.[A-Z]{6}\(this,this\.([A-Z]{6})\),\s?this\)/)?.[1];
        const callbackSource = callbackName ? apiPrototype?.[callbackName]?.toString?.() ?? '' : '';
        const loaderName = callbackSource.match(/\$I\.[A-Z]{6}\.[A-Z]{6}\(\)\.[A-Z]{6}\(\)\.([A-Z]{6})\([a-z]\.d\)/)?.[1];
        if (loaderName && typeof battleground?.[loaderName] === 'function') {
          loadCombat = battleground[loaderName];
        }
      } catch {
        // A clearer error is reported below when this game build cannot be resolved.
      }
    }
    if (!playArea?.setView || mode == null || typeof loadCombat !== 'function') {
      throw new Error('The native combat replay viewer is unavailable.');
    }
    playArea.setView(mode, snapshot.target.id, 0, 0);
    this.ensureReplayReturnControl();
    battleground.Init?.();
    loadCombat.call(battleground, response.d);
    const start = () => {
      this.ensureReplayReturnControl();
      battleground.RestartReplay?.();
      battleground.set_ReplaySpeed?.(1);
    };
    if (globalThis.qx?.event?.Timer?.once) {
      globalThis.qx.event.Timer.once(start, this, 0);
    } else {
      setTimeout(start, 0);
    }
    return response;
  }

  ensureReplayReturnControl() {
    const qx = globalThis.qx;
    const app = qx?.core?.Init?.getApplication?.();
    const overlay = app?.getReportReplayOverlay?.();
    if (!qx || !overlay?.add) return false;
    const existing = overlay.getUserData?.('cnc-ta-suite-return-control');
    if (existing && !existing.isDisposed?.()) return true;
    const Button = globalThis.webfrontend?.ui?.SoundButton ?? qx.ui.form.Button;
    const button = new Button(null, 'FactionUI/icons/icon_return.png').set({
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      height: 48,
      minHeight: 48,
      maxHeight: 48,
      show: 'icon',
      appearance: 'button-friendlist-scroll',
      toolTipText: app.tr?.('tnf:tt replay back button') ?? 'Return to Attack Setup'
    });
    button.addListener('execute', () => {
      try { this.openCombatSetup(); }
      catch (error) {
        this.context?.logger?.warn?.('Could not return to attack setup.', error);
        this.context?.notifications?.show?.(`Could not return to attack setup: ${error?.message ?? error}`, { level: 'error' });
      }
    });
    overlay.add(button, { top: 11, left: 346 });
    overlay.setUserData?.('cnc-ta-suite-return-control', button);
    return true;
  }

  captureFormation() {
    const snapshot = this.snapshot();
    if (!snapshot.attacker?.id || !snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    return Object.freeze({
      attackerId: snapshot.attacker.id,
      attackerName: snapshot.attacker.name,
      target: Object.freeze({ id: snapshot.target.id, name: snapshot.target.name,
        x: snapshot.target.x, y: snapshot.target.y, version: snapshot.target.version }),
      units: Object.freeze(snapshot.units.map((unit) => Object.freeze({
        entityId: unit.entityId,
        mdbId: unit.id,
        name: unit.name,
        level: unit.level,
        x: unit.x,
        y: unit.y,
        enabled: unit.enabled !== false
        , transporterId: unit.transporterId ?? null
        , garrisonId: unit.garrisonId ?? null
      })))
    });
  }

  applyFormation(preset) {
    const snapshot = this.snapshot();
    if (!snapshot.attacker?.id || !snapshot.target?.id) {
      throw new Error('Open a target attack screen before loading a formation.');
    }
    if (String(preset?.attackerId) !== String(snapshot.attacker.id)) {
      throw new Error(`This formation belongs to ${preset?.attackerName || 'another attacking base'}.`);
    }
    if (preset?.target?.id == null || String(preset.target.id) !== String(snapshot.target.id)) {
      throw new Error(`This formation belongs to ${preset?.target?.name || 'another target'}.`);
    }
    const signature = (units, idKey) => units
      .map((unit) => `${unit[idKey]}:${Number(unit.level || 0)}`)
      .sort()
      .join('|');
    if (signature(preset.units ?? [], 'mdbId') !== signature(snapshot.units, 'id')) {
      throw new Error('The current offensive army does not match this saved formation.');
    }

    const main = this.mainData();
    const cities = call(main, ['get_Cities']);
    const ownCity = call(cities, ['get_CurrentOwnCity']);
    const manager = call(ownCity, ['get_CityArmyFormationsManager']);
    const formation = call(manager, ['GetFormationByTargetBaseId'], snapshot.target.id);
    const rawUnits = values(call(formation, ['get_ArmyUnits']));
    const byEntityId = new Map(rawUnits.map((unit) => [String(call(unit, ['get_Id'])), unit]));
    const used = new Set();
    let enabledStateChanged = false;

    for (const saved of preset.units) {
      let unit = byEntityId.get(String(saved.entityId));
      if (!unit) {
        unit = rawUnits.find((candidate) =>
          !used.has(candidate)
          && Number(call(candidate, ['get_MdbUnitId', 'get_MdbId'])) === Number(saved.mdbId)
          && Number(call(candidate, ['get_CurrentLevel', 'get_Level'])) === Number(saved.level)
        );
      }
      if (!unit) throw new Error(`Could not match saved unit ${saved.name || saved.mdbId}.`);
      used.add(unit);
      const currentX = Number(call(unit, ['get_CoordX', 'get_X']) ?? 0);
      const currentY = Number(call(unit, ['get_CoordY', 'get_Y']) ?? 0);
      const occupant = call(formation, ['GetUnitByCoord'], saved.x, saved.y);
      if (occupant && occupant !== unit) {
        if (typeof occupant.MoveBattleUnit !== 'function') {
          throw new Error(`The game cannot swap the unit occupying ${saved.x + 1}:${saved.y + 1}.`);
        }
        occupant.MoveBattleUnit(currentX, currentY);
      }
      const desiredEnabled = saved.enabled !== false;
      const previousEnabled = Boolean(call(unit, ['get_Enabled']) ?? true);
      call(unit, ['set_Enabled'], desiredEnabled);
      enabledStateChanged ||= previousEnabled !== desiredEnabled;
      const alreadyThere = currentX === Number(saved.x) && currentY === Number(saved.y);
      const canMove = call(unit, ['CanMoveBattleUnit'], saved.x, saved.y);
      if (!alreadyThere && canMove === false) {
        throw new Error(`The game rejected the move for ${saved.name || saved.mdbId} to ${saved.x + 1}:${saved.y + 1}.`);
      }
      if (!alreadyThere) {
        if (typeof unit.MoveBattleUnit !== 'function') {
          throw new Error(`Movement is unavailable for ${saved.name || saved.mdbId}.`);
        }
        unit.MoveBattleUnit(saved.x, saved.y);
      }
    }
    if (enabledStateChanged) this.refreshFormationPresentation(formation, rawUnits);
    return this.snapshot();
  }

  refreshFormationPresentation(formation, rawUnits = []) {
    // Enabled state changes affect attack validity immediately, but this EA UI
    // build does not repaint formation sprites until an ArmyChanged-style
    // movement notification occurs. Prefer named refresh hooks when available,
    // then issue a harmless same-cell move to produce the native notification.
    for (const method of ['RefreshData', 'Refresh', 'Update', 'NotifyArmyChanged']) {
      try {
        if (typeof formation?.[method] === 'function') {
          formation[method]();
          break;
        }
      } catch {
        // Continue to the native movement notification fallback.
      }
    }
    const notifier = rawUnits.find((unit) => typeof unit?.MoveBattleUnit === 'function');
    if (notifier) {
      const x = Number(call(notifier, ['get_CoordX', 'get_X']) ?? 0);
      const y = Number(call(notifier, ['get_CoordY', 'get_Y']) ?? 0);
      try { notifier.MoveBattleUnit(x, y); } catch { /* The setup bar refresh below remains available. */ }
    }
    try {
      const app = globalThis.qx?.core?.Init?.getApplication?.();
      app?.getArmySetupAttackBar?.()?.showSetup?.(true);
    } catch {
      // Some client builds repaint entirely from the movement notification.
    }
  }

  applyRecommendedFormation(units) {
    const snapshot = this.snapshot();
    if (!snapshot.attacker?.id || !snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    if (!Array.isArray(units) || units.length !== snapshot.units.length) {
      throw new Error('The recommendation does not match the active offensive army.');
    }
    return this.applyFormation({
      attackerId: snapshot.attacker.id,
      attackerName: snapshot.attacker.name,
      target: {
        id: snapshot.target.id,
        name: snapshot.target.name,
        x: snapshot.target.x,
        y: snapshot.target.y,
        version: snapshot.target.version
      },
      units: units.map((unit) => ({
        entityId: unit.entityId,
        mdbId: unit.id ?? unit.mdbId,
        name: unit.name,
        level: unit.level,
        x: unit.x,
        y: unit.y,
        enabled: unit.enabled !== false
      }))
    });
  }

  transformActiveFormation(operation) {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    const height = 4, width = 9;
    const grid = Array.from({ length: height }, () => Array(width).fill(null));
    for (const unit of snapshot.units) {
      const x = Number(unit.x), y = Number(unit.y);
      if (grid[y]?.[x] !== undefined) grid[y][x] = { ...unit };
    }
    const next = Array.from({ length: height }, () => Array(width).fill(null));
    const place = (unit, x, y) => { next[y][x] = { ...unit, x, y }; };
    if (/^swap-[123]-[234]$/.test(operation)) {
      const [, first, second] = operation.split('-').map(Number);
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const unit = grid[y][x];
        if (!unit) continue;
        const ny = y === first - 1 ? second - 1 : y === second - 1 ? first - 1 : y;
        place(unit, x, ny);
      }
    } else {
      const shifts = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const unit = grid[y][x];
        if (!unit) continue;
        let nx = x, ny = y;
        if (shifts[operation]) {
          nx = (x + shifts[operation][0] + width) % width;
          ny = (y + shifts[operation][1] + height) % height;
        } else if (operation === 'mirror-horizontal') nx = width - 1 - x;
        else if (operation === 'mirror-vertical') ny = height - 1 - y;
        else throw new Error(`Unknown formation operation: ${operation}`);
        place(unit, nx, ny);
      }
    }
    return this.applyRecommendedFormation(next.flat().filter(Boolean));
  }

  transformFormationSection(operation, index) {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    const width = 9, height = 4;
    const next = snapshot.units.map((unit) => ({ ...unit }));
    for (const unit of next) {
      const x = Number(unit.x), y = Number(unit.y);
      if (operation === 'row-left' && y === index) unit.x = (x + width - 1) % width;
      else if (operation === 'row-right' && y === index) unit.x = (x + 1) % width;
      else if (operation === 'mirror-row' && y === index) unit.x = width - 1 - x;
      else if (operation === 'column-up' && x === index) unit.y = (y + height - 1) % height;
      else if (operation === 'column-down' && x === index) unit.y = (y + 1) % height;
      else if (operation === 'mirror-column' && x === index) unit.y = height - 1 - y;
    }
    return this.applyRecommendedFormation(next);
  }

  formationUnitCategory(unit) {
    const root = this.clientLib()?.root ?? {};
    const movementTypes = root?.Base?.EUnitMovementType ?? root?.Data?.EUnitMovementType ?? {};
    const movement = Number(unit?.movementType);
    if ([movementTypes.Air, movementTypes.Air2].some((value) => value != null && Number(value) === movement)) return 'aircraft';
    if (movementTypes.Feet != null && Number(movementTypes.Feet) === movement) return 'infantry';
    if ([movementTypes.Wheel, movementTypes.Track].some((value) => value != null && Number(value) === movement)) return 'vehicles';
    const movementName = Object.entries(movementTypes)
      .find(([, value]) => Number(value) === movement)?.[0] ?? '';
    const description = `${movementName} ${unit?.name ?? ''}`.toLowerCase();
    if (/air|aircraft|plane|helicopter|jet/.test(description)) return 'aircraft';
    if (/foot|infantry|soldier/.test(description)) return 'infantry';
    return 'vehicles';
  }

  toggleFormationVisibility(scope = 'all') {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    const selected = scope === 'all'
      ? snapshot.units
      : snapshot.units.filter((unit) => this.formationUnitCategory(unit) === scope);
    if (!selected.length) throw new Error(`No ${scope} troops are present in this formation.`);
    const enabled = selected.every((unit) => unit.enabled === false);
    const selectedIds = new Set(selected.map((unit) => String(unit.entityId)));
    return this.applyRecommendedFormation(snapshot.units.map((unit) => ({
      ...unit,
      enabled: selectedIds.has(String(unit.entityId)) ? enabled : unit.enabled !== false
    })));
  }

  selectedFormationUnitToken() {
    const selection = this.hub?.game?.services?.tryGet?.('selection')?.current?.()
      ?? this.context?.game?.services?.tryGet?.('selection')?.current?.();
    if (!selection) return null;
    const candidates = [
      selection,
      call(selection, ['get_Unit', 'get_Entity', 'get_Data', 'get_ArmyUnit']),
      selection.unit,
      selection.entity,
      selection.data
    ].filter(Boolean);
    const snapshot = this.snapshot();
    for (const candidate of candidates) {
      const id = call(candidate, ['get_Id', 'get_UnitId', 'get_EntityId']);
      if (id != null && snapshot.units.some((unit) => String(unit.entityId) === String(id))) return `id:${id}`;
      const x = call(candidate, ['get_CoordX', 'get_X']);
      const y = call(candidate, ['get_CoordY', 'get_Y']);
      if (x != null && y != null && snapshot.units.some((unit) => Number(unit.x) === Number(x) && Number(unit.y) === Number(y))) {
        return `xy:${Number(x)}:${Number(y)}`;
      }
    }
    return null;
  }

  toggleFormationUnit(token) {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    const match = (unit) => token?.startsWith('id:')
      ? String(unit.entityId) === token.slice(3)
      : token === `xy:${Number(unit.x)}:${Number(unit.y)}`;
    if (!snapshot.units.some(match)) throw new Error('The selected object is not an offensive formation troop.');
    return this.applyRecommendedFormation(snapshot.units.map((unit) => ({
      ...unit,
      enabled: match(unit) ? unit.enabled === false : unit.enabled !== false
    })));
  }

  findAttackSetupControl(objectId) {
    const bar = globalThis.qx?.core?.Init?.getApplication?.()?.getArmySetupAttackBar?.();
    if (!bar) return null;
    const seen = new Set();
    // The native bar stores named controls directly on the instance in
    // obfuscated builds. Inspect that shallow surface first, then only walk
    // Qooxdoo child widgets; never traverse the entire cyclic application.
    const queue = [bar, ...Object.values(bar).filter((value) => value && typeof value === 'object')];
    while (queue.length) {
      const candidate = queue.shift();
      if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function') || seen.has(candidate)) continue;
      seen.add(candidate);
      if (candidate.objid === objectId || candidate.getUserData?.('objid') === objectId) return candidate;
      try { queue.push(...(candidate.getChildren?.() ?? [])); } catch { /* Continue through object properties. */ }
    }
    return null;
  }

  toggleNativeSingleDisableMode() {
    const control = this.findAttackSetupControl('btn_disable');
    if (!control) return false;
    if (typeof control.execute === 'function') control.execute();
    else if (typeof control.fireEvent === 'function') control.fireEvent('execute');
    else return false;
    return true;
  }

  refreshCombatReports(limit = 100, category = 'offense') {
    if (this.reportRefreshPromises.has(category)) return this.reportRefreshPromises.get(category);
    const queued = this.reportRefreshQueue.catch(() => {}).then(() => this.loadCombatReports(limit, category));
    this.reportRefreshQueue = queued.catch(() => {});
    const tracked = queued.finally(() => { this.reportRefreshPromises.delete(category); });
    this.reportRefreshPromises.set(category, tracked);
    return tracked;
  }

  loadCombatReports(limit = 100, category = 'offense') {
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const manager = call(this.mainData(), ['get_Reports', 'get_ReportData']);
    const communication = root?.Net?.CommunicationManager?.GetInstance?.();
    const delegateFactory = globalThis.webfrontend?.phe?.cnc?.Util?.createEventDelegate;
    const reportTypes = root?.Data?.Reports?.EPlayerReportType ?? {};
    const knownReportTypes = new Set([reportTypes.CombatOffense, reportTypes.CombatDefense, reportTypes.NPCPlayerCombat]
      .filter((value) => typeof value === 'number'));
    const inferredOtherType = Object.entries(reportTypes).find(([name, value]) =>
      !/^\d+$/.test(name) && typeof value === 'number' && !knownReportTypes.has(value)
      && !/^(?:None|Count|Max|Invalid|Undefined)$/i.test(name)
    )?.[1];
    const playerReportType = ({
      offense: reportTypes.CombatOffense,
      defense: reportTypes.CombatDefense,
      forgotten: reportTypes.NPCPlayerCombat,
      others: reportTypes.Others ?? reportTypes.Other ?? reportTypes.CombatOther ?? inferredOtherType
    })[category];
    if (!manager?.RequestReportHeaderDataAll || !manager?.RequestReportData
      || !communication?.SendSimpleCommand || !delegateFactory || playerReportType == null) {
      this.reportCache = this.reportCache ?? [];
      return Promise.resolve(this.getCombatReports(category));
    }
    const refreshPromise = new Promise((resolve, reject) => {
      let cleanupActive = () => {};
      const finish = (reports) => {
        this.reportCache = reports.filter(Boolean);
        this.reportCacheCategory = category;
        this.reportCaches.set(category, this.reportCache);
        resolve(this.normalizeCombatReports(this.reportCache, category));
      };
      const failTimer = setTimeout(() => {
        cleanupActive();
        if (this.reportCaches.get(category)?.length) resolve(this.normalizeCombatReports(this.reportCaches.get(category), category));
        else reject(new Error('Native report loading timed out.'));
      }, 20000);
      const countReceiver = {
        done: (_status, response) => {
          const count = Math.min(Math.max(0, Number(response ?? _status) || 0), Math.max(1, Number(limit) || 100));
          if (!count) {
            clearTimeout(failTimer);
            finish([]);
            return;
          }
          const headersReceiver = {
            done: (payload) => {
              const headers = values(payload);
              if (!headers.length) {
                clearTimeout(failTimer);
                finish([]);
                return;
              }
              const byId = new Map(headers.map((header) => [String(call(header, ['get_Id', 'get_ReportId']) ?? header?.Id), header]));
              const delivered = [];
              let settleTimer = null;
              let completed = false;
              const cleanup = () => {
                clearTimeout(settleTimer);
                try { manager.remove_ReportDelivered?.(reportDelegate); } catch {}
              };
              cleanupActive = cleanup;
              const complete = () => {
                if (completed) return;
                completed = true;
                cleanup();
                clearTimeout(failTimer);
                finish(delivered.length ? delivered : headers);
              };
              const reportReceiver = {
                done: (report) => {
                  if (!report) return;
                  const id = String(call(report, ['get_Id', 'get_ReportId']) ?? report?.Id);
                  if (!byId.has(id)) return;
                  delivered.push(report);
                  byId.delete(id);
                  if (!byId.size) complete();
                }
              };
              const reportDelegate = delegateFactory(root.Data.Reports.ReportDelivered, reportReceiver, reportReceiver.done);
              manager.add_ReportDelivered?.(reportDelegate);
              for (const header of headers) {
                const id = call(header, ['get_Id', 'get_ReportId']) ?? header?.Id;
                if (id != null) manager.RequestReportData(id);
              }
              if (!completed) settleTimer = setTimeout(complete, 10000);
            }
          };
          const headersDelegate = delegateFactory(root.Data.Reports.ReportsDelivered, headersReceiver, (payload) => {
            try { manager.remove_ReportsDelivered?.(headersDelegate); } catch {}
            headersReceiver.done(payload);
          });
          cleanupActive = () => {
            try { manager.remove_ReportsDelivered?.(headersDelegate); } catch {}
          };
          manager.add_ReportsDelivered?.(headersDelegate);
          manager.RequestReportHeaderDataAll(playerReportType, 0, count, root.Data.Reports.ESortColumn?.Time ?? 0, true);
        }
      };
      communication.SendSimpleCommand('GetReportCount', { playerReportType },
        delegateFactory(root.Net.CommandResult, countReceiver, countReceiver.done), null);
    });
    return refreshPromise;
  }

  normalizeCombatReports(rawReports, category = 'offense') {
    const resourceTypes = this.clientLib()?.root?.Base?.EResourceType ?? {};
    const resourceNames = Object.fromEntries(Object.entries(resourceTypes)
      .filter(([, type]) => typeof type === 'number').map(([name, type]) => [String(type), name === 'Gold' ? 'Credits' : name]));
    const number = (target, names, fallback = 0) => Number(call(target, names) ?? fallback ?? 0);
    return rawReports.map((raw) => {
      const nativeLoot = call(raw, ['get_Loot']) ?? raw?.Loot;
      const lootEntries = nativeLoot != null
        ? values(nativeLoot)
        : [...values(raw?.d?.arp), ...values(raw?.d?.arr)];
      const loot = lootEntries.reduce((result, item) => {
        result[item.Type ?? item.type ?? item.t] = Number(item.Count ?? item.count ?? item.a ?? 0); return result;
      }, { ...((nativeLoot && !Array.isArray(nativeLoot)) ? nativeLoot : {}) });
      if (!Object.keys(loot).length && typeof raw?.GetAttackerTotalResourceReceived === 'function') {
        for (const type of Object.values(resourceTypes).filter((value) => typeof value === 'number')) {
          const amount = Number(raw.GetAttackerTotalResourceReceived(type) ?? 0);
          if (amount) loot[type] = amount;
        }
      }
      const attackerName = call(raw, ['get_AttackerBaseName', 'get_AttackerName']) ?? raw?.AttackerBaseName ?? raw?.AttackerName ?? '';
      const defenderName = call(raw, ['get_DefenderBaseName', 'get_DefenderName']) ?? raw?.DefenderBaseName ?? raw?.DefenderName ?? '';
      const reportType = call(raw, ['get_ReportType', 'get_Type']) ?? raw?.Type;
      const npcReportType = this.clientLib()?.root?.Data?.Reports?.EReportType?.NPCPlayerCombat;
      const npc = Boolean(call(raw, ['get_AttackerIsNPC', 'get_DefenderIsNPC', 'get_IsNPC'])
        ?? raw?.AttackerIsNPC ?? raw?.DefenderIsNPC
        ?? (npcReportType != null && Number(reportType) === Number(npcReportType)))
        || /forgotten|camp|outpost/i.test(`${attackerName} ${defenderName}`);
      const combatResult = call(raw, ['get_CombatResult', 'get_Result', 'get_BattleResult'])
        ?? raw?.CombatResult ?? raw?.Result ?? raw?.cr ?? raw?.d?.cr;
      const resultEnums = this.clientLib()?.root?.Data?.Reports?.ECombatResult
        ?? this.clientLib()?.root?.Data?.Reports?.ECombatResultType ?? {};
      const resultName = Object.entries(resultEnums).find(([, value]) => Number(value) === Number(combatResult))?.[0] ?? '';
      const explicitWon = call(raw, ['get_Won', 'get_IsVictory', 'get_AttackerWon']) ?? raw?.Won;
      const targetX = number(raw, ['get_DefenderBaseX', 'get_TargetX', 'get_PosX'], raw?.TargetX ?? raw?.d?.dpx ?? raw?.d?.x);
      const targetY = number(raw, ['get_DefenderBaseY', 'get_TargetY', 'get_PosY'], raw?.TargetY ?? raw?.d?.dpy ?? raw?.d?.y);
      const attackerBaseId = call(raw, ['get_AttackerBaseId', 'get_OwnBaseId']) ?? raw?.AttackerBaseId ?? raw?.d?.abi;
      const defenderBaseId = call(raw, ['get_DefenderBaseId', 'get_TargetBaseId']) ?? raw?.DefenderBaseId ?? raw?.d?.dbi;
      let cp = number(raw, [
        'get_CommandPointCost', 'get_CommandPointCosts', 'get_AttackCommandPointCost', 'get_CPCost'
      ], raw?.Cost ?? raw?.CommandPointCost ?? raw?.d?.cpc ?? raw?.d?.cp);
      if (!cp && targetX && targetY && attackerBaseId != null) {
        const cities = call(this.mainData(), ['get_Cities']);
        const attacker = call(cities, ['GetCity', 'get_City'], attackerBaseId);
        cp = Number(call(attacker, ['CalculateAttackCommandPointCostToCoord'], targetX, targetY) ?? 0);
      }
      const attackerWon = explicitWon != null ? Boolean(explicitWon)
        : /victory|win|success|destroyed|total.?defeat/i.test(resultName)
          || (combatResult != null && resultName === '' && Number(combatResult) > 0)
          || ((category === 'offense' || category === 'others') && Object.values(loot).some((amount) => Number(amount) > 0));
      const isDefenseFolder = category === 'defense' || category === 'forgotten';
      const destroyed = Boolean(call(raw, ['get_Destroyed', 'get_IsDestroyed']) ?? raw?.Destroyed);
      // CombatResult/get_AttackerWon describe the attacking side. In both
      // native defense folders the Suite player owns the defending base, so
      // the player's outcome is always the inverse. Total Defeat is included
      // in attackerWon above and therefore remains a defensive loss.
      const won = isDefenseFolder ? !attackerWon : attackerWon;
      return Object.freeze({
        id: call(raw, ['get_Id', 'get_ReportId']) ?? raw?.Id ?? raw?.i,
        at: number(raw, ['get_Time', 'get_Timestamp'], raw?.Timestamp ?? raw?.d?.t),
        type: call(raw, ['get_TypeName', 'get_ReportType', 'get_Type']) ?? raw?.TypeName ?? raw?.Type ?? 'Combat',
        ownBase: call(raw, ['get_CityName']) ?? raw?.CityName
          ?? (isDefenseFolder ? defenderName : attackerName) ?? 'Unknown base',
        target: call(raw, ['get_OpponentName', 'get_TargetName']) ?? raw?.TargetName
          ?? (isDefenseFolder ? attackerName : defenderName) ?? 'Unknown target',
        attackerName,
        defenderName,
        npc,
        won,
        resultName,
        destroyed,
        cp,
        targetX,
        targetY,
        attackerBaseId,
        defenderBaseId,
        repairSeconds: number(raw, ['get_RepairTime', 'GetAttackerMaxRepairTime'], raw?.RepairTime),
        category,
        loot: Object.freeze(loot),
        lootLabels: Object.freeze(Object.fromEntries(Object.keys(loot)
          .map((type) => [type, resourceNames[String(type)] ?? `Resource ${type}`]))),
        raw
      });
    }).filter((report) => report.id != null || report.at > 0)
      .sort((left, right) => right.at - left.at);
  }

  getCombatReports(category = this.reportCacheCategory ?? 'offense') {
    const manager = call(this.mainData(), ['get_Reports', 'get_ReportData']);
    const categoryCache = this.reportCaches.get(category);
    const sameCategoryCache = this.reportCacheCategory === category ? this.reportCache : null;
    const rawReports = categoryCache ?? sameCategoryCache
      ?? (this.reportCaches.size ? [] : values(call(manager, ['get_AllReports', 'get_Reports', 'get_ReportHeaders']) ?? manager));
    return this.normalizeCombatReports(rawReports, category);
  }

  async refreshAllCombatReports(limit = 100) {
    const result = [];
    for (const category of ['offense', 'defense', 'forgotten', 'others']) {
      try {
        await this.refreshCombatReports(limit, category);
        result.push(...this.getCombatReports(category));
      } catch (error) {
        this.context?.logger?.debug?.(`Unable to load ${category} combat reports.`, error);
      }
    }
    const deduplicated = new Map(result.map((report) => [`${report.category}:${report.id ?? report.at}`, report]));
    this.combatStatisticsReports = Object.freeze([...deduplicated.values()]);
    return this.combatStatisticsReports;
  }

  getAllCombatReports() {
    return this.combatStatisticsReports;
  }

  reportValueContainsId(value, id, depth = 0, seen = new Set()) {
    if (value == null || depth > 3) return false;
    if (String(value) === String(id)) return true;
    if ((typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return false;
    seen.add(value);
    const direct = call(value, ['get_Id', 'get_ReportId']) ?? value.Id ?? value.ReportId ?? value.i;
    if (direct != null && String(direct) === String(id)) return true;
    let nested = [];
    try { nested = Array.isArray(value) ? value : Object.values(value); } catch { return false; }
    return nested.some((item) => this.reportValueContainsId(item, id, depth + 1, seen));
  }

  reportUiObjects(root) {
    const found = [];
    const queue = [root];
    const seen = new Set();
    while (queue.length && found.length < 500) {
      const item = queue.shift();
      if (!item || (typeof item !== 'object' && typeof item !== 'function') || seen.has(item)) continue;
      seen.add(item);
      found.push(item);
      try { queue.push(...(item.getChildren?.() ?? [])); } catch {}
      try {
        for (const value of Object.values(item)) {
          if (value && (typeof value === 'object' || typeof value === 'function')) queue.push(value);
        }
      } catch {}
    }
    return found;
  }

  invokeNativeReportRow(overlay, report) {
    const objects = this.reportUiObjects(overlay);
    const id = report.id;
    for (const table of objects) {
      const model = call(table, ['getTableModel']);
      const rowCount = Number(call(model, ['getRowCount']) ?? 0);
      if (!model || !Number.isFinite(rowCount) || rowCount < 1) continue;
      let row = -1;
      for (let index = 0; index < rowCount; index += 1) {
        const rowData = call(model, ['getRowData'], index);
        if (this.reportValueContainsId(rowData, id)) { row = index; break; }
      }
      if (row < 0) continue;
      try { table.getSelectionModel?.()?.setSelectionInterval?.(row, row); } catch {}
      try { table.setFocusedCell?.(0, row, true); } catch {}
      const event = Object.freeze({
        getRow: () => row,
        getColumn: () => 0,
        getTarget: () => table,
        getCurrentTarget: () => table,
        getData: () => ({ row, column: 0 }),
        stop: () => {}, preventDefault: () => {}, stopPropagation: () => {}
      });
      for (const owner of objects) {
        const sources = [owner, Object.getPrototypeOf(owner)].filter(Boolean);
        const handlers = [];
        for (const source of sources) {
          for (const name of Object.getOwnPropertyNames(source)) {
            if (name === 'constructor' || typeof owner?.[name] !== 'function') continue;
            let body = '';
            try { body = Function.prototype.toString.call(owner[name]); } catch { continue; }
            if (!/getRow\(|getTableModel\(/.test(body)
              || !/RequestReportData|Report|report/.test(body)) continue;
            handlers.push({ name, priority: /RequestReportData/.test(body) ? 0 : /ReportDelivered/.test(body) ? 1 : 2 });
          }
        }
        handlers.sort((left, right) => left.priority - right.priority);
        for (const handler of handlers) {
          try { owner[handler.name](event); return true; } catch {}
        }
      }
    }
    // Some report folders hand the fully delivered model directly to a detail
    // handler rather than going through a visible table row.
    const raw = report.raw ?? report;
    for (const owner of objects) {
      for (const source of [owner, Object.getPrototypeOf(owner)].filter(Boolean)) {
        for (const name of Object.getOwnPropertyNames(source)) {
          if (name === 'constructor' || typeof owner?.[name] !== 'function') continue;
          let body = '';
          try { body = Function.prototype.toString.call(owner[name]); } catch { continue; }
          if (!/get_ReportType|get_ReportId/.test(body) || !/Report|report/.test(body)) continue;
          try { owner[name](raw); return true; } catch {}
        }
      }
    }
    return false;
  }

  async playCombatReport(report) {
    if (!report) throw new Error('Select a raid report first.');
    const raw = report.raw ?? report;
    const payload = call(raw, ['get_CombatData', 'get_BattleData', 'get_ReplayData', 'GetCombatData', 'get_Data'])
      ?? raw?.combat ?? raw?.CombatData ?? raw?.ReplayData ?? raw?.d?.combat;
    const combatData = payload?.d ?? payload;
    const targetId = report.defenderBaseId
      ?? call(raw, ['get_DefenderBaseId', 'get_TargetBaseId']) ?? raw?.DefenderBaseId ?? raw?.d?.dbi;
    if (!combatData || targetId == null) {
      await this.openCombatReport(report);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
        const raidRoots = Object.values(registry).filter((widget) => {
          const name = String(widget?.classname ?? widget?.constructor?.classname ?? '');
          const caption = String(widget?.getCaption?.() ?? widget?.getLabel?.() ?? '');
          return /RaidReport|Raid Report/i.test(`${name} ${caption}`) && widget?.isVisible?.() !== false;
        });
        for (const raidRoot of raidRoots) {
          const replay = this.reportUiObjects(raidRoot).find((widget) => {
            const label = String(widget?.getLabel?.() ?? widget?.getToolTipText?.() ?? '');
            const icon = String(widget?.getIcon?.() ?? '');
            return /replay|watch battle|play battle/i.test(`${label} ${icon}`)
              && (typeof widget?.execute === 'function' || typeof widget?.fireEvent === 'function');
          });
          if (!replay) continue;
          if (typeof replay.execute === 'function') replay.execute();
          else replay.fireEvent?.('execute');
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new Error('The native Raid Report opened, but its Replay control was not available.');
    }
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    const battleground = root?.Vis?.VisMain?.GetInstance?.()?.get_Battleground?.();
    const mode = root?.Data?.PlayerAreaViewMode?.pavmCombatReplay;
    let load = battleground?.LoadCombatDirect;
    if (typeof load !== 'function') {
      const prototype = root?.API?.Battleground?.prototype;
      const simulateSource = prototype?.SimulateBattle?.toString?.() ?? '';
      const callbackName = simulateSource.match(/\{battleSetup:[a-z]+\},\s?\(new \$I\.[A-Z]{6}\)\.[A-Z]{6}\(this,this\.([A-Z]{6})\),\s?this\)/)?.[1];
      const callbackSource = callbackName ? prototype?.[callbackName]?.toString?.() ?? '' : '';
      const loaderName = callbackSource.match(/\$I\.[A-Z]{6}\.[A-Z]{6}\(\)\.[A-Z]{6}\(\)\.([A-Z]{6})\([a-z]\.d\)/)?.[1];
      if (loaderName && typeof battleground?.[loaderName] === 'function') load = battleground[loaderName];
    }
    if (mode == null || !app?.getPlayArea?.()?.setView || typeof load !== 'function') {
      throw new Error('The visual raid replay panel is unavailable in this game build.');
    }
    app.getPlayArea().setView(mode, targetId, 0, 0);
    battleground.Init?.();
    load.call(battleground, combatData);
    globalThis.qx?.event?.Timer?.once?.(() => {
      battleground.RestartReplay?.();
      battleground.set_ReplaySpeed?.(1);
    }, this, 0);
    return true;
  }

  async openCombatReport(report) {
    if (!report) throw new Error('Select a combat report first.');
    const id = report.id;
    const raw = report.raw ?? report;
    const manager = call(this.mainData(), ['get_Reports', 'get_ReportData']);
    call(manager, ['RequestReportData'], id);
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    let nativeReportsOverlay = null;
    try { nativeReportsOverlay = globalThis.webfrontend?.gui?.reports?.ReportsOverlay?.getInstance?.(); } catch {}
    const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const combat = call(raw, ['get_CombatData', 'get_BattleData', 'get_ReplayData', 'GetCombatData', 'get_Data'])
      ?? raw?.combat ?? raw?.CombatData ?? raw?.d;
    const combatData = combat?.d ?? combat;
    const targetId = call(raw, ['get_DefenderBaseId', 'get_TargetBaseId']) ?? raw?.DefenderBaseId;
    if (combatData && targetId != null) {
      const app = globalThis.qx?.core?.Init?.getApplication?.();
      const battleground = root?.Vis?.VisMain?.GetInstance?.()?.get_Battleground?.();
      let load = battleground?.LoadCombatDirect;
      if (typeof load !== 'function') {
        try {
          const prototype = root?.API?.Battleground?.prototype;
          const simulateSource = prototype?.SimulateBattle?.toString?.() ?? '';
          const callbackName = simulateSource.match(/\{battleSetup:[a-z]+\},\s?\(new \$I\.[A-Z]{6}\)\.[A-Z]{6}\(this,this\.([A-Z]{6})\),\s?this\)/)?.[1];
          const callbackSource = callbackName ? prototype?.[callbackName]?.toString?.() ?? '' : '';
          const loaderName = callbackSource.match(/\$I\.[A-Z]{6}\.[A-Z]{6}\(\)\.[A-Z]{6}\(\)\.([A-Z]{6})\([a-z]\.d\)/)?.[1];
          if (loaderName && typeof battleground?.[loaderName] === 'function') load = battleground[loaderName];
        } catch { /* Native Reports-window fallback remains below. */ }
      }
      const mode = root?.Data?.PlayerAreaViewMode?.pavmCombatReplay;
      if (mode != null && app?.getPlayArea?.()?.setView && typeof load === 'function') {
        app.getPlayArea().setView(mode, targetId, 0, 0);
        battleground.Init?.();
        load.call(battleground, combatData);
        globalThis.qx?.event?.Timer?.once?.(() => {
          battleground.RestartReplay?.();
          battleground.set_ReplaySpeed?.(1);
        }, this, 0);
        return true;
      }
    }
    // Open the real Reports overlay, then invoke the same row handler used by
    // the native table. The UI is populated asynchronously, so retry briefly.
    try { nativeReportsOverlay?.show?.(); nativeReportsOverlay?.open?.(); } catch {}
    for (const widget of Object.values(registry)) {
      if (!/^\s*(?:\(\d+\)\s*)?reports\s*$/i.test(String(widget?.getLabel?.() ?? ''))) continue;
      try { widget.execute?.(); widget.fireEvent?.('execute'); break; } catch {}
    }
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!nativeReportsOverlay) {
        try { nativeReportsOverlay = globalThis.webfrontend?.gui?.reports?.ReportsOverlay?.getInstance?.(); } catch {}
      }
      if (nativeReportsOverlay && this.invokeNativeReportRow(nativeReportsOverlay, report)) return true;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Native Reports opened, but report ${id} was not found in its active table. Select the matching native report category and try again.`);
  }

  openTargetAttack(target) {
    if (!target?.id) throw new Error('Choose a target first.');
    this.lastCombatTargetId = target.id;
    const clientLib = this.clientLib();
    const root = clientLib?.root;
    const main = this.mainData();
    const cities = call(main, ['get_Cities']);
    call(cities, ['set_CurrentCityId'], target.id);
    root?.Net?.CommunicationManager?.GetInstance?.()?.UserAction?.();
    const mode = root?.Data?.PlayerAreaViewMode?.pavmCombatSetupDefense;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    app?.getBackgroundArea?.()?.closeCityInfo?.();
    app?.getPlayArea?.()?.setView?.(mode, target.id, 0, 0);
    return target;
  }

  async getTargetInformation(target) {
    if (!this.hub?.scanner?.getTargetIntel) {
      throw new Error('The shared target-intelligence service is unavailable.');
    }
    const intel = await this.hub.scanner.getTargetIntel(target);
    return Object.freeze({ ...intel, attackEstimate: this.snapshot().attackEstimate });
  }
}

function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value !== undefined && value !== null) return value;
      }
    } catch { /* ClientLib data can refresh during a read. */ }
  }
  return null;
}

function values(collection) {
  const source = collection?.d ?? collection?.l ?? collection;
  return source ? (Array.isArray(source) ? source : Object.values(source)).filter((item) => item && typeof item === 'object') : [];
}

function average(items, accessor) {
  const numbers = items.map(accessor).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function health(entity) {
  const value = Number(call(entity, ['get_HitpointsPercent', 'get_HealthPercent', 'get_Health']) ?? 1);
  return value <= 1 ? value * 100 : value;
}

function durationToCap(current, capacity, perHour) {
  return capacity > current && perHour > 0 ? (capacity - current) / perHour * 3600 : 0;
}

export class BaseIntelligenceHub {
  constructor(context) { this.context = context; }
  clientLib() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.clientLib()?.root ?? null; }
  main() { return this.clientLib()?.getMainData?.() ?? null; }
  cityManager() { return call(this.main(), ['get_Cities']); }
  cities() { return values(call(this.cityManager(), ['get_AllCities'])).filter((city) => !call(city, ['get_IsGhostMode'])); }
  currentCity() { return call(this.cityManager(), ['get_CurrentOwnCity', 'get_CurrentCity']); }

  entityName(entity) {
    const data = call(entity, ['get_UnitGameData_Obj', 'get_TechGameData_Obj']);
    return String(call(data, ['get_Name', 'get_DisplayName', 'get_dn']) ?? data?.dn ?? data?.n ?? 'Unknown');
  }

  describeCity(city) {
    const types = this.root()?.Base?.EResourceType ?? {};
    const groups = this.root()?.Data?.EUnitGroup ?? {};
    const buildings = values(call(city, ['get_Buildings']));
    const unitsData = call(city, ['get_CityUnitsData']);
    const offense = values(call(unitsData, ['get_OffenseUnits']));
    const defense = values(call(unitsData, ['get_DefenseUnits']));
    const supportData = call(city, ['get_SupportData']);
    const supportWeapon = call(city, ['get_SupportWeapon']);
    const supportName = String(call(supportWeapon, ['get_Name']) ?? supportWeapon?.n ?? 'None')
      .replace(/^(GDI|NOD|FOR)_SUPPORT_/i, '').replaceAll('_', ' ');
    const supportTarget = String(call(supportData, [
      'get_TargetBaseName', 'get_DedicatedBaseName', 'get_SupportedBaseName'
    ]) ?? city.m_SupportDedicatedBaseName ?? city.SupportDedicatedBaseName ?? 'Unassigned');
    const resource = (type) => Number(call(city, ['GetResourceCount'], type) ?? 0);
    const capacity = (type) => Number(call(city, ['GetResourceMaxStorage'], type) ?? 0);
    const growth = (type) => Number(call(city, ['GetResourceGrowPerHour'], type, false, false) ?? 0)
      + Number(call(city, ['GetResourceBonusGrowPerHour'], type) ?? 0);
    const resources = {};
    for (const [key, type] of [['tiberium', types.Tiberium], ['crystal', types.Crystal ?? types.Chrystal], ['power', types.Power], ['credits', types.Gold]]) {
      const current = resource(type);
      const maximum = capacity(type);
      const perHour = growth(type);
      resources[key] = Object.freeze({ current, capacity: maximum, perHour, timeToCapSeconds: durationToCap(current, maximum, perHour) });
    }
    const repair = {};
    for (const [key, group, type] of [
      ['infantry', groups.Infantry, types.RepairChargeInf],
      ['vehicle', groups.Vehicle, types.RepairChargeVeh],
      ['aircraft', groups.Aircraft, types.RepairChargeAir]
    ]) repair[key] = Object.freeze({
      timeSeconds: Number(call(unitsData, ['GetRepairTimeFromEUnitGroup'], group, false) ?? 0),
      stored: resource(type), capacity: capacity(type)
    });
    const composition = (items) => Object.freeze(Object.entries(items.reduce((result, item) => {
      const name = this.entityName(item);
      result[name] = (result[name] ?? 0) + 1;
      return result;
    }, {})).map(([name, count]) => Object.freeze({ name, count })));
    const allEntities = [...buildings, ...offense, ...defense];
    const buildingsData = call(city, ['get_CityBuildingsData']);
    const collectable = Boolean(call(buildingsData, ['get_HasCollectableBuildings']));
    const packageIncome = {};
    for (const [key, type] of [['tiberium', types.Tiberium], ['crystal', types.Crystal ?? types.Chrystal], ['power', types.Power]]) {
      packageIncome[key] = Number(call(buildingsData, [
        'GetCollectableResourceAmount', 'GetCollectableResourceCount', 'GetPendingResourceAmount'
      ], type) ?? 0);
    }
    const baseRepairData = call(city, ['get_CityRepairData']);
    repair.base = Object.freeze({
      timeSeconds: Number(call(baseRepairData, ['GetRepairTime', 'get_RepairTime', 'GetTotalRepairTime']) ?? 0),
      stored: resource(types.RepairChargeBase), capacity: capacity(types.RepairChargeBase)
    });
    const faction = call(city, ['get_CityFaction', 'get_Faction']) ?? call(this.clientLib()?.getPlayer?.(), ['get_Faction']);
    return Object.freeze({
      raw: city, id: String(call(city, ['get_Id', 'get_CityId']) ?? ''),
      name: String(call(city, ['get_Name']) ?? 'Unknown base'),
      x: Number(call(city, ['get_PosX', 'get_X']) ?? 0), y: Number(call(city, ['get_PosY', 'get_Y']) ?? 0),
      faction, baseLevel: Number(call(city, ['get_LvlBase', 'get_BaseLevel']) ?? 0),
      offenseLevel: Number(call(city, ['get_LvlOffense']) ?? 0), defenseLevel: Number(call(city, ['get_LvlDefense']) ?? 0),
      supportLevel: Number(call(supportData, ['get_Level']) ?? 0), supportName, supportTarget,
      condition: average(allEntities, health), baseCondition: average(buildings, health),
      offenseCondition: average(offense, health), defenseCondition: average(defense, health),
      status: call(city, ['get_IsLocked']) ? 'Locked' : call(city, ['get_IsDamaged']) ? 'Damaged' : collectable ? 'Collectable' : 'Ready',
      collectable, packageIncome: Object.freeze(packageIncome), resources: Object.freeze(resources), repair: Object.freeze(repair),
      composition: Object.freeze({ buildings: composition(buildings), offense: composition(offense), defense: composition(defense), support: supportName }),
      counts: Object.freeze({ buildings: buildings.length, offense: offense.length, defense: defense.length, support: supportData ? 1 : 0 }),
      loot: Object.freeze({
        tiberium: Number(call(city, ['GetLootableResourceCount', 'GetResourceCountLootable'], types.Tiberium) ?? 0),
        crystal: Number(call(city, ['GetLootableResourceCount', 'GetResourceCountLootable'], types.Crystal ?? types.Chrystal) ?? 0),
        power: Number(call(city, ['GetLootableResourceCount', 'GetResourceCountLootable'], types.Power) ?? 0)
      })
    });
  }

  snapshot() {
    const shared = this.context.hub?.snapshot?.() ?? {};
    const cities = this.cities().map((city) => this.describeCity(city));
    const currentId = String(call(this.currentCity(), ['get_Id', 'get_CityId']) ?? '');
    return Object.freeze({
      player: shared.player ?? null, world: shared.world ?? null, alliance: shared.alliance ?? null,
      account: Object.freeze({ host: globalThis.location?.host ?? 'Unknown', language: globalThis.navigator?.language ?? 'Unknown' }),
      currentId, cities: Object.freeze(cities), current: cities.find((city) => city.id === currentId) ?? cities[0] ?? null
    });
  }

  focus(cityId) {
    const city = this.cities().find((item) => String(call(item, ['get_Id'])) === String(cityId));
    if (!city) throw new Error('Base is no longer available.');
    call(this.cityManager(), ['set_CurrentCityId'], call(city, ['get_Id']));
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    const mode = this.root()?.Data?.PlayerAreaViewMode?.pavmNone ?? this.root()?.Vis?.Mode?.City;
    app?.getBackgroundArea?.()?.closeCityInfo?.();
    app?.getPlayArea?.()?.setView?.(mode, call(city, ['get_Id']), 0, 0);
    return this.describeCity(city);
  }

  selectedPlayerCity() {
    const city = call(this.cityManager(), ['get_CurrentCity']);
    return city ? this.describeCity(city) : null;
  }

  regionTargetIntel(visObject) {
    const x = Number(call(visObject, ['get_RawX', 'get_X', 'get_PosX']) ?? 0);
    const y = Number(call(visObject, ['get_RawY', 'get_Y', 'get_PosY']) ?? 0);
    const ownCity = call(this.cityManager(), ['get_CurrentOwnCity']);
    const targetCity = call(this.cityManager(), ['get_CurrentCity']);
    const player = call(this.main(), ['get_Player']);
    const cpAvailable = Number(call(player, ['GetCommandPointCount', 'get_CommandPointCount']) ?? 0);
    const cpCost = Number(call(ownCity, ['CalculateAttackCommandPointCostToCoord'], x, y) ?? 0);
    const cpAttacks = cpCost > 0 ? Math.floor(cpAvailable / cpCost) : 0;
    const own = ownCity ? this.describeCity(ownCity) : null;
    const repairGroups = own ? ['infantry', 'vehicle', 'aircraft'].map((key) => ({
      key,
      needed: Number(own.repair[key]?.timeSeconds || 0),
      available: Number(own.repair[key]?.stored || 0)
    })) : [];
    const activeRepairGroups = repairGroups.filter((group) => group.needed > 0);
    const maxRepairCost = Math.max(0, ...activeRepairGroups.map((group) => group.needed));
    const repairAvailable = activeRepairGroups.length
      ? Math.min(...activeRepairGroups.map((group) => group.available))
      : 0;
    const fullyRepairableAttacks = maxRepairCost > 0
      ? Math.floor(repairAvailable / maxRepairCost)
      : Infinity;
    const repairAttacks = Number.isFinite(fullyRepairableAttacks)
      ? fullyRepairableAttacks + 1
      : Infinity;
    const possibleAttacks = Math.max(0, Math.min(cpAttacks, repairAttacks));

    const resourceNames = {};
    for (const [name, value] of Object.entries(this.root()?.Base?.EResourceType ?? {})) {
      if (typeof value === 'number') resourceNames[value] = name;
    }
    const loot = Array.from(this.root()?.API?.Battleground?.GetInstance?.()?.GetLootFromCurrentCity?.() ?? [])
      .map((entry) => ({
        type: entry.Type,
        name: resourceNames[entry.Type] ?? `Resource ${entry.Type}`,
        amount: Number(entry.Count ?? 0)
      }))
      .filter((entry) => entry.amount > 0);

    const server = call(this.main(), ['get_Server']);
    const world = call(this.main(), ['get_World']);
    const radius = Number(call(server, ['get_MaxAttackDistance']) ?? 0);
    const npcBaseType = this.root()?.Data?.WorldSector?.ObjectType?.NPCBase
      ?? this.root()?.Data?.WorldSector?.ObjectType?.NPCBaseDestroyed
      ?? 2;
    const levels = {};
    let forgotten = 0;
    let innerForgotten = 0;
    let surrounding = 0;
    for (let scanY = y - Math.ceil(radius); scanY <= y + Math.ceil(radius); scanY += 1) {
      for (let scanX = x - Math.ceil(radius); scanX <= x + Math.ceil(radius); scanX += 1) {
        const distance = Math.hypot(x - scanX, y - scanY);
        if (distance > radius || (scanX === x && scanY === y)) continue;
        const object = call(world, ['GetObjectFromPosition'], scanX, scanY);
        if (!object) continue;
        surrounding += 1;
        const type = Number(call(object, ['get_Type', 'get_ObjectType']) ?? object.Type ?? -1);
        const constructorName = String(object.constructor?.name ?? '').toLowerCase();
        if (type !== npcBaseType && !constructorName.includes('npcbase')) continue;
        const level = Number(call(object, ['get_BaseLevel', 'get_Level']) ?? 0);
        forgotten += 1;
        if (distance <= Math.floor(radius)) innerForgotten += 1;
        levels[level] = (levels[level] ?? 0) + 1;
      }
    }
    const waves = innerForgotten <= 0 ? 0
      : innerForgotten <= 21 ? 1
        : innerForgotten <= 31 ? 2
          : innerForgotten <= 41 ? 3
            : innerForgotten <= 51 ? 4 : 5;
    return Object.freeze({
      x, y, attacker: own?.name ?? 'Current base', cpAvailable, cpCost, cpAttacks,
      maxRepairCostSeconds: maxRepairCost, repairAvailableSeconds: repairAvailable,
      repairGroups: Object.freeze(repairGroups.map((group) => Object.freeze(group))),
      fullyRepairableAttacks, repairAttacks, possibleAttacks, loot: Object.freeze(loot), surrounding,
      attackRadius: radius, innerAttackRadius: Math.floor(radius),
      forgotten, innerForgotten, waves, levels: Object.freeze(levels),
      targetLoaded: Boolean(targetCity)
    });
  }
}

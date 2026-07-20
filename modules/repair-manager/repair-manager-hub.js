function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value !== undefined && value !== null) return value;
      }
    } catch {
      // ClientLib objects can change while a city update is being processed.
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
      // Try the next compatible action name.
    }
  }
  return false;
}

function values(collection) {
  if (!collection) return [];
  const source = collection.l ?? collection.d ?? collection;
  return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean);
}

const PRIORITY_NAMES = Object.freeze({
  'defense-first': [
    'Defense_Facility', 'Construction_Yard', 'Defense_HQ', 'Support_Air',
    'Support_Ion', 'Support_Art', 'Command_Center', 'Barracks', 'Factory',
    'Airport', 'Silo', 'Accumulator', 'PowerPlant', 'Harvester',
    'Harvester_Crystal', 'Refinery'
  ],
  'production-first': [
    'Harvester', 'Harvester_Crystal', 'Refinery', 'PowerPlant', 'Silo',
    'Accumulator', 'Construction_Yard', 'Command_Center', 'Barracks',
    'Factory', 'Airport', 'Defense_Facility', 'Defense_HQ', 'Support_Air',
    'Support_Ion', 'Support_Art'
  ],
  'core-first': [
    'Construction_Yard', 'Command_Center', 'Defense_Facility', 'Defense_HQ',
    'Barracks', 'Factory', 'Airport', 'Support_Air', 'Support_Ion',
    'Support_Art', 'PowerPlant', 'Harvester', 'Harvester_Crystal',
    'Refinery', 'Silo', 'Accumulator'
  ]
});

export class RepairManagerHub {
  constructor(context) {
    this.context = context;
  }

  clientLib() {
    return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null;
  }

  root() {
    return this.clientLib()?.root ?? null;
  }

  cities() {
    const collection = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return values(call(collection, ['get_AllCities']));
  }

  currentCity() {
    const collection = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return call(collection, ['get_CurrentOwnCity']);
  }

  cityName(city) {
    return String(call(city, ['get_Name']) ?? 'Unknown base');
  }

  mode(name) {
    const modes = this.root()?.Vis?.Mode ?? {};
    const names = name === 'buildings'
      ? ['City']
      : name === 'offense'
        ? ['ArmySetup']
        : ['DefenseSetup', 'Defense'];
    return names.map((key) => modes[key]).find((value) => value != null) ?? null;
  }

  offenseDamageState(city) {
    const units = call(city, ['get_CityUnitsData']);
    const collection = call(units, ['get_OffenseUnits']);
    if (!collection) return null;
    return values(collection).some((unit) => Boolean(call(unit, ['get_IsDamaged'])));
  }

  repairAvailability() {
    const result = {};
    for (const kind of ['buildings', 'offense', 'defense']) {
      const mode = this.mode(kind);
      if (mode == null) {
        result[kind] = Object.freeze({ supported: false, available: 0 });
        continue;
      }
      let available = 0;
      for (const city of this.cities()) {
        if (call(city, ['get_IsGhostMode']) || call(city, ['get_IsLocked'])) continue;
        const repair = call(city, ['get_CityRepairData']);
        const canRepairAll = Boolean(repair && call(repair, ['CanRepairAll'], mode));
        const offenseDamage = kind === 'offense' ? this.offenseDamageState(city) : null;
        const availableForKind = offenseDamage === null ? canRepairAll : offenseDamage;
        if (availableForKind) available += 1;
      }
      result[kind] = Object.freeze({ supported: true, available });
    }
    return Object.freeze(result);
  }

  actionAvailability() {
    const repairs = this.repairAvailability();
    let collectable = 0;
    for (const city of this.cities()) {
      if (call(city, ['get_IsGhostMode'])) continue;
      const buildings = call(city, ['get_CityBuildingsData']);
      if (call(buildings, ['get_HasCollectableBuildings'])) collectable += 1;
    }
    return Object.freeze({
      collect: Object.freeze({ supported: true, available: collectable }),
      ...repairs
    });
  }

  snapshot() {
    const root = this.root();
    const groups = root?.Data?.EUnitGroup ?? {};
    const resourceTypes = root?.Base?.EResourceType ?? {};
    const cities = this.cities().filter((city) => !call(city, ['get_IsGhostMode']));
    const current = this.currentCity();
    const player = this.clientLib()?.getPlayer?.();
    const units = call(current, ['get_CityUnitsData']);
    const resource = (name) => Number(call(current, ['GetResourceCount'], resourceTypes[name]) ?? 0);
    const repairTime = (group) => Number(call(units, ['GetRepairTimeFromEUnitGroup'], group, false) ?? 0);
    const actionAvailability = this.actionAvailability();
    const required = { tiberium: 0, crystal: 0, credits: 0, power: 0 };
    const typeNames = Object.fromEntries(Object.entries(resourceTypes)
      .filter(([, value]) => typeof value === 'number').map(([name, value]) => [value, name.toLowerCase()]));
    const repairCost = root?.API?.Util?.GetUnitRepairCostsForCity;
    if (typeof repairCost === 'function') {
      const entities = [
        ...values(call(current, ['get_Buildings'])),
        ...values(call(units, ['get_OffenseUnits'])),
        ...values(call(units, ['get_DefenseUnits']))
      ];
      for (const entity of entities) {
        if (!call(entity, ['get_IsDamaged'])) continue;
        const costs = values(repairCost(call(entity, ['get_City']) ?? current,
          Number(call(entity, ['get_CurrentLevel', 'get_Level']) ?? 0),
          call(entity, ['get_MdbUnitId', 'get_MdbId']), 1));
        for (const cost of costs) {
          const key = typeNames[cost.Type] ?? '';
          if (key in required) required[key] += Number(cost.Count ?? 0);
        }
      }
    }
    return Object.freeze({
      cityCount: cities.length,
      damagedCities: cities.filter((city) => Boolean(call(city, ['get_IsDamaged']))).length,
      collectableCities: cities.filter((city) =>
        Boolean(call(call(city, ['get_CityBuildingsData']), ['get_HasCollectableBuildings']))
      ).length,
      currentCity: call(current, ['get_Name']) ?? 'No base selected',
      playerName: call(player, ['get_Name', 'get_PlayerName']) ?? 'Unknown player',
      resources: Object.freeze({
        tiberium: resource('Tiberium'),
        crystal: resource('Crystal'),
        credits: resource('Credits'),
        power: resource('Power')
      }),
      requiredResources: Object.freeze(required),
      repairSeconds: Object.freeze({
        infantry: repairTime(groups.Infantry),
        vehicle: repairTime(groups.Vehicle),
        aircraft: repairTime(groups.Aircraft)
      }),
      defenseSupported: actionAvailability.defense.supported,
      actionAvailability
    });
  }

  collectAll() {
    let collected = 0;
    const details = [];
    for (const city of this.cities()) {
      if (call(city, ['get_IsGhostMode'])) continue;
      const buildings = call(city, ['get_CityBuildingsData']);
      if (!call(buildings, ['get_HasCollectableBuildings'])) continue;
      if (invoke(city, ['CollectAllResources'])) {
        collected += 1;
        details.push({ action: 'collect', base: this.cityName(city) });
      }
    }
    return { affected: collected, supported: true, details };
  }

  repairAllMode(kind) {
    const mode = this.mode(kind);
    if (mode == null) return { affected: 0, supported: false };
    let affected = 0;
    const details = [];
    for (const city of this.cities()) {
      if (call(city, ['get_IsGhostMode']) || call(city, ['get_IsLocked'])) continue;
      const repair = call(city, ['get_CityRepairData']);
      if (!repair || !call(repair, ['CanRepairAll'], mode)) continue;
      if (invoke(repair, ['RepairAll'], mode)) {
        affected += 1;
        details.push({ action: kind, base: this.cityName(city) });
      }
    }
    return { affected, supported: true, details };
  }

  repairBuildings(priority = 'defense-first') {
    const techNames = this.root()?.Base?.ETechName ?? {};
    const order = PRIORITY_NAMES[priority] ?? PRIORITY_NAMES['defense-first'];
    let affected = 0;
    const repairedBases = new Set();
    for (const city of this.cities()) {
      if (call(city, ['get_IsGhostMode']) || call(city, ['get_IsLocked']) || !call(city, ['get_IsDamaged'])) continue;
      const buildings = call(city, ['get_CityBuildingsData']);
      let repairedCity = false;
      let cityGranularSupported = false;
      for (const name of order) {
        const tech = techNames[name];
        if (tech == null) continue;
        for (const building of values(call(buildings, ['GetAllBuildingsByTechName'], tech))) {
          if (!call(building, ['get_IsDamaged'])) continue;
          const canRepair = call(building, ['CanRepair', 'get_CanRepair']);
          if (canRepair === null) continue;
          cityGranularSupported = true;
          if (!canRepair) break;
          if (invoke(building, ['Repair', 'RepairBuilding'])) {
            affected += 1;
            repairedCity = true;
            repairedBases.add(this.cityName(city));
          }
        }
      }
      if (!cityGranularSupported && !repairedCity) {
        const fallback = call(city, ['get_CityRepairData']);
        const mode = this.mode('buildings');
        if (mode != null && call(fallback, ['CanRepairAll'], mode)) {
          if (invoke(fallback, ['RepairAll'], mode)) {
            affected += 1;
            repairedBases.add(this.cityName(city));
          }
        }
      }
    }
    return {
      affected,
      supported: true,
      details: [...repairedBases].map((base) => ({ action: 'buildings', base }))
    };
  }

}

export { PRIORITY_NAMES };

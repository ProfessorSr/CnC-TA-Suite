function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] !== 'function') continue;
      const value = target[name](...args);
      if (value !== undefined && value !== null) return value;
    } catch {
      // ClientLib data can be transient while a city update is applied.
    }
  }
  return null;
}

function values(collection) {
  if (!collection) return [];
  const source = collection.d ?? collection.l ?? collection;
  return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const RESOURCE_BUILDINGS = new Set([
  'Power Plant', 'Harvester', 'Refinery', 'Silo', 'Accumulator'
]);
const CORE_BUILDINGS = new Set([
  'Construction Yard', 'Command Center', 'Defense Facility', 'Defense HQ'
]);
const SUPPORT_BUILDINGS = new Set(['Air Support', 'Ion Cannon Support', 'Artillery Support']);
const PRODUCTION_BUILDINGS = new Set(['Barracks', 'Factory', 'Airport']);

export class UpgradeManagerHub {
  constructor(context) {
    this.context = context;
    this.lastSelection = null;
  }

  clientLib() {
    return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null;
  }

  root() { return this.clientLib()?.root ?? null; }

  cities() {
    const cities = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return values(call(cities, ['get_AllCities'])).filter((city) => !call(city, ['get_IsGhostMode']));
  }

  currentCity() {
    const cities = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return call(cities, ['get_CurrentOwnCity']);
  }

  cityId(city) { return String(call(city, ['get_Id', 'get_CityId']) ?? ''); }
  cityName(city) { return String(call(city, ['get_Name']) ?? 'Unknown base'); }

  resourceMap(city) {
    const types = this.root()?.Base?.EResourceType ?? {};
    const read = (names) => {
      const type = names.map((name) => types[name]).find((value) => value != null);
      return type == null ? 0 : finite(call(city, ['GetResourceCount'], type));
    };
    return {
      tiberium: read(['Tiberium']),
      crystal: read(['Crystal', 'Chrystal']),
      credits: read(['Credits']),
      power: read(['Power'])
    };
  }

  normalizeCosts(requirements, scope = null) {
    const types = this.root()?.Base?.EResourceType ?? {};
    const result = { tiberium: 0, crystal: 0, credits: 0, power: 0 };
    const items = values(requirements);
    const positional = scope === 'buildings'
      ? ['tiberium', 'power', 'crystal', 'credits']
      : ['crystal', 'power', 'tiberium', 'credits'];
    for (const [index, item] of items.entries()) {
      const rawType = item?.Type ?? item?.type ?? item?.t ?? item?.ResourceType
        ?? item?.resourceType ?? call(item, ['get_Type']);
      const type = Number(rawType);
      const count = finite(
        item?.Count ?? item?.count ?? item?.c ?? item?.Value ?? item?.value
        ?? call(item, ['get_Count']),
        typeof item === 'number' ? item : 0
      );
      let resource = null;
      if (type === Number(types.Tiberium)) resource = 'tiberium';
      else if (type === Number(types.Crystal) || type === Number(types.Chrystal)) resource = 'crystal';
      else if (type === Number(types.Credits)) resource = 'credits';
      else if (type === Number(types.Power)) resource = 'power';
      else if (typeof rawType === 'string') {
        const name = rawType.toLowerCase();
        if (name.includes('tiberium')) resource = 'tiberium';
        else if (name.includes('crystal') || name.includes('chrystal')) resource = 'crystal';
        else if (name.includes('credit')) resource = 'credits';
        else if (name.includes('power')) resource = 'power';
      }
      resource ??= positional[index] ?? null;
      if (resource) result[resource] += count;
    }
    return result;
  }

  requirements(entity, nextLevel) {
    const data = call(entity, ['get_UnitGameData_Obj', 'get_TechGameData_Obj']);
    const util = this.root()?.Base?.Util;
    return call(util, [
      'GetUnitLevelResourceRequirements_Obj',
      'GetTechLevelResourceRequirements_Obj'
    ], nextLevel, data);
  }

  productionPerHour(city, resource) {
    const types = this.root()?.Base?.EResourceType ?? {};
    if (resource === 'credits') {
      const production = call(city, ['get_CityCreditsProduction']);
      const resourceApi = this.root()?.Base?.Resource;
      return finite(call(resourceApi, ['GetResourceGrowPerHour'], production, false))
        + finite(call(resourceApi, ['GetResourceBonusGrowPerHour'], production, false));
    }
    const type = resource === 'crystal' ? (types.Crystal ?? types.Chrystal) : types[resource[0].toUpperCase() + resource.slice(1)];
    return finite(call(city, ['GetResourceGrowPerHour', 'GetResourceProductionPerHour'], type, false, false))
      + finite(call(city, ['GetResourceBonusGrowPerHour'], type, false, false));
  }

  currentScope() {
    const mode = call(this.root()?.Vis?.VisMain?.GetInstance?.(), ['get_Mode']);
    const modes = this.root()?.Vis?.Mode ?? {};
    if (mode === modes.DefenseSetup) return 'defense';
    if (mode === modes.ArmySetup) return 'offense';
    return 'buildings';
  }

  scopeApi(scope = this.currentScope()) {
    const api = this.root()?.API;
    if (scope === 'defense') return api?.Defense?.GetInstance?.();
    if (scope === 'offense') return api?.Army?.GetInstance?.();
    return api?.City?.GetInstance?.();
  }

  unitCollections(city) {
    const units = call(city, ['get_CityUnitsData']);
    const found = { defense: null, offense: null };
    found.defense = call(units, ['get_DefenseUnits', 'get_DefenceUnits'])
      ?? call(city, ['get_DefenseUnits', 'get_DefenceUnits']);
    found.offense = call(units, ['get_OffenseUnits', 'get_ArmyUnits'])
      ?? call(city, ['get_OffenseUnits', 'get_ArmyUnits']);
    if (found.defense && found.offense) return found;

    // Several production builds minify away the public collection getters.
    // Identify the two CityUnits collections by their stable data shape and
    // the unit group discriminator without modifying ClientLib prototypes.
    for (const collection of Object.values(units ?? {})) {
      const data = collection?.d;
      if (!data || typeof data !== 'object') continue;
      const entries = Object.values(data).filter(Boolean);
      const sample = entries[0];
      if (!sample || typeof sample.get_UnitLevelRepairRequirements !== 'function') continue;
      const group = call(sample, ['GetUnitGroupType', 'get_UnitGroupType']);
      if (group == null) continue;
      if (Number(group) === 0) found.defense ??= collection;
      else found.offense ??= collection;
    }
    return found;
  }

  lowestUpgradeableLevel(scope = this.currentScope()) {
    const api = this.scopeApi(scope);
    const method = scope === 'buildings'
      ? 'GetUpgradeCostsForAllBuildingsToLevel'
      : 'GetUpgradeCostsForAllUnitsToLevel';
    const cap = finite(call(this.root()?.Data?.MainData?.GetInstance?.()?.get_Server?.(), ['get_PlayerUpgradeCap']), 80);
    for (let level = 1; level <= Math.max(1, cap); level += 1) {
      const costs = this.normalizeCosts(call(api, [method], level), scope);
      if (Object.values(costs).some((amount) => amount > 0)) return level;
    }
    return 1;
  }

  quickUpgradePlan(targetLevel) {
    const city = this.currentCity();
    if (!city) throw new Error('No owned base is currently open.');
    const scope = this.currentScope();
    const api = this.scopeApi(scope);
    const costMethod = scope === 'buildings'
      ? 'GetUpgradeCostsForAllBuildingsToLevel'
      : 'GetUpgradeCostsForAllUnitsToLevel';
    const costs = this.normalizeCosts(call(api, [costMethod], targetLevel), scope);
    const resources = this.resourceMap(city);
    const production = Object.fromEntries(
      Object.keys(costs).map((resource) => [resource, this.productionPerHour(city, resource)])
    );
    const shortfall = Object.fromEntries(
      Object.keys(costs).map((resource) => [resource, Math.max(0, costs[resource] - resources[resource])])
    );
    const etaSeconds = Object.fromEntries(Object.keys(costs).map((resource) => {
      const missing = shortfall[resource];
      const hourly = production[resource];
      return [resource, missing <= 0 ? 0 : hourly > 0 ? (missing / hourly) * 3600 : Infinity];
    }));
    const currentCityId = this.cityId(city);
    const candidates = this.candidates()
      .filter((item) => item.cityId === currentCityId && item.category === scope
        && item.level < targetLevel)
      .sort((a, b) => a.level - b.level || a.totalCost - b.totalCost);
    const remaining = { ...resources };
    let affordableCount = 0;
    const affordableCandidates = [];
    for (const candidate of candidates) {
      const details = scope === 'buildings'
        ? call(candidate.entity, ['get_BuildingDetails'])
        : call(candidate.entity, ['get_UnitDetails']);
      const upgradeTarget = details ?? candidate.entity;
      const individualMethod = scope === 'buildings'
        ? 'GetUpgradeCostsForBuildingToLevel'
        : 'GetUpgradeCostsForUnitToLevel';
      let targetCosts = this.normalizeCosts(call(api, [individualMethod], upgradeTarget, targetLevel), scope);
      if (!Object.values(targetCosts).some((amount) => amount > 0)) {
        targetCosts = { tiberium: 0, crystal: 0, credits: 0, power: 0 };
        for (let level = candidate.level + 1; level <= targetLevel; level += 1) {
          const levelCosts = this.normalizeCosts(this.requirements(candidate.entity, level), scope);
          for (const resource of Object.keys(targetCosts)) targetCosts[resource] += levelCosts[resource];
        }
      }
      if (!Object.values(targetCosts).some((amount) => amount > 0)) continue;
      if (!Object.keys(targetCosts).every((resource) => targetCosts[resource] <= remaining[resource])) continue;
      for (const resource of Object.keys(targetCosts)) remaining[resource] -= targetCosts[resource];
      affordableCount += 1;
      affordableCandidates.push(Object.freeze({
        details: upgradeTarget,
        hasNativeDetails: Boolean(details),
        entity: candidate.entity,
        city: candidate.city,
        name: candidate.name,
        level: candidate.level,
        costs: targetCosts
      }));
    }
    const aggregateAffordable = Object.values(shortfall).every((value) => value <= 0);
    const hasAggregateCost = Object.values(costs).some((value) => value > 0);
    const totalCount = candidates.length || (hasAggregateCost ? 1 : 0);
    if (!candidates.length && aggregateAffordable && hasAggregateCost) affordableCount = 1;
    return Object.freeze({
      city: this.cityName(city), scope, targetLevel, costs, resources,
      production, shortfall, etaSeconds, totalCount, affordableCount,
      affordable: aggregateAffordable,
      affordableCandidates: Object.freeze(affordableCandidates)
    });
  }

  liveSelectedObject() {
    const integrated = this.context?.game?.selection?.current?.()
      ?? this.context?.hub?.game?.selection?.current?.();
    if (integrated) return integrated;
    const vis = this.root()?.Vis?.VisMain?.GetInstance?.();
    return call(vis, ['get_SelectedObject', 'get_Selection', 'get_SelectedVisObject']);
  }

  captureSelection() {
    const selected = this.liveSelectedObject();
    const cityId = this.cityId(this.currentCity());
    if (this.lastSelection?.cityId && this.lastSelection.cityId !== cityId) {
      this.lastSelection = null;
    }
    if (!selected) return this.lastSelection;
    const types = this.root()?.Vis?.VisObject?.EObjectType ?? {};
    const objectType = Number(call(selected, ['get_VisObjectType']));
    let descriptor = null;
    if (objectType === Number(types.CityBuildingType)) {
      descriptor = {
        selected,
        cityId,
        scope: 'buildings',
        details: call(selected, ['get_BuildingDetails']),
        name: call(selected, ['get_BuildingName']),
        level: finite(call(selected, ['get_BuildingLevel']))
      };
    } else if (objectType === Number(types.DefenseUnitType) || objectType === Number(types.ArmyUnitType)) {
      descriptor = {
        selected,
        cityId,
        scope: objectType === Number(types.DefenseUnitType) ? 'defense' : 'offense',
        details: call(selected, ['get_UnitDetails']),
        name: call(selected, ['get_UnitName']),
        level: finite(call(selected, ['get_UnitLevel']))
      };
    }
    if (descriptor?.details) this.lastSelection = descriptor;
    return this.lastSelection;
  }

  selectedUpgradePlan(targetLevel) {
    const descriptor = this.captureSelection();
    if (!descriptor) return null;
    const { selected, scope, details, name, level } = descriptor;
    if (scope !== this.currentScope()) return null;
    if (!details || targetLevel <= level) return { name, level, scope, targetLevel, invalidLevel: true };
    const api = this.scopeApi(scope);
    const method = scope === 'buildings'
      ? 'GetUpgradeCostsForBuildingToLevel'
      : 'GetUpgradeCostsForUnitToLevel';
    const costs = this.normalizeCosts(call(api, [method], details, targetLevel), scope);
    const resources = this.resourceMap(this.currentCity());
    const shortfall = Object.fromEntries(
      Object.keys(costs).map((resource) => [resource, Math.max(0, costs[resource] - resources[resource])])
    );
    return {
      selected, details, name: String(name ?? 'Selected item'), level, scope, targetLevel,
      costs, resources, shortfall,
      affordable: Object.values(shortfall).every((value) => value <= 0)
    };
  }

  upgradeSelectedToLevel(plan) {
    if (!plan?.details || !plan.affordable) return { success: false, reason: 'selected upgrade is not affordable' };
    const api = this.scopeApi(plan.scope);
    const method = plan.scope === 'buildings' ? 'UpgradeBuildingToLevel' : 'UpgradeUnitToLevel';
    if (typeof api?.[method] !== 'function') return { success: false, reason: 'selected upgrade API unavailable' };
    api[method](plan.details, plan.targetLevel);
    if (this.lastSelection?.details === plan.details) {
      this.lastSelection.level = plan.targetLevel;
    }
    return { success: true, scope: plan.scope };
  }

  faction() {
    const city = this.currentCity();
    const value = call(city, ['get_CityFaction', 'get_Faction']);
    const factions = this.root()?.Base?.EFactionType ?? {};
    if (Number(value) === Number(factions.NOD ?? 2)) return 'nod';
    return 'gdi';
  }

  upgradeAllToLevel(targetLevel, requestedScope = this.currentScope()) {
    const scope = requestedScope;
    const api = this.scopeApi(scope);
    const method = scope === 'buildings'
      ? 'UpgradeAllBuildingsToLevel'
      : 'UpgradeAllUnitsToLevel';
    if (typeof api?.[method] !== 'function') {
      return { success: false, reason: `${scope} bulk-upgrade API unavailable` };
    }
    api[method](targetLevel);
    return { success: true, scope };
  }

  upgradeAffordableToLevel(plan) {
    if (!plan || plan.scope === 'buildings') return this.upgradeAllToLevel(plan?.targetLevel, plan?.scope);
    const api = this.scopeApi(plan.scope);
    const manager = this.root()?.Net?.CommunicationManager?.GetInstance?.();
    let upgraded = 0;
    for (const candidate of plan.affordableCandidates ?? []) {
      if (candidate.hasNativeDetails && typeof api?.UpgradeUnitToLevel === 'function') {
        api.UpgradeUnitToLevel(candidate.details, plan.targetLevel);
        upgraded += 1;
        continue;
      }
      if (typeof manager?.SendCommand !== 'function') continue;
      manager.SendCommand('UnitUpgrade', {
        cityid: call(candidate.city, ['get_Id', 'get_CityId']),
        basename: this.cityName(candidate.city),
        unitname: candidate.name,
        level: candidate.level,
        type: plan.scope === 'defense' ? 'Defense' : 'Offense',
        unitId: call(candidate.entity, ['get_Id'])
      }, null, null, true);
      upgraded += 1;
    }
    if (upgraded > 0) return { success: true, scope: plan.scope, upgraded };
    // This is the same final fallback used by the building path: the displayed
    // plan authorizes a user-triggered native bulk upgrade, and ClientLib makes
    // the final eligibility decision for the current scope.
    return this.upgradeAllToLevel(plan.targetLevel, plan.scope);
  }

  candidate(city, entity, category) {
    const name = String(call(call(entity, ['get_UnitGameData_Obj', 'get_TechGameData_Obj']), ['get_dn'])
      ?? call(entity, ['get_Name'])
      ?? call(entity, ['get_UnitGameData_Obj', 'get_TechGameData_Obj'])?.dn
      ?? 'Unknown');
    const level = finite(call(entity, ['get_CurrentLevel', 'get_Level', 'get_Lvl']), 0);
    const nextLevel = level + 1;
    const costs = this.normalizeCosts(this.requirements(entity, nextLevel), category);
    const resources = this.resourceMap(city);
    const shortfall = Object.fromEntries(Object.keys(costs).map((key) => [key, Math.max(0, costs[key] - resources[key])]));
    const affordable = Object.values(shortfall).every((value) => value <= 0);
    const waitHours = Object.keys(shortfall).reduce((longest, key) => {
      if (!shortfall[key]) return longest;
      const production = this.productionPerHour(city, key);
      return production > 0 ? Math.max(longest, shortfall[key] / production) : Infinity;
    }, 0);
    const totalCost = costs.tiberium + costs.crystal + costs.credits + costs.power;
    return {
      id: `${this.cityId(city)}:${category}:${call(entity, ['get_Id']) ?? `${call(entity, ['get_CoordX'])},${call(entity, ['get_CoordY'])}`}`,
      cityId: this.cityId(city),
      base: this.cityName(city),
      category,
      name,
      level,
      nextLevel,
      costs,
      shortfall,
      affordable,
      etaSeconds: Number.isFinite(waitHours) ? waitHours * 3600 : Infinity,
      damaged: Boolean(call(entity, ['get_IsDamaged'])) || finite(call(entity, ['get_CurrentDamage'])) > 0,
      locked: Boolean(call(city, ['get_IsLocked'])),
      resourceBuilding: RESOURCE_BUILDINGS.has(name),
      coreBuilding: CORE_BUILDINGS.has(name),
      supportBuilding: SUPPORT_BUILDINGS.has(name),
      productionBuilding: PRODUCTION_BUILDINGS.has(name),
      totalCost,
      entity,
      city
    };
  }

  candidates() {
    const result = [];
    for (const city of this.cities()) {
      const buildingsData = call(city, ['get_CityBuildingsData']);
      const buildings = values(call(city, ['get_Buildings']));
      const buildingList = buildings.length ? buildings : values(call(buildingsData, ['get_AllBuildings', 'get_Buildings']));
      for (const building of buildingList) result.push(this.candidate(city, building, 'buildings'));
      const { defense, offense } = this.unitCollections(city);
      for (const unit of values(defense)) result.push(this.candidate(city, unit, 'defense'));
      for (const unit of values(offense)) result.push(this.candidate(city, unit, 'offense'));
    }
    return result;
  }

  rank(candidates, strategy) {
    const score = (item) => {
      if (strategy === 'highest-level') return -item.level;
      if (strategy === 'lowest-cost') return item.totalCost;
      if (strategy === 'collector-heavy') return item.name === 'Harvester' || item.name === 'Refinery' || item.name === 'Silo' ? -1e15 + item.totalCost : item.totalCost;
      if (strategy === 'power-heavy') return item.name === 'Power Plant' || item.name === 'Accumulator' ? -1e15 + item.totalCost : item.totalCost;
      return item.resourceBuilding ? -1e15 + (item.totalCost / Math.max(1, item.nextLevel)) : item.totalCost;
    };
    return [...candidates].sort((a, b) => Number(b.affordable) - Number(a.affordable) || score(a) - score(b));
  }

  upgrade(candidate) {
    if (!candidate || candidate.locked || candidate.damaged || !candidate.affordable) return { success: false, reason: 'not eligible' };
    if (candidate.category === 'buildings') {
      const manager = this.root()?.Net?.CommunicationManager?.GetInstance?.();
      if (!manager?.SendCommand) return { success: false, reason: 'building upgrade command unavailable' };
      manager.SendCommand('UpgradeBuilding', {
        cityid: call(candidate.city, ['get_Id']),
        posX: call(candidate.entity, ['get_CoordX']),
        posY: call(candidate.entity, ['get_CoordY'])
      }, null, null, true);
      return { success: true };
    }
    if (this.cityId(this.currentCity()) !== candidate.cityId) return { success: false, reason: 'select this base before upgrading units' };
    const apiName = candidate.category === 'offense' ? 'Army' : 'Defense';
    const api = this.root()?.API?.[apiName]?.GetInstance?.();
    const details = call(candidate.entity, ['get_UnitDetails']);
    if (!api?.UpgradeUnitToLevel || !details) return { success: false, reason: `${candidate.category} upgrade API unavailable` };
    api.UpgradeUnitToLevel(details, candidate.nextLevel);
    return { success: true };
  }
}

export { RESOURCE_BUILDINGS, CORE_BUILDINGS, SUPPORT_BUILDINGS, PRODUCTION_BUILDINGS };

function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value !== undefined && value !== null) return value;
      }
    } catch { /* ClientLib objects may refresh during reads. */ }
  }
  return null;
}

function values(collection) {
  const source = collection?.d ?? collection?.l ?? collection;
  return source ? (Array.isArray(source) ? source : Object.values(source)).filter(Boolean) : [];
}

export class LayoutOptimizerHub {
  constructor(context) { this.context = context; }
  clientLib() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.clientLib()?.root ?? null; }
  city() {
    const cities = call(this.clientLib()?.getMainData?.(), ['get_Cities']);
    return call(cities, ['get_CurrentOwnCity']);
  }

  snapshot() {
    const city = this.city();
    if (!city) throw new Error('Select one of your bases first.');
    const production = {};
    const storage = {};
    const types = this.root()?.Base?.EResourceType ?? {};
    for (const [key, type] of [['tiberium', types.Tiberium], ['crystal', types.Crystal ?? types.Chrystal], ['power', types.Power]]) {
      production[key] = Number(call(city, ['GetResourceGrowPerHour', 'GetResourceProductionPerHour'], type) ?? 0);
      storage[key] = Number(call(city, ['GetResourceMaxStorage', 'GetResourceStorageLimit'], type) ?? 0);
    }
    const normalizeCosts = (requirements) => {
      const result = { tiberium: 0, crystal: 0, power: 0 };
      for (const item of values(requirements)) {
        const type = item.Type ?? item.t ?? item.ResourceType;
        const amount = Number(item.Count ?? item.c ?? item.Value ?? 0);
        if (type === types.Tiberium) result.tiberium += amount;
        else if (type === types.Crystal || type === types.Chrystal) result.crystal += amount;
        else if (type === types.Power) result.power += amount;
      }
      return result;
    };
    const buildings = values(call(city, ['get_Buildings'])).map((building) => {
      const data = call(building, ['get_UnitGameData_Obj', 'get_TechGameData_Obj']);
      const x = Number(call(building, ['get_CoordX', 'get_X']) ?? 0);
      const y = Number(call(building, ['get_CoordY', 'get_Y']) ?? 0);
      const level = Number(call(building, ['get_CurrentLevel', 'get_Level']) ?? 0);
      const requirements = call(this.root()?.Base?.Util, [
        'GetUnitLevelResourceRequirements_Obj', 'GetTechLevelResourceRequirements_Obj'
      ], level + 1, data);
      return Object.freeze({
        id: call(building, ['get_Id']) ?? `${x}:${y}`,
        mdbId: call(building, ['get_MdbBuildingId', 'get_MdbUnitId']),
        name: call(data, ['get_Name', 'get_DisplayName', 'get_dn']) ?? data?.dn ?? data?.n ?? 'Building',
        level,
        x, y, resourceType: Number(call(city, ['GetResourceType'], x, y) ?? 0),
        upgradeCost: Object.freeze(normalizeCosts(requirements)), raw: building
      });
    });
    const resourceFields = [];
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 9; x += 1) {
      const type = Number(call(city, ['GetResourceType'], x, y) ?? 0);
      if (type) resourceFields.push(Object.freeze({ x, y, type }));
    }
    return Object.freeze({
      cityId: String(call(city, ['get_Id', 'get_CityId']) ?? ''),
      cityName: String(call(city, ['get_Name']) ?? 'Current base'),
      buildings: Object.freeze(buildings), production: Object.freeze(production), storage: Object.freeze(storage),
      resourceFields: Object.freeze(resourceFields)
    });
  }

  async applyLayout(plan) {
    const snapshot = this.snapshot();
    if (String(plan?.cityId) !== snapshot.cityId) throw new Error('The active base changed after this layout was calculated.');
    if (!Array.isArray(plan.changes) || !plan.changes.length) throw new Error('This proposal has no building moves.');
    const manager = this.root()?.Net?.CommunicationManager?.GetInstance?.();
    if (!manager?.SendCommand) throw new Error('The native building-move command is unavailable.');
    for (const move of plan.changes) {
      const building = snapshot.buildings.find((item) => String(item.id) === String(move.id));
      if (!building || building.x !== move.fromX || building.y !== move.fromY) {
        throw new Error(`Building state changed before moving ${move.name}. Recalculate the layout.`);
      }
    }
    const submitted = new Set();
    let count = 0;
    for (const move of plan.changes) {
      if (submitted.has(String(move.id))) continue;
      manager.SendCommand('MoveBuilding', {
        cityid: snapshot.cityId,
        buildingid: move.id,
        posX: move.fromX,
        posY: move.fromY,
        newPosX: move.toX,
        newPosY: move.toY,
        x: move.toX,
        y: move.toY
      }, null, null, true);
      submitted.add(String(move.id));
      const inverse = plan.changes.find((candidate) =>
        candidate.fromX === move.toX && candidate.fromY === move.toY
        && candidate.toX === move.fromX && candidate.toY === move.fromY
      );
      if (inverse) submitted.add(String(inverse.id));
      count += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return count;
  }
}

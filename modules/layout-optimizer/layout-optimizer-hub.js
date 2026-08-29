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

export function planMoveCommands(buildings, changes) {
  const positions = new Map(buildings.map((building) => [String(building.id), {
    id: building.id,
    name: building.name,
    x: building.x,
    y: building.y
  }]));
  const occupant = new Map([...positions.values()].map((building) => [`${building.x}:${building.y}`, building]));
  const targets = new Map(changes.map((move) => [String(move.id), { x: move.toX, y: move.toY }]));
  const commands = [];
  const pending = () => [...targets].filter(([id, target]) => {
    const building = positions.get(id);
    return building && (building.x !== target.x || building.y !== target.y);
  });
  while (pending().length) {
    const [id, target] = pending()[0];
    const building = positions.get(id);
    const fromX = building.x;
    const fromY = building.y;
    const displaced = occupant.get(`${target.x}:${target.y}`);
    commands.push({ id: building.id, name: building.name, fromX, fromY, toX: target.x, toY: target.y });
    occupant.delete(`${fromX}:${fromY}`);
    if (displaced) {
      displaced.x = fromX;
      displaced.y = fromY;
      occupant.set(`${fromX}:${fromY}`, displaced);
    }
    building.x = target.x;
    building.y = target.y;
    occupant.set(`${target.x}:${target.y}`, building);
    if (commands.length > changes.length * 2) throw new Error('Unable to resolve the proposed building arrangement.');
  }
  return commands;
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
    const packageProduction = {};
    const storage = {};
    const types = this.root()?.Base?.EResourceType ?? {};
    for (const [key, type] of [['tiberium', types.Tiberium], ['crystal', types.Crystal ?? types.Chrystal], ['power', types.Power], ['credits', types.Credits ?? types.Gold]]) {
      if (key === 'credits') {
        const creditsProduction = call(city, ['get_CityCreditsProduction']);
        const resourceApi = this.root()?.Base?.Resource;
        const nativeContinuous = creditsProduction == null ? null
          : call(resourceApi, ['GetResourceGrowPerHour'], creditsProduction, false);
        const nativePackage = creditsProduction == null ? null
          : call(resourceApi, ['GetResourceBonusGrowPerHour'], creditsProduction, false);
        production[key] = Number(nativeContinuous ?? call(
          city, ['GetResourceGrowPerHour', 'GetResourceProductionPerHour'], type, false, false
        ) ?? 0);
        packageProduction[key] = Number(nativePackage ?? call(
          city, ['GetResourceBonusGrowPerHour'], type, false, false
        ) ?? 0);
      } else {
        production[key] = Number(call(
          city, ['GetResourceGrowPerHour', 'GetResourceProductionPerHour'], type, false, false
        ) ?? 0);
        packageProduction[key] = Number(call(
          city, ['GetResourceBonusGrowPerHour'], type, false, false
        ) ?? 0);
      }
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
    const buildingsData = call(city, ['get_CityBuildingsData', 'get_BuildingsData']);
    const directBuildings = values(call(city, ['get_Buildings']));
    const buildingList = directBuildings.length
      ? directBuildings
      : values(call(buildingsData, ['get_AllBuildings', 'get_Buildings']));
    const buildings = buildingList.map((building) => {
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
      buildings: Object.freeze(buildings), production: Object.freeze(production),
      packageProduction: Object.freeze(packageProduction), storage: Object.freeze(storage),
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
    const commands = planMoveCommands(snapshot.buildings, plan.changes);
    for (const move of commands) {
      await this.sendMove(manager, snapshot.cityId, move);
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = this.snapshot();
      const complete = plan.changes.every((move) => {
        const building = current.buildings.find((item) => String(item.id) === String(move.id));
        return building?.x === move.toX && building?.y === move.toY;
      });
      if (complete) return commands.length;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('The game accepted the moves, but the resulting layout does not match the proposal. Refresh and recalculate before trying again.');
  }

  sendMove(manager, cityId, move) {
    return new Promise((resolve, reject) => {
      try {
        manager.SendCommand('MoveBuilding', {
          cityid: cityId,
          buildingid: move.id,
          posX: move.fromX,
          posY: move.fromY,
          newPosX: move.toX,
          newPosY: move.toY,
          x: move.toX,
          y: move.toY
        }, null, null, true);
      } catch (error) {
        reject(error);
        return;
      }
      let attempts = 0;
      const verify = () => {
        const building = this.snapshot().buildings.find((item) => String(item.id) === String(move.id));
        if (building?.x === move.toX && building?.y === move.toY) {
          resolve();
          return;
        }
        attempts += 1;
        if (attempts >= 40) {
          reject(new Error(`Moving ${move.name} was not reflected by the game. Refresh and recalculate the layout.`));
          return;
        }
        setTimeout(verify, 250);
      };
      setTimeout(verify, 250);
    });
  }
}

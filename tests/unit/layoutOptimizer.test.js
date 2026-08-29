import test from 'node:test';
import assert from 'node:assert/strict';
import { LayoutOptimizer } from '../../modules/layout-optimizer/layout-optimizer.js';
import { LayoutOptimizerHub, planMoveCommands } from '../../modules/layout-optimizer/layout-optimizer-hub.js';

const buildings = [
  { id: 'h1', name: 'Harvester', level: 20, x: 0, y: 0, resourceType: 1 },
  { id: 'h2', name: 'Harvester', level: 20, x: 8, y: 7, resourceType: 2 },
  { id: 'r', name: 'Refinery', level: 20, x: 7, y: 7, resourceType: 0 },
  { id: 'p', name: 'Power Plant', level: 20, x: 1, y: 0, resourceType: 0 },
  { id: 'a', name: 'Accumulator', level: 20, x: 4, y: 4, resourceType: 0 }
];

test('LayoutOptimizer returns a ranked visual proposal within move limits', () => {
  const result = LayoutOptimizer.optimize({
    buildings,
    production: { tiberium: 1000, crystal: 900, power: 800 }
  }, {
    weights: { tiberium: 25, crystal: 25, power: 25, credits: 25 },
    maximumMoves: 4,
    maximumReplacements: 0,
    fixedIds: new Set(['h1']),
    replacementIds: new Set()
  });
  assert.ok(result.ranked.length >= 1);
  assert.ok(result.best.changes.length <= 4);
  assert.equal(result.best.layout.find((item) => item.id === 'h1').x, 0);
  assert.equal(result.best.layout.length, buildings.length);
  assert.ok(result.production.tiberium);
});

test('LayoutOptimizer validates user production percentages without storage', () => {
  const result = LayoutOptimizer.optimize({ buildings, production: { tiberium: 1, crystal: 1, power: 1 } }, {
    weights: { tiberium: 40, crystal: 30, power: 20, credits: 5 },
    maximumMoves: 0,
    maximumReplacements: 0,
    fixedIds: new Set(),
    replacementIds: new Set()
  });
  assert.ok(result.conflicts.some((message) => message.includes('total 95%')));
  assert.equal('storage' in result, false);
});

test('LayoutOptimizer searches legal empty spots using the user production weights', () => {
  const result = LayoutOptimizer.optimize({
    buildings: [
      { id: 'harvester', name: 'Harvester', level: 20, x: 0, y: 0, resourceType: 2 },
      { id: 'refinery', name: 'Refinery', level: 20, x: 8, y: 7, resourceType: 0 }
    ],
    resourceFields: [{ x: 0, y: 0, type: 2 }],
    production: { tiberium: 1000, crystal: 500, power: 300, credits: 200 }
  }, {
    weights: { tiberium: 0, crystal: 0, power: 0, credits: 100 },
    maximumMoves: 1,
    maximumReplacements: 0,
    fixedIds: new Set(['harvester']),
    replacementIds: new Set()
  });

  const refinery = result.best.layout.find((building) => building.id === 'refinery');
  assert.equal(result.best.changes.length, 1);
  assert.ok(Math.abs(refinery.x) <= 1 && Math.abs(refinery.y) <= 1);
  assert.notDeepEqual({ x: refinery.x, y: refinery.y }, { x: 0, y: 0 });
  assert.ok(result.best.value > result.current.value);
});

test('LayoutOptimizerHub reads buildings from CityBuildingsData when the city has no direct collection', () => {
  const building = {
    get_Id: () => 91,
    get_CoordX: () => 3,
    get_CoordY: () => 4,
    get_CurrentLevel: () => 17,
    get_UnitGameData_Obj: () => ({ get_Name: () => 'Harvester' })
  };
  const city = {
    get_Id: () => 42,
    get_Name: () => 'Test Base',
    get_CityBuildingsData: () => ({ get_Buildings: () => ({ d: { 91: building } }) }),
    GetResourceType: (x, y) => x === 3 && y === 4 ? 2 : 0
  };
  const root = { Base: { EResourceType: { Tiberium: 1, Crystal: 2, Power: 3, Gold: 4 }, Util: {} } };
  const clientLib = {
    root,
    getMainData: () => ({ get_Cities: () => ({ get_CurrentOwnCity: () => city }) })
  };
  const hub = new LayoutOptimizerHub({ hub: { game: { services: { tryGet: () => clientLib } } } });

  const snapshot = hub.snapshot();

  assert.equal(snapshot.cityName, 'Test Base');
  assert.equal(snapshot.buildings.length, 1);
  assert.deepEqual(
    { id: snapshot.buildings[0].id, x: snapshot.buildings[0].x, y: snapshot.buildings[0].y },
    { id: 91, x: 3, y: 4 }
  );
});

test('LayoutOptimizerHub imports current hourly production with the native calculation flags', () => {
  const calls = [];
  const city = {
    get_Id: () => 42,
    get_Name: () => 'Production Base',
    get_Buildings: () => ({ d: {} }),
    GetResourceType: () => 0,
    GetResourceGrowPerHour: (...args) => {
      calls.push(args);
      return { 1: 1200, 2: 800, 3: 450, 4: 600 }[args[0]];
    }
  };
  const root = { Base: { EResourceType: { Tiberium: 1, Crystal: 2, Power: 3, Gold: 4 }, Util: {} } };
  const clientLib = {
    root,
    getMainData: () => ({ get_Cities: () => ({ get_CurrentOwnCity: () => city }) })
  };
  const hub = new LayoutOptimizerHub({ hub: { game: { services: { tryGet: () => clientLib } } } });

  const snapshot = hub.snapshot();

  assert.deepEqual(snapshot.production, { tiberium: 1200, crystal: 800, power: 450, credits: 600 });
  assert.deepEqual(snapshot.packageProduction, { tiberium: 0, crystal: 0, power: 0, credits: 0 });
  assert.deepEqual(calls, [[1, false, false], [2, false, false], [3, false, false], [4, false, false]]);
});

test('LayoutOptimizerHub reads credit production and package bonuses from the native credits object', () => {
  const creditsProduction = { id: 'credits' };
  const city = {
    get_Id: () => 42,
    get_Name: () => 'Credit Base',
    get_Buildings: () => ({ d: {} }),
    GetResourceType: () => 0,
    GetResourceGrowPerHour: (type) => ({ 1: 100, 2: 200, 3: 300, 4: 1 })[type] ?? 0,
    GetResourceBonusGrowPerHour: (type) => ({ 1: 10, 2: 20, 3: 30, 4: 2 })[type] ?? 0,
    get_CityCreditsProduction: () => creditsProduction
  };
  const root = {
    Base: {
      EResourceType: { Tiberium: 1, Crystal: 2, Power: 3, Credits: 4 },
      Resource: {
        GetResourceGrowPerHour: (production) => production === creditsProduction ? 900 : 0,
        GetResourceBonusGrowPerHour: (production) => production === creditsProduction ? 90 : 0
      },
      Util: {}
    }
  };
  const clientLib = {
    root,
    getMainData: () => ({ get_Cities: () => ({ get_CurrentOwnCity: () => city }) })
  };
  const snapshot = new LayoutOptimizerHub({ hub: { game: { services: { tryGet: () => clientLib } } } }).snapshot();

  assert.deepEqual(snapshot.production, { tiberium: 100, crystal: 200, power: 300, credits: 900 });
  assert.deepEqual(snapshot.packageProduction, { tiberium: 10, crystal: 20, power: 30, credits: 90 });
});

test('building move execution resolves multi-building cycles into live swaps', () => {
  const commands = planMoveCommands([
    { id: 'a', name: 'A', x: 0, y: 0 },
    { id: 'b', name: 'B', x: 1, y: 0 },
    { id: 'c', name: 'C', x: 2, y: 0 }
  ], [
    { id: 'a', toX: 1, toY: 0 },
    { id: 'b', toX: 2, toY: 0 },
    { id: 'c', toX: 0, toY: 0 }
  ]);

  assert.deepEqual(commands, [
    { id: 'a', name: 'A', fromX: 0, fromY: 0, toX: 1, toY: 0 },
    { id: 'b', name: 'B', fromX: 0, fromY: 0, toX: 2, toY: 0 }
  ]);
});

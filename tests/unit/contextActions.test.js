import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, describeSelection } from '../../modules/context-actions/context-actions-panel.js';
import { StrategicPlanner } from '../../modules/context-actions/strategic-planner.js';
import { findShiftedMember, validPreviewMoveDestination } from '../../modules/context-actions/strategic-map-planner.js';

const root = {
  Vis: {
    Region: { RegionCity: { ERegionCityType: { Own: 1, Alliance: 2, Enemy: 3 } } },
    VisObject: { EObjectType: { RegionCityType: 10, RegionNPCBase: 11, RegionNPCCamp: 12 } }
  }
};

test('Context Actions identifies an owned base', () => {
  const result = describeSelection({
    get_Id: () => 7, get_Name: () => 'Genesis', get_Type: () => 1,
    get_VisObjectType: () => 10, get_RawX: () => 100, get_RawY: () => 200
  }, root);
  assert.equal(result.category, 'own');
  assert.equal(result.name, 'Genesis');
  assert.equal(result.validCoordinates, true);
});

test('Context Actions identifies a Forgotten camp', () => {
  const result = describeSelection({
    get_Id: () => 8, get_VisObjectType: () => 12,
    get_RawX: () => 101, get_RawY: () => 201
  }, root);
  assert.equal(result.category, 'target');
  assert.equal(result.type, 'Camp');
});

test('Context Actions exposes add and remove Suite markers for map targets', () => {
  const add = ACTIONS.find((action) => action.action === 'marker-add');
  const remove = ACTIONS.find((action) => action.action === 'marker-remove');
  assert.deepEqual(add.types, ['Base', 'Forgotten Base', 'Camp', 'Outpost']);
  assert.equal(remove.transient, 'marker-exists');
  assert.ok(remove.scopes.includes('own'));
});

test('Strategic map discovery accepts current minifier member names and hexadecimal shifts', () => {
  assert.equal(findShiftedMember('function(a){this.ab$12=((a >>> 0x12) & 0xf);}', [18]), 'ab$12');
  assert.equal(findShiftedMember('function(a){this.long_member=(a>>17)&15}', [17]), 'long_member');
});

test('non-owned move planning validates the destination without account distance', () => {
  const options = {
    from: { x: 100, y: 100 }, to: { x: 103, y: 100 },
    sectorAt: () => ({}), objectAt: () => null
  };
  assert.equal(validPreviewMoveDestination(options), true);
  assert.equal(validPreviewMoveDestination({ ...options, to: options.from }), false);
  assert.equal(validPreviewMoveDestination({ ...options, objectAt: () => ({ Type: 'City' }) }), false);
  assert.equal(validPreviewMoveDestination({ ...options, sectorAt: () => null }), false);
});

function plannerContext() {
  const saved = new Map();
  const tunnel = {
    Type: 4, get_Type: () => 0, get_Level: () => 25,
    constructor: { name: 'WorldObjectPointOfInterest' }
  };
  const world = { GetObjectFromPosition: (x, y) => x === 104 && y === 100 ? tunnel : null };
  const city = { get_LvlOffense: () => 17 };
  const main = {
    get_World: () => world,
    get_Cities: () => ({ get_CurrentOwnCity: () => city }),
    get_Alliance: () => ({ get_Announcement: () => 'Planning [tir]7[/tir]' }),
    get_Server: () => ({ get_POIActivationLevelDifference: () => 5 })
  };
  const clientRoot = {
    Data: {
      MainData: { GetInstance: () => main },
      WorldSector: { ObjectType: { PointOfInterest: 4 } }
    }
  };
  return {
    storage: {
      get: async (key, fallback) => saved.get(key) ?? fallback,
      set: async (key, value) => saved.set(key, value)
    },
    hub: { game: { services: { tryGet: () => ({ root: clientRoot }) } } }
  };
}

test('Strategic Planner preserves projected changes and supports undo/reset', async () => {
  const planner = new StrategicPlanner(plannerContext());
  await planner.load();
  const selection = { id: 7, name: 'Genesis', type: 'Base', category: 'own', level: 20, x: 100, y: 100, validCoordinates: true };
  planner.add('move', selection, { x: 101, y: 102 });
  planner.add('level', selection, { level: 22 });
  assert.equal(planner.analysis(selection).operations.length, 2);
  assert.equal(planner.analysis(selection).projected[0].level, 22);
  assert.equal(planner.analysis(selection).projected[0].x, 101);
  assert.notEqual(planner.historyHash(), '00000000');
  planner.undo();
  assert.equal(planner.analysis(selection).operations.length, 1);
  planner.reset();
  assert.equal(planner.analysis(selection).operations.length, 0);
});

test('Strategic Planner reads alliance tunnel range and calculates offense requirement', () => {
  const planner = new StrategicPlanner(plannerContext());
  const tunnels = planner.tunnelAnalysis(100, 100);
  assert.equal(planner.tunnelInfluenceRange(), 7);
  assert.equal(tunnels.length, 1);
  assert.equal(tunnels[0].requiredOffense, 20);
  assert.equal(tunnels[0].usable, false);
});

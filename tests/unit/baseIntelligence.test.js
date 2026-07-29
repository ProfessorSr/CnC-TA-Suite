import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseIntelligenceHub } from '../../modules/base-intelligence/base-intelligence-hub.js';

test('BaseIntelligenceHub derives resource production and time to cap', () => {
  const resourceTypes = { Tiberium: 1, Crystal: 2, Power: 3, Gold: 4, RepairChargeInf: 5, RepairChargeVeh: 6, RepairChargeAir: 7 };
  const city = {
    get_Id: () => 1, get_Name: () => 'Genesis', get_PosX: () => 10, get_PosY: () => 20,
    get_LvlBase: () => 30, get_LvlOffense: () => 29, get_LvlDefense: () => 28,
    get_Buildings: () => ({ d: {} }), get_CityUnitsData: () => ({ get_OffenseUnits: () => ({ d: {} }), get_DefenseUnits: () => ({ d: {} }), GetRepairTimeFromEUnitGroup: () => 0 }),
    get_CityBuildingsData: () => ({ get_HasCollectableBuildings: () => false }),
    GetResourceCount: (type) => type === 1 ? 500 : 0,
    GetResourceMaxStorage: (type) => type === 1 ? 1000 : 0,
    GetResourceGrowPerHour: (type) => type === 1 ? 100 : 0,
    GetResourceBonusGrowPerHour: () => 0
  };
  const client = { root: { Base: { EResourceType: resourceTypes }, Data: { EUnitGroup: {} } }, getMainData: () => ({ get_Cities: () => ({ get_AllCities: () => ({ d: { 1: city } }), get_CurrentOwnCity: () => city }) }), getPlayer: () => ({}) };
  const hub = new BaseIntelligenceHub({ hub: { game: { services: { tryGet: () => client } }, snapshot: () => ({}) } });
  const snapshot = hub.snapshot();
  assert.equal(snapshot.current.name, 'Genesis');
  assert.equal(snapshot.current.resources.tiberium.perHour, 100);
  assert.equal(snapshot.current.resources.tiberium.timeToCapSeconds, 18000);
});

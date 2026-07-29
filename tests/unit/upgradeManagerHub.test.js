import test from 'node:test';
import assert from 'node:assert/strict';
import { UpgradeManagerHub } from '../../modules/upgrade-manager/upgrade-manager-hub.js';

test('Quick Upgrade suggests one level above the lowest healthy eligible item', () => {
  const hub = new UpgradeManagerHub({});
  hub.root = () => ({
    Data: { MainData: { GetInstance: () => ({ get_Server: () => ({ get_PlayerUpgradeCap: () => 80 }) }) } }
  });
  hub.currentCity = () => ({});
  hub.cityId = () => 'home';
  hub.candidates = () => [22, 15, 12].map((level) => ({
    cityId: 'home', category: 'buildings', level, damaged: false, locked: false
  }));
  assert.equal(hub.lowestUpgradeableLevel('buildings'), 13);
});

test('Target-level building upgrades use the native target-level API once', () => {
  const calls = [];
  const hub = new UpgradeManagerHub({});
  hub.currentCity = () => ({ id: 'home' });
  hub.cityId = (city) => city.id ?? 'home';
  hub.scopeApi = () => ({ UpgradeBuildingToLevel: (details, level) => calls.push({ details, level }) });
  const details = { id: 7 };
  const result = hub.upgradeCandidateToLevel({
    cityId: 'home', category: 'buildings', level: 5, damaged: false, locked: false,
    entity: { get_BuildingDetails: () => details }
  }, 16);
  assert.equal(result.success, true);
  assert.deepEqual(calls, [{ details, level: 16 }]);
});

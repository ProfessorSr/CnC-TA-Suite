import test from 'node:test';
import assert from 'node:assert/strict';
import { UpgradeManagerHub } from '../../modules/upgrade-manager/upgrade-manager-hub.js';
import { resourceIdsForScope, resourceWait } from '../../modules/upgrade-manager/quick-upgrade-window.js';

test('Quick Upgrade formats resource wait time', () => {
  assert.equal(resourceWait(0), 'Ready');
  assert.equal(resourceWait(3661), '1h 2m');
  assert.equal(resourceWait(Infinity), 'No production');
});

test('Quick Upgrade shows only resources used by each upgrade scope', () => {
  assert.deepEqual(resourceIdsForScope('buildings'), ['tiberium', 'power']);
  assert.deepEqual(resourceIdsForScope('offense'), ['crystal', 'power']);
  assert.deepEqual(resourceIdsForScope('defense'), ['tiberium', 'crystal', 'power']);
});

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

test('Overview building upgrade uses the native API for the current base', () => {
  const calls = [];
  const details = { id: 9 };
  const hub = new UpgradeManagerHub({});
  hub.currentCity = () => ({ id: 'home' });
  hub.cityId = (city) => city.id;
  hub.root = () => ({
    API: { City: { GetInstance: () => ({ UpgradeBuildingToLevel: (target, level) => calls.push({ target, level }) }) } }
  });
  const result = hub.upgrade({
    cityId: 'home', category: 'buildings', nextLevel: 8, affordable: true,
    damaged: false, locked: false, entity: { get_BuildingDetails: () => details }
  });
  assert.equal(result.success, true);
  assert.deepEqual(calls, [{ target: details, level: 8 }]);
});

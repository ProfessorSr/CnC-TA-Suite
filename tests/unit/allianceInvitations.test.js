import test from 'node:test';
import assert from 'node:assert/strict';
import { AllianceHub, allianceCreateMarkerArguments } from '../../modules/alliance/alliance-hub.js';

function hubWith(response) {
  const hub = new AllianceHub({});
  hub.root = () => ({ Data: { Ranking: { EViewType: { Player: 0 }, ERankingType: { Score: 0 } } } });
  hub.command = async () => response;
  return hub;
}

test('Alliance invitation search normalizes ranked player data', async () => {
  const hub = hubWith({ p: [
    { p: 42, pn: 'Alpha', r: 3, s: 9000, bc: 4, ol: 31, dl: 29, a: 7, an: 'Seven' },
    { p: 84, pn: 'Solo', r: 8, s: 5000, bc: 2, ol: 24, dl: 20, a: 0, an: '' }
  ] });
  const players = await hub.searchPlayers({ mode: 'top', limit: 100 });
  assert.deepEqual(players[0], {
    id: '42', name: 'Alpha', rank: 3, score: 9000, bases: 4,
    offense: 31, defense: 29, allianceId: '7', alliance: 'Seven', faction: ''
  });
});

test('Alliance invitation search filters unaffiliated and specified-alliance players', async () => {
  const response = { p: [
    { p: 1, pn: 'Member', a: 7, an: 'Seven' },
    { p: 2, pn: 'Solo', a: 0, an: '' }
  ] };
  assert.deepEqual((await hubWith(response).searchPlayers({ mode: 'no-alliance' })).map((p) => p.name), ['Solo']);
  assert.deepEqual((await hubWith(response).searchPlayers({ mode: 'alliance', allianceId: '7' })).map((p) => p.name), ['Member']);
});

test('private alliance markers persist locally and remain scoped to the current world', async () => {
  const stored = [];
  const server = { get_WorldId: () => 77 };
  const client = { root: {}, getMainData: () => ({ get_Server: () => server }) };
  const context = {
    hub: { game: { services: { tryGet: () => client } } },
    storage: {
      get: async () => stored,
      set: async (_key, value) => { stored.splice(0, stored.length, ...value); }
    },
    eventBus: { emit() {} }
  };
  const hub = new AllianceHub(context);
  await hub.privateMarkersReady;
  const marker = await hub.addPrivateMarker({ x: 123, y: 456, label: 'My target', color: '#ffcc33' });
  assert.equal(hub.privateMarkers().length, 1);
  assert.equal(stored[0].world, '77');
  assert.equal(stored[0].label, 'My target');
  server.get_WorldId = () => 88;
  assert.equal(hub.privateMarkers().length, 0);
  server.get_WorldId = () => 77;
  await hub.deletePrivateMarker(marker.id);
  assert.equal(stored.length, 0);
});

test('shared Suite markers use and decode the native alliance marker channel', async () => {
  let created = null;
  const markerRows = [];
  const alliance = {
    CreateMarker: (x, y, type, description) => {
      created = [x, y, type, description];
      markerRows.push({
        get_Id: () => 88, get_CoordX: () => x, get_CoordY: () => y,
        get_Type: () => type, get_NamePlayerCreated: () => 'Commander', get_Description: () => description
      });
    },
    get_Markers: () => ({ l: markerRows })
  };
  const client = { root: {}, getMainData: () => ({ get_Server: () => ({ get_WorldId: () => 9 }), get_Alliance: () => alliance }) };
  const hub = new AllianceHub({
    hub: { game: { services: { tryGet: () => client } } },
    storage: { get: async () => [], set: async () => {} }, eventBus: { emit() {} }
  });
  await hub.privateMarkersReady;
  await hub.addSharedSuiteMarker({ x: 12, y: 34, label: 'Rally', color: '#45d7ff' });
  assert.deepEqual(created.slice(0, 3), [12, 34, 1]);
  assert.match(created[3], /^\[CNC-TA-SUITE:v1\]/);
  const shared = hub.sharedSuiteMarkers();
  assert.equal(shared[0].label, 'Rally');
  assert.equal(shared[0].scope, 'Alliance Suite');
  assert.equal(shared[0].nativeId, '88');
});

test('alliance marker argument adapter follows minified native payload fields', () => {
  const native = function (a, b, c, d) { return { t: a, x: b, y: c, d: d }; };
  assert.deepEqual(allianceCreateMarkerArguments(native, {
    x: 10, y: 20, type: 3, description: 'Marker'
  }), [3, 10, 20, 'Marker']);
});

test('POI analysis maps rank rows sequentially from the native ranked-type boundary', () => {
  const bonusTypes = [];
  const hub = new AllianceHub({});
  hub.alliance = () => ({
    get_POIRankScore: () => Array.from({ length: 7 }, () => ({ s: 900, r: 12 })),
    get_POITiberiumBonus: () => 1
  });
  hub.main = () => ({ get_Server: () => ({ get_POIGlobalBonusFactor: () => 1 }) });
  hub.root = () => ({ Base: {
    EPOIType: { RankedTypeBegin: 20 },
    PointOfInterestTypes: {
      GetPOITypeFromPOIRanking: () => 999,
      GetNextScore: () => 1200,
      GetPreviousScore: () => 600,
      GetBoostModifierByRank: () => 51,
      GetBonusByType: (type) => { bonusTypes.push(type); return 34.5; },
      GetTotalBonusByType: () => 52.095
    }
  } });
  const rows = hub.poiAnalysis();
  assert.deepEqual(rows.map((row) => row.typeId), [20, 21, 22, 23, 24, 25, 26]);
  assert.deepEqual([...new Set(bonusTypes)], [20, 21, 22, 23, 24, 25, 26]);
});

test('owned POI loss is positive and zero when dropping it changes no bonus', () => {
  const hub = new AllianceHub({});
  hub.previewPoiBenefit = (_type, score) => ({ totalBonus: score >= 500 ? 52.095 : 48 });
  assert.equal(hub.poiGainLoss(9, 900, -100, 12), 0);
  assert.ok(Math.abs(hub.poiGainLoss(9, 900, -500, 12) - 4.095) < 1e-9);
});

test('owned POI real loss uses the projected native total', () => {
  const hub = new AllianceHub({});
  hub.previewPoiChange = () => ({ totalBonus: 52.095 });
  assert.equal(hub.poiRealLoss({ totalBonus: 52.095 }, 900, 100), 0);
  hub.previewPoiChange = () => ({ totalBonus: 48 });
  assert.ok(Math.abs(hub.poiRealLoss({ totalBonus: 52.095 }, 900, 500) - 4.095) < 1e-9);
});

test('vehicle aircraft and defense base percentages match native precise totals', () => {
  const hub = new AllianceHub({});
  hub.alliance = () => ({ get_POIRankScore: () => Array.from({ length: 7 }, () => ({ s: 900, r: 12 })) });
  hub.main = () => ({ get_Server: () => ({ get_POIGlobalBonusFactor: () => 1 }) });
  hub.root = () => ({ Base: {
    EPOIType: { RankedTypeBegin: 4 },
    PointOfInterestTypes: {
      GetNextScore: () => 1200,
      GetPreviousScore: () => 600,
      GetBoostModifierByRank: () => 51,
      GetBonusByType: () => 19500,
      GetTotalBonusByType: (_type, _rank, score) => score === 1200 ? 58.89 : 52.095
    }
  } });
  const [vehicle, aircraft, defense] = hub.poiAnalysis().slice(4);
  for (const row of [vehicle, aircraft, defense]) {
    assert.ok(Math.abs(row.baseBonus - 34.5) < 1e-9);
    assert.ok(Math.abs(row.nextBaseBonus - 39) < 1e-9);
  }
});

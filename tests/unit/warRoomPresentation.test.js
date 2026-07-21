import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmyAnalyzer } from '../../modules/war-room/army-analyzer.js';
import { verifiedOffenseRange, WarRoomHub } from '../../modules/war-room/war-room-hub.js';
import { AttackControlsPalette } from '../../modules/war-room/attack-controls-palette.js';

test('War Room uses verified offense-range fallbacks for known GDI and NOD units', () => {
  assert.equal(verifiedOffenseRange('GDI Pitbull'), 2.5);
  assert.equal(verifiedOffenseRange('Firehawk'), 1.5);
  assert.equal(verifiedOffenseRange('Rifleman Squad'), 1.5);
  assert.equal(verifiedOffenseRange('Zone Troopers'), 1.5);
  assert.equal(verifiedOffenseRange('Missile Squad'), 1.5);
  assert.equal(verifiedOffenseRange('NOD Black Hand'), 1.5);
  assert.equal(verifiedOffenseRange('Confessor'), 2.5);
  assert.equal(verifiedOffenseRange('Avatar'), 1.5);
  assert.equal(verifiedOffenseRange('Salamander'), 2.5);
  assert.equal(verifiedOffenseRange('Specter'), 2.5);
  assert.equal(verifiedOffenseRange('Unknown unit'), null);
});

test('War Room presents ratio health as a percentage', () => {
  const rows = ArmyAnalyzer.rows({
    units: [{ name: 'Pitbull', level: 20, health: 1, x: 2, y: 1, group: 'vehicle' }]
  });
  assert.equal(rows[0][3], '100%');
});

test('Army Analyzer presents resolved range and speed without Tiberium repair cost', () => {
  const rows = ArmyAnalyzer.rows({
    resourceTypes: { Crystal: 2 },
    units: [{ name: 'Pitbull', level: 20, health: 1, x: 2, y: 1, attackRange: 2.5, speed: 3.25, repairCosts: { 2: 90 } }]
  });
  assert.equal(rows[0].length, 11);
  assert.equal(rows[0][6], '2.5');
  assert.equal(rows[0][7], '3.3');
  assert.equal(rows[0][10], 90);
});

test('Army Analyzer never renders invalid range or speed as NaN', () => {
  const row = ArmyAnalyzer.rows({ units: [{ name: 'Unit', level: 1, health: 1, x: 0, y: 0, attackRange: NaN, speed: undefined }] })[0];
  assert.equal(row[6], '—');
  assert.equal(row[7], '—');
});

test('War Room report history resolves native report and resource data', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.mainData = () => ({ get_Reports: () => ({ get_AllReports: () => [{
    get_Id: () => 91, get_Time: () => 1234, get_CityName: () => 'Genesis',
    get_TargetName: () => 'Camp 20', get_IsVictory: () => true,
    get_CommandPointCost: () => 12, get_Loot: () => [{ Type: 1, Count: 100 }]
  }] }) });
  hub.clientLib = () => ({ root: { Base: { EResourceType: { Tiberium: 1 } } } });
  const reports = hub.getCombatReports();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].ownBase, 'Genesis');
  assert.equal(reports[0].target, 'Camp 20');
  assert.equal(reports[0].loot[1], 100);
  assert.equal(reports[0].lootLabels[1], 'Tiberium');
});

test('War Room normalizes compact Raid Report loot and outgoing victories', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.clientLib = () => ({ root: { Base: { EResourceType: { Tiberium: 1, Crystal: 2, Gold: 3, ResearchPoints: 6 } } } });
  const [report] = hub.normalizeCombatReports([{
    i: 44, d: { t: 100, arr: [{ t: 1, a: 500 }, { t: 2, a: 250 }], cpc: 12, dpx: 100, dpy: 200 }
  }], 'offense');
  assert.equal(report.won, true);
  assert.equal(report.cp, 12);
  assert.equal(report.loot[1], 500);
  assert.equal(report.loot[2], 250);
  assert.equal(report.targetX, 100);
  assert.equal(report.targetY, 200);
});

test('War Room reverses attacker results for defense and keeps Total Defeat as a loss', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.clientLib = () => ({ root: {
    Base: { EResourceType: {} },
    Data: { Reports: { ECombatResult: { Defeat: 0, Victory: 1, TotalDefeat: 2 } } }
  } });
  const attackerLost = { i: 1, d: { t: 100, cr: 0 }, get_AttackerIsNPC: () => false };
  const attackerWon = { i: 2, d: { t: 101, cr: 1 }, get_AttackerIsNPC: () => false };
  const forgottenLost = { i: 3, d: { t: 102, cr: 0 }, get_AttackerIsNPC: () => true };
  const totalDefeat = { i: 4, d: { t: 103, cr: 2 }, get_AttackerIsNPC: () => true };
  assert.equal(hub.normalizeCombatReports([attackerLost], 'defense')[0].won, true);
  assert.equal(hub.normalizeCombatReports([attackerWon], 'defense')[0].won, false);
  assert.equal(hub.normalizeCombatReports([forgottenLost], 'forgotten')[0].won, true);
  assert.equal(hub.normalizeCombatReports([totalDefeat], 'forgotten')[0].won, false);
  assert.equal(hub.normalizeCombatReports([attackerLost], 'forgotten').length, 1);
});

test('War Room never falls back to another report category cache', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.clientLib = () => ({ root: { Base: { EResourceType: {} } } });
  hub.reportCaches.set('offense', [{ i: 10, d: { t: 100 } }]);
  hub.reportCache = hub.reportCaches.get('offense');
  hub.reportCacheCategory = 'offense';
  assert.equal(hub.getCombatReports('defense').length, 0);
});

test('War Room requests native offense report headers and delivered reports', async () => {
  const originalWebfrontend = globalThis.webfrontend;
  let headersDelegate;
  let reportDelegate;
  const reports = [
    { get_Id: () => 1, get_Time: () => 100, get_AttackerBaseName: () => 'Genesis', get_DefenderBaseName: () => 'Camp 20' },
    { get_Id: () => 2, get_Time: () => 200, get_AttackerBaseName: () => 'Alpha', get_DefenderBaseName: () => 'Outpost 21' }
  ];
  const manager = {
    add_ReportsDelivered: (delegate) => { headersDelegate = delegate; },
    remove_ReportsDelivered: () => {},
    add_ReportDelivered: (delegate) => { reportDelegate = delegate; },
    remove_ReportDelivered: () => {},
    RequestReportHeaderDataAll: () => headersDelegate(reports),
    RequestReportData: (id) => reportDelegate(reports.find((report) => report.get_Id() === id))
  };
  const hub = new WarRoomHub({ hub: {} });
  hub.mainData = () => ({ get_Reports: () => manager });
  hub.clientLib = () => ({ root: {
    Base: { EResourceType: { Tiberium: 1 } },
    Data: { Reports: {
      EPlayerReportType: { CombatOffense: 7 }, ESortColumn: { Time: 1 },
      ReportsDelivered: class {}, ReportDelivered: class {}
    } },
    Net: {
      CommandResult: class {},
      CommunicationManager: { GetInstance: () => ({
        SendSimpleCommand: (_name, _payload, callback) => callback(null, 2)
      }) }
    }
  } });
  globalThis.webfrontend = { phe: { cnc: { Util: {
    createEventDelegate: (_type, receiver, method) => method.bind(receiver)
  } } } };
  try {
    const loaded = await hub.refreshCombatReports();
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].target, 'Outpost 21');
    assert.equal(loaded[1].ownBase, 'Genesis');
  } finally {
    globalThis.webfrontend = originalWebfrontend;
  }
});

test('War Room offense-base list deduplicates cities and reads native d unit collections', () => {
  const unit = {
    get_Id: () => 7, get_MdbUnitId: () => 70, get_CurrentLevel: () => 12,
    get_UnitGameData_Obj: () => ({ dn: 'Paladin', mt: 2 })
  };
  const city = {
    get_Id: () => 11, get_Name: () => 'Alpha', get_PosX: () => 10, get_PosY: () => 20,
    get_CityBuildingsData: () => ({ GetUniqueBuildingByTechName: () => ({ get_CurrentLevel: () => 13 }) }),
    get_CityUnitsData: () => ({ get_OffenseUnits: () => ({ d: { 7: unit } }) })
  };
  const hub = new WarRoomHub({ hub: {} });
  hub.mainData = () => ({ get_Cities: () => ({ get_AllCities: () => ({ d: { 11: city, duplicate: city } }) }) });
  hub.clientLib = () => ({ root: { Base: {
    ETechName: { Command_Center: 1 }, EResourceType: {}, EUnitMovementType: {}, EArmorType: {}
  } } });
  const bases = hub.offenseBases();
  assert.equal(bases.length, 1);
  assert.equal(bases[0].name, 'Alpha');
  assert.equal(bases[0].units.length, 1);
  assert.equal(bases[0].units[0].name, 'Paladin');
});

test('War Room accepts Qooxdoo-shaped native simulation event collections', async () => {
  const originalWebfrontend = globalThis.webfrontend;
  const hub = new WarRoomHub({ hub: {} });
  hub.snapshot = () => ({ target: { id: 22 }, attacker: { id: 11 } });
  const event = { Key: 1, Value: { h: 100 } };
  const communication = {
    SendSimpleCommand(_name, _payload, callback) {
      callback(null, { d: { s: [], d: [], a: [] }, e: { l: [event] } });
    }
  };
  hub.clientLib = () => ({
    root: {
      Net: {
        CommunicationManager: { GetInstance: () => communication },
        CommandResult: {}
      }
    }
  });
  globalThis.webfrontend = {
    phe: { cnc: { Util: { createEventDelegate: (_type, receiver, method) => method.bind(receiver) } } }
  };
  try {
    const result = await hub.simulateFormation([
      { entityId: 7, enabled: true, health: 100, x: 2, y: 1 }
    ]);
    assert.deepEqual(result.e, [event]);
  } finally {
    globalThis.webfrontend = originalWebfrontend;
  }
});

test('Formation palette simulation uses the native active-formation API', async () => {
  const payload = { d: { a: [] }, e: { l: [{ Value: { h: 90 } }] } };
  let listener;
  let removed = false;
  const api = {
    addListener(_name, callback) { listener = callback; },
    removeListener() { removed = true; },
    SimulateBattle() { listener({ getData: () => payload }); }
  };
  const hub = new WarRoomHub({ hub: {} });
  hub.snapshot = () => ({ target: { id: 22 }, attacker: { id: 11 }, units: [{ entityId: 7 }] });
  hub.clientLib = () => ({ root: { API: { Battleground: { GetInstance: () => api } } } });
  const result = await hub.simulateActiveFormation();
  assert.deepEqual(result.e, [{ Value: { h: 90 } }]);
  assert.equal(removed, true);
});

test('Formation palette refreshes Reset baseline when attack targets change in place', () => {
  let targetId = 2;
  let captures = 0;
  const hub = {
    snapshot: () => ({ attacker: { id: 1 }, target: { id: targetId }, units: [{ entityId: 7 }] }),
    captureFormation: () => ({ attackerId: 1, target: { id: targetId }, units: [], capture: ++captures }),
    selectedFormationUnitToken: () => null
  };
  const palette = new AttackControlsPalette({ context: {}, hub });
  palette.widget = { isDisposed: () => false, open() {}, show() {}, exclude() {} };
  palette.visible = false;
  palette.setVisible(true);
  targetId = 3;
  palette.setVisible(true);
  assert.equal(palette.baseline.target.id, 3);
  assert.equal(captures, 2);
});

test('War Room live formation controls transform the active grid before applying it', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.snapshot = () => ({
    target: { id: 2 }, attacker: { id: 1 },
    units: [
      { entityId: 10, id: 100, name: 'A', level: 1, x: 0, y: 0 },
      { entityId: 11, id: 101, name: 'B', level: 1, x: 8, y: 1 }
    ]
  });
  let applied;
  hub.applyRecommendedFormation = (units) => { applied = units; return units; };
  hub.transformActiveFormation('left');
  assert.deepEqual(applied.map(({ entityId, x, y }) => ({ entityId, x, y })), [
    { entityId: 10, x: 8, y: 0 },
    { entityId: 11, x: 7, y: 1 }
  ]);
  hub.transformActiveFormation('swap-1-2');
  assert.deepEqual(applied.map(({ entityId, x, y }) => ({ entityId, x, y })), [
    { entityId: 11, x: 8, y: 0 },
    { entityId: 10, x: 0, y: 1 }
  ]);
});

test('War Room live formation controls retain the active target safety identity', () => {
  const hub = new WarRoomHub({ hub: {} });
  const units = [{ entityId: 10, id: 100, name: 'A', level: 1, x: 0, y: 0 }];
  hub.snapshot = () => ({
    attacker: { id: 1, name: 'Genesis' },
    target: { id: 2, name: 'Camp 2', x: 10, y: 20, version: 3 },
    units
  });
  let preset;
  hub.applyFormation = (value) => { preset = value; return value; };
  hub.applyRecommendedFormation(units);
  assert.deepEqual(preset.target, { id: 2, name: 'Camp 2', x: 10, y: 20, version: 3 });
});

test('War Room visibility controls classify native offense movement types', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.clientLib = () => ({ root: { Base: { EUnitMovementType: {
    Feet: 1, Wheel: 2, Track: 3, Air: 4, Air2: 5
  } } } });
  assert.equal(hub.formationUnitCategory({ movementType: 1, name: 'Rifleman' }), 'infantry');
  assert.equal(hub.formationUnitCategory({ movementType: 2, name: 'Pitbull' }), 'vehicles');
  assert.equal(hub.formationUnitCategory({ movementType: 3, name: 'Predator' }), 'vehicles');
  assert.equal(hub.formationUnitCategory({ movementType: 4, name: 'Orca' }), 'aircraft');
  assert.equal(hub.formationUnitCategory({ movementType: 5, name: 'Firehawk' }), 'aircraft');
});

test('War Room single-unit mode delegates to the native attack setup control', () => {
  const originalQx = globalThis.qx;
  let executions = 0;
  const nativeDisable = { objid: 'btn_disable', execute: () => { executions += 1; } };
  const bar = { obfuscatedMember: nativeDisable, getChildren: () => [] };
  globalThis.qx = { core: { Init: { getApplication: () => ({ getArmySetupAttackBar: () => bar }) } } };
  try {
    const hub = new WarRoomHub({ hub: {} });
    assert.equal(hub.toggleNativeSingleDisableMode(), true);
    assert.equal(executions, 1);
  } finally {
    globalThis.qx = originalQx;
  }
});

test('Formation palette dispatches every button family to its intended action', async () => {
  const calls = [];
  const hub = {
    snapshot: () => ({ units: [{ entityId: 7 }] }),
    simulateFormation: async (units) => { calls.push(`simulate:${units.length}`); return { d: {} }; },
    playSimulation: () => calls.push('play'),
    applyFormation: () => calls.push('reset'),
    toggleFormationVisibility: (scope) => calls.push(`toggle:${scope}`),
    transformActiveFormation: (action) => calls.push(`transform:${action}`),
    selectedFormationUnitToken: () => null,
    toggleNativeSingleDisableMode: () => false
  };
  const palette = new AttackControlsPalette({
    context: { modules: { open: async (id) => calls.push(`open:${id}`) } },
    hub,
    onSimulate: async () => calls.push('war-room-simulate')
  });
  palette.baseline = {};
  palette.saveFormation = async () => calls.push('save');
  await palette.execute('simulate');
  await palette.execute('war-room');
  await palette.execute('reset');
  await palette.execute('save');
  await palette.execute('toggle-one');
  for (const scope of ['all', 'infantry', 'vehicles', 'aircraft']) await palette.execute(`toggle-${scope}`);
  for (const action of ['up', 'down', 'left', 'right', 'mirror-horizontal', 'mirror-vertical', 'swap-1-2', 'swap-2-3', 'swap-3-4']) {
    await palette.execute(action);
  }
  assert.deepEqual(calls, [
    'war-room-simulate', 'open:war-room', 'reset', 'save',
    'toggle:all', 'toggle:infantry', 'toggle:vehicles', 'toggle:aircraft',
    'transform:up', 'transform:down', 'transform:left', 'transform:right',
    'transform:mirror-horizontal', 'transform:mirror-vertical',
    'transform:swap-1-2', 'transform:swap-2-3', 'transform:swap-3-4'
  ]);
});

test('War Room compact row and column controls transform only their selected section', () => {
  const hub = new WarRoomHub({ hub: {} });
  hub.snapshot = () => ({ target: { id: 2 }, attacker: { id: 1 }, units: [
    { entityId: 1, id: 101, x: 0, y: 0 },
    { entityId: 2, id: 102, x: 2, y: 1 },
    { entityId: 3, id: 103, x: 2, y: 3 }
  ] });
  let applied;
  hub.applyRecommendedFormation = (units) => { applied = units; return units; };
  hub.transformFormationSection('row-right', 0);
  assert.deepEqual(applied.map(({ x, y }) => [x, y]), [[1, 0], [2, 1], [2, 3]]);
  hub.transformFormationSection('mirror-column', 2);
  assert.deepEqual(applied.map(({ x, y }) => [x, y]), [[0, 0], [2, 2], [2, 0]]);
});

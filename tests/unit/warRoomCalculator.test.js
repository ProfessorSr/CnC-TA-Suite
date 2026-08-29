import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preserveDisabledFormationPositions,
  WarRoomCalculator
} from '../../modules/war-room/war-room-calculator.js';
import { estimatePossibleAttacks } from '../../modules/war-room/war-room-hub.js';

function fixture() {
  return {
    target: { level: 25 },
    units: [
      { id: 10, name: 'Mammoth', level: 30, health: 1, x: 4, y: 0,
        repairCosts: { 1: 1000, 2: 400 } },
      { name: 'Guardian', level: 28, health: 0.9 }
    ],
    defenseUnits: [{ id: 500, name: 'Cannon', level: 25, health: 1, x: 4, y: 8 }],
    buildings: [
      { id: 112, name: 'Construction Yard', level: 25, health: 1, x: 6, requirements: [] },
      { id: 900, name: 'Defense Facility', level: 24, health: 1, x: 2, requirements: [] }
    ],
    resourceTypes: { Tiberium: 1, Crystal: 2, ResearchPoints: 3 },
    repair: { infantry: 100, vehicle: 200, aircraft: 0 },
    loot: { 3: 10_000, 6: 20_000 },
    cpCost: 10
  };
}

test('WarRoomCalculator recommends a visual formation for the selected objective', () => {
  const result = WarRoomCalculator.recommendFormation(fixture(), 'cy');
  assert.equal(result.objective.name, 'Construction Yard');
  assert.equal(result.objectiveColumn, 6);
  assert.equal(result.grid.flat().filter(Boolean).length, 2);
});

test('WarRoomCalculator produces comparable battle scenario metrics', () => {
  const result = WarRoomCalculator.simulate(fixture(), 'df');
  assert.equal(result.objective, 'Defense Facility');
  assert.ok(result.winChance >= 0 && result.winChance <= 100);
  assert.ok(result.defenderDamage >= 0 && result.defenderDamage <= 100);
  assert.ok(result.ownDamage >= 0 && result.ownDamage <= 100);
  assert.ok(result.loot > 0);
});

test('WarRoomCalculator distinguishes similarly named troop roles', () => {
  assert.equal(WarRoomCalculator.combatProfile({ name: 'Paladin' }).domain, 'air');
  assert.equal(WarRoomCalculator.combatProfile({ name: 'Pitbull' }).domain, 'vehicle');
});

test('WarRoomCalculator places ranged units behind durable front-line units', () => {
  const snapshot = fixture();
  snapshot.units = [
    { name: 'Mammoth', level: 30, health: 1 },
    { name: 'Missile Squad', level: 30, health: 1, attackRange: 2 }
  ];
  const result = WarRoomCalculator.recommendFormation(snapshot, 'cy');
  const mammothRow = result.grid.findIndex((row) => row.some((unit) => unit?.name === 'Mammoth'));
  const missileRow = result.grid.findIndex((row) => row.some((unit) => unit?.name === 'Missile Squad'));
  assert.ok(mammothRow < missileRow);
  assert.ok(Number.isFinite(result.score));
});

test('WarRoomCalculator creates distinct native-simulation candidates', () => {
  const snapshot = fixture();
  snapshot.units = snapshot.units.map((unit, index) => ({
    ...unit,
    entityId: index + 10,
    x: index,
    y: 0
  }));
  const candidates = WarRoomCalculator.candidateFormations(snapshot, 'cy');
  assert.ok(candidates.length >= 3);
  assert.equal(candidates[0].name, 'Current formation');
  assert.equal(new Set(candidates.map((candidate) => candidate.units
    .map((unit) => `${unit.entityId}:${unit.x}:${unit.y}`).sort().join('|'))).size, candidates.length);
});

test('Best Formation leaves disabled troops parked unless an enabled troop claims their cell', () => {
  const original = [
    { entityId: 1, name: 'Enabled', enabled: true, x: 0, y: 0 },
    { entityId: 2, name: 'Parked', enabled: false, x: 3, y: 1 },
    { entityId: 3, name: 'Also parked', enabled: false, x: 4, y: 1 }
  ];
  const untouched = preserveDisabledFormationPositions(original, [
    { ...original[0], x: 1, y: 0 },
    { ...original[1], x: 8, y: 3 },
    { ...original[2], x: 7, y: 3 }
  ]);
  assert.deepEqual(untouched.slice(1).map(({ x, y }) => [x, y]), [[3, 1], [4, 1]]);

  const displaced = preserveDisabledFormationPositions(original, [
    { ...original[0], x: 3, y: 1 },
    { ...original[1], x: 8, y: 3 },
    { ...original[2], x: 7, y: 3 }
  ]);
  assert.deepEqual([displaced[0].x, displaced[0].y], [3, 1]);
  assert.deepEqual([displaced[1].x, displaced[1].y], [0, 0]);
  assert.deepEqual([displaced[2].x, displaced[2].y], [4, 1]);
});

test('Best Formation candidates never move disabled troops as the initiating unit', () => {
  const snapshot = fixture();
  snapshot.units = [
    { entityId: 1, name: 'Enabled', enabled: true, level: 30, x: 0, y: 0 },
    { entityId: 2, name: 'Disabled', enabled: false, level: 99, x: 8, y: 3 }
  ];
  const candidates = WarRoomCalculator.candidateFormations(snapshot, 'cy', 25);
  assert.equal(candidates.some((candidate) => /^Move Disabled|^Swap Disabled/.test(candidate.name)), false);
  for (const candidate of candidates) {
    const enabled = candidate.units.find((unit) => unit.entityId === 1);
    const disabled = candidate.units.find((unit) => unit.entityId === 2);
    if (enabled.x === 8 && enabled.y === 3) continue;
    assert.deepEqual([disabled.x, disabled.y], [8, 3], candidate.name);
  }
});

test('WarRoomCalculator minimum-force pass includes a rearranged formation', () => {
  const snapshot = fixture();
  snapshot.units = snapshot.units.map((unit, index) => ({ ...unit, entityId: index + 10, x: index, y: 0 }));
  const candidates = WarRoomCalculator.minimumForceFormations(snapshot, 'cy');
  assert.equal(candidates[0].name, 'Current formation');
  assert.ok(candidates.some((candidate) => candidate.name === 'Objective-focused formation'));
});

test('WarRoomCalculator honors explicit best-formation simulation counts', () => {
  const snapshot = fixture();
  snapshot.units = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    entityId: index + 1,
    name: `Unit ${index + 1}`,
    level: 20 - index,
    health: 1,
    x: index % 9,
    y: Math.floor(index / 9)
  }));
  for (const count of [25, 50, 75, 100, 150, 200]) {
    assert.equal(WarRoomCalculator.candidateFormations(snapshot, 'cy', count).length, count);
  }
});

test('WarRoomCalculator ranks native simulations by objective destruction', () => {
  const snapshot = fixture();
  const response = {
    d: {
      s: [
        { i: 112, x: 6, y: 4, h: 100, ci: 1 },
        { i: 400, x: 6, y: 6, h: 50, ci: 2 }
      ],
      d: []
    },
    e: [
      { Key: 1, Value: { h: 0 } },
      { Key: 2, Value: { h: 400 } }
    ],
  };
  const result = WarRoomCalculator.scoreSimulation(response, snapshot, 'cy');
  assert.equal(result.objectivePercent, 0);
  assert.equal(result.blockerPercent, 50);
  assert.ok(Number.isFinite(result.score));
});

test('WarRoomCalculator ranks Maximum Defense Damage by all Defensive Units remaining', () => {
  const snapshot = fixture();
  snapshot.defenseUnits = [
    { id: 500, name: 'High-level Cannon', level: 30, health: 1, x: 4, y: 8 },
    { id: 501, name: 'Lower-level Cannon', level: 10, health: 1, x: 5, y: 8 }
  ];
  const response = (highRemaining, lowRemaining) => ({
    d: {
      s: [],
      d: [
        { i: 500, x: 4, y: 8, h: 100, ci: 1 },
        { i: 501, x: 5, y: 8, h: 100, ci: 2 }
      ]
    },
    e: [
      { Key: 1, Value: { h: highRemaining } },
      { Key: 2, Value: { h: lowRemaining } }
    ]
  });
  const moreDefenseDamage = WarRoomCalculator.scoreSimulation(response(1600, 0), snapshot, 'defense');
  const lessDefenseDamage = WarRoomCalculator.scoreSimulation(response(800, 1600), snapshot, 'defense');
  assert.equal(moreDefenseDamage.defensePercent, 50);
  assert.equal(lessDefenseDamage.defensePercent, 75);
  assert.ok(moreDefenseDamage.score < lessDefenseDamage.score);
});

test('WarRoomCalculator ranks a selected live defensive unit by its native remaining health', () => {
  const snapshot = fixture();
  const response = (health) => ({
    d: { s: [], d: [{ i: 500, x: 4, y: 8, h: 100, ci: 1 }] },
    e: [{ Key: 1, Value: { h: health } }]
  });
  const moreDamage = WarRoomCalculator.scoreSimulation(response(400), snapshot, 'specific:defense:500');
  const lessDamage = WarRoomCalculator.scoreSimulation(response(1200), snapshot, 'specific:defense:500');
  assert.equal(moreDamage.objectivePercent, 25);
  assert.ok(moreDamage.score < lessDamage.score);
});

test('WarRoomCalculator ranks Maximum RP candidates by actual native RP first', () => {
  const snapshot = fixture();
  const response = (health, research) => ({
    d: { s: [{ i: 112, x: 6, y: 4, h: 100, ci: 1 }], d: [], a: [] },
    e: [{ Key: 1, Value: { h: health } }],
    nativeEntityLoot: { 3: research }
  });
  const moreDamage = WarRoomCalculator.scoreSimulation(response(0, 999), snapshot, 'rp');
  const moreResearch = WarRoomCalculator.scoreSimulation(response(1200, 1000), snapshot, 'rp');
  assert.ok(moreResearch.score < moreDamage.score);
  assert.equal(moreResearch.research, 1000);
});

test('WarRoomCalculator summarizes live native battle results', () => {
  const snapshot = fixture();
  snapshot.resourceTypes = { ResearchPointsProduction: 99, ...snapshot.resourceTypes };
  snapshot.buildings = snapshot.buildings.map((building) => ({
    ...building,
    resourceValue: building.id === 112 ? { 1: 1000, 2: 200, 3: 500 } : { 1: 400, 2: 800, 3: 100 }
  }));
  snapshot.defenseUnits = snapshot.defenseUnits.map((unit) => ({
    ...unit, resourceValue: { 1: 600, 2: 300, 3: 200 }
  }));
  const response = {
    d: {
      cs: 440,
      s: [
        { i: 112, x: 6, y: 4, h: 100, ci: 1 },
        { i: 900, x: 2, y: 4, h: 100, ci: 2 }
      ],
      d: [{ i: 500, x: 4, y: 8, h: 100, ci: 3 }],
      a: [{ i: 10, x: 4, y: 0, h: 100, ci: 4 }]
    },
    e: [
      { Key: 1, Value: { h: 0 } },
      { Key: 2, Value: { h: 800 } },
      { Key: 3, Value: { h: 400 } },
      { Key: 4, Value: { h: 1200 } }
    ],
    nativeEntityLoot: { 1: 1650, 2: 825, 3: 700 },
    nativeOffenseRepair: {
      timeByGroup: { infantry: 0, vehicle: 50, aircraft: 0 },
      costsByGroup: { infantry: {}, vehicle: { 1: 250, 2: 100 }, aircraft: {} }
    }
  };
  const result = WarRoomCalculator.analyzeNativeSimulation(response, snapshot);
  assert.equal(result.cyRemaining, 0);
  assert.equal(result.dfRemaining, 50);
  assert.equal(result.ownRemaining, 75);
  assert.equal(result.durationSeconds, 44);
  assert.equal(result.repairSeconds, 50);
  assert.equal(result.repairTimeByGroup.vehicle, 50);
  assert.equal(result.repairCostResources.tiberium, 250);
  assert.equal(result.repairCostResources.crystal, 100);
  assert.equal(result.lootResources.tiberium, 1650);
  assert.equal(result.lootResources.crystal, 825);
  assert.equal(result.lootResources.research, 700);
  assert.equal(result.loot, 3175);
});

test('WarRoomCalculator reports defender state against native maximum health', () => {
  const snapshot = fixture();
  snapshot.defenseUnits = [{
    id: 500, name: 'Cannon', level: 25, x: 4, y: 8,
    maxHealth: 2000, resourceValue: { 1: 1000 }
  }];
  snapshot.buildings = [];
  const result = WarRoomCalculator.analyzeNativeSimulation({
    d: { s: [], d: [{ i: 500, x: 4, y: 8, h: 100, ci: 1 }], a: [] },
    e: [{ Key: 1, Value: { h: 1580 } }]
  }, snapshot);
  assert.equal(result.defenderBreakdown.defense.remainingPercent, 79);
  assert.equal(result.defenderRemaining, 79);
});

test('WarRoomCalculator prefers simulator maximum health and applies repeated-attack loot decay', () => {
  const snapshot = fixture();
  snapshot.resourceTypes = { Tiberium: 1, ResearchPoints: 4 };
  snapshot.buildings = [];
  snapshot.defenseUnits = [{
    id: 500, name: 'Cannon', level: 25, x: 4, y: 8,
    maxHealth: 1200, attackCounter: 0,
    resourceValue: { 1: 1000, 4: 501 }
  }];
  const result = WarRoomCalculator.analyzeNativeSimulation({
    d: { s: [], d: [{ i: 500, x: 4, y: 8, h: 100, ac: 2, ci: 1 }], a: [] },
    e: [{ Key: 1, Value: { h: 800, mh: 2000 } }],
    nativeEntityLoot: { 1: 196, 4: 98 }
  }, snapshot);
  assert.equal(result.defenderRemaining, 40);
  assert.equal(Math.round(result.lootResources.tiberium), 196);
  assert.equal(result.lootResources.research, 98);
  assert.equal(result.calculationDiagnostics.source, 'tabs-data-d');
  assert.ok(Math.abs(result.calculationDiagnostics.entities[0].attackDecay - 0.49) < 1e-12);
});

test('WarRoomCalculator ignores compact report loot and uses TABS data.d loot', () => {
  const snapshot = fixture();
  snapshot.resourceTypes = { Tiberium: 1, Crystal: 2, ResearchPoints: 6 };
  snapshot.buildings = snapshot.buildings.map((building) => ({
    ...building, resourceValue: { 1: 999999, 2: 999999, 6: 999999 }
  }));
  const result = WarRoomCalculator.analyzeNativeSimulation({
    d: { s: [{ i: 112, x: 6, y: 4, h: 100, ci: 1 }], d: [], a: [] },
    e: [{ Key: 1, Value: { sh: 1600, h: 800, mh: 1600 } }],
    nativeReportLoot: { 1: 999, 2: 999, 6: 999 },
    nativeEntityLoot: { 1: 114900, 2: 21345, 6: 51129 }
  }, snapshot);
  assert.equal(result.lootResources.tiberium, 114900);
  assert.equal(result.lootResources.crystal, 21345);
  assert.equal(result.lootResources.research, 51129);
  assert.equal(result.calculationDiagnostics.source, 'tabs-data-d');
});

test('WarRoomCalculator uses native report states and TABS battle duration', () => {
  const snapshot = fixture();
  snapshot.resourceTypes = {
    ...snapshot.resourceTypes, RepairChargeInf: 9, RepairChargeVeh: 10, RepairChargeAir: 8
  };
  const result = WarRoomCalculator.analyzeNativeSimulation({
    d: {
      cs: 440,
      s: [{ i: 112, x: 6, y: 4, h: 100, ci: 1 }],
      d: [{ i: 500, x: 4, y: 8, h: 100, ci: 2 }],
      a: [{ i: 10, x: 4, y: 0, h: 100, ci: 3 }]
    },
    e: [
      { Key: 1, Value: { h: 1200 } },
      { Key: 2, Value: { h: 400 } },
      { Key: 3, Value: { h: 800 } }
    ],
    nativeCombatReport: {
      summary: {
        targetState: 73, baseState: 99, defenseState: 44, armyState: 5,
        outcome: 'Victory', durationSeconds: 57
      },
      repairCosts: { 2: 79615, 8: 800, 9: 1200, 10: 2400 }
    },
    nativeOffenseRepair: {
      timeByGroup: { infantry: 1200, vehicle: 2400, aircraft: 800 },
      costsByGroup: { infantry: { 2: 30000 }, vehicle: { 2: 40000 }, aircraft: { 2: 9615 } }
    }
  }, snapshot);
  assert.equal(result.defenderRemaining, 73);
  assert.equal(result.defenderBreakdown.structures.remainingPercent, 99);
  assert.equal(result.defenderBreakdown.defense.remainingPercent, 44);
  assert.equal(result.ownRemaining, 5);
  assert.equal(result.outcome, 'Victory');
  assert.equal(result.durationSeconds, 44);
  assert.equal(result.repairCostResources.crystal, 79615);
  assert.equal(result.repairSeconds, 2400);
});

test('War Room attack estimate is limited by CP and the largest active repair requirement', () => {
  const result = estimatePossibleAttacks({
    cpAvailable: 85,
    cpCost: 10,
    repair: { infantry: 3600, vehicle: 7200, aircraft: 1800 },
    repairStorage: {
      infantry: { stored: 30000 },
      vehicle: { stored: 30000 },
      aircraft: { stored: 30000 }
    }
  });
  assert.equal(result.commandPointAttacks, 8);
  assert.equal(result.maxRepairSeconds, 7200);
  assert.equal(result.fullyRepairableAttacks, 4);
  assert.equal(result.repairTimeAttacks, 5);
  assert.equal(result.possibleAttacks, 5);
});

test('War Room attack estimate remains CP-limited when no repair is needed', () => {
  const result = estimatePossibleAttacks({ cpAvailable: 42, cpCost: 7 });
  assert.equal(result.commandPointAttacks, 6);
  assert.equal(result.repairTimeAttacks, Infinity);
  assert.equal(result.possibleAttacks, 6);
});

test('War Room includes a final attack after fully repairable capacity is exhausted', () => {
  const result = estimatePossibleAttacks({
    cpAvailable: 100,
    cpCost: 10,
    repair: { infantry: 4 * 3600 },
    repairStorage: { infantry: { stored: 10 * 3600 } }
  });
  assert.equal(result.fullyRepairableAttacks, 2);
  assert.equal(result.repairTimeAttacks, 3);
  assert.equal(result.possibleAttacks, 3);
});

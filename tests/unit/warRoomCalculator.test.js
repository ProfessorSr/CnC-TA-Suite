import test from 'node:test';
import assert from 'node:assert/strict';
import { WarRoomCalculator } from '../../modules/war-room/war-room-calculator.js';
import { estimatePossibleAttacks } from '../../modules/war-room/war-room-hub.js';

function fixture() {
  return {
    target: { level: 25 },
    units: [
      { name: 'Mammoth', level: 30, health: 1 },
      { name: 'Guardian', level: 28, health: 0.9 }
    ],
    defenseUnits: [{ name: 'Cannon', level: 25, health: 1, x: 4 }],
    buildings: [
      { id: 112, name: 'Construction Yard', level: 25, health: 1, x: 6, requirements: [] },
      { id: 900, name: 'Defense Facility', level: 24, health: 1, x: 2, requirements: [] }
    ],
    resourceTypes: { ResearchPoints: 3 },
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
    ]
  };
  const result = WarRoomCalculator.scoreSimulation(response, snapshot, 'cy');
  assert.equal(result.objectivePercent, 0);
  assert.equal(result.blockerPercent, 50);
  assert.ok(Number.isFinite(result.score));
});

test('WarRoomCalculator summarizes live native battle results', () => {
  const snapshot = fixture();
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
    ]
  };
  const result = WarRoomCalculator.analyzeNativeSimulation(response, snapshot);
  assert.equal(result.cyRemaining, 0);
  assert.equal(result.dfRemaining, 50);
  assert.equal(result.ownRemaining, 75);
  assert.equal(result.durationSeconds, 44);
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
  assert.equal(result.repairTimeAttacks, 4);
  assert.equal(result.possibleAttacks, 4);
});

test('War Room attack estimate remains CP-limited when no repair is needed', () => {
  const result = estimatePossibleAttacks({ cpAvailable: 42, cpCost: 7 });
  assert.equal(result.commandPointAttacks, 6);
  assert.equal(result.repairTimeAttacks, Infinity);
  assert.equal(result.possibleAttacks, 6);
});

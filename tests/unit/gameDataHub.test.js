import test from 'node:test';
import assert from 'node:assert/strict';
import { GameDataHub } from '../../core/game/hub/gameDataHub.js';

test('GameDataHub publishes normalized player resources without guessing MCV costs', () => {
  const rawPlayer = {
    get_NextBaseCredits: () => 1000,
    get_NextBaseResearchPoints: () => 500,
    get_CreditGrowthPerHour: () => 25
  };
  const services = new Map([
    ['player', {
      current: () => ({ id: 1, credits: 250, researchPoints: 100 }),
      raw: () => rawPlayer
    }],
    ['clientLib', {
      call(target, names) {
        for (const name of names) {
          if (typeof target?.[name] === 'function') return target[name]();
        }
        return undefined;
      }
    }]
  ]);
  const game = {
    ready: true,
    services: { tryGet: (name) => services.get(name) ?? null }
  };

  const snapshot = new GameDataHub({ game }).snapshot();
  assert.equal(snapshot.player.credits.current, 250);
  assert.equal(snapshot.player.credits.growthPerHour, 25);
  assert.equal(snapshot.player.research.current, 100);
  assert.equal(snapshot.player.nextMCV.creditsRequired, null);
  assert.equal(snapshot.player.nextMCV.researchRequired, null);
  assert.equal(snapshot.player.nextMCV.sourceAvailable, false);
});

test('GameDataHub reads next-MCV costs from the BaseFound research record', () => {
  const nextLevel = {
    rr: [
      { t: 3, c: 9_500_000 },
      { t: 6, c: 12_000_000 }
    ],
    lm: [{ i: 147, t: 57, v: 230_000_000_000 }],
    lr: []
  };
  const wrongLevel = {
    rr: [
      { t: 3, c: 1_000_000_000_000 },
      { t: 6, c: 600_000_000_000 }
    ]
  };
  const item = {
    SWFVWJ: { r: [nextLevel, wrongLevel] },
    SMLSTI: 1,
    get_CurrentLevel: () => 1,
    get_NextLevelInfo_Obj: () => nextLevel
  };
  const research = { GetResearchItemFomMdbId: () => item };
  const rawPlayer = {
    get_PlayerResearch: () => research,
    get_Faction: () => 2
  };
  const clientLib = {
    root: {
      Base: {
        ETechName: { Research_BaseFound: 7 },
        EResourceType: { ResearchPoints: 3, Gold: 6 },
        Tech: {
          GetTechIdFromTechNameAndFaction: (techName, faction) =>
            `${techName}:${faction}`
        }
      }
    },
    call(target, names, ...args) {
      for (const name of names) {
        if (typeof target?.[name] === 'function') return target[name](...args);
      }
      return undefined;
    }
  };
  const services = new Map([
    ['player', {
      current: () => ({ credits: 300, researchPoints: 150 }),
      raw: () => rawPlayer
    }],
    ['clientLib', clientLib],
    ['city', { all: () => [{}] }]
  ]);
  const hub = new GameDataHub({
    game: {
      ready: true,
      services: { tryGet: (name) => services.get(name) ?? null }
    }
  });

  const snapshot = hub.snapshot();
  assert.equal(snapshot.player.nextMCV.creditsRequired, 12_000_000);
  assert.equal(snapshot.player.nextMCV.researchRequired, 9_500_000);
  assert.deepEqual(snapshot.player.nextMCV.resourceRequirements, nextLevel.rr);
  assert.equal(snapshot.player.nextMCV.source, 'Research_BaseFound');
  assert.equal(snapshot.player.nextMCV.sourceAvailable, true);
  assert.equal(snapshot.player.nextMCV.techId, '7:2');
  assert.equal(snapshot.player.nextMCV.faction, 2);
  assert.equal(snapshot.player.nextMCV.levelIndex, 0);
  assert.equal(snapshot.player.nextMCV.legacyIndex, 1);
  assert.equal(snapshot.player.nextMCV.usedNextLevelAccessor, true);
});

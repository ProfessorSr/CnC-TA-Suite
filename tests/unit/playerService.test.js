import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerService } from '../../core/game/player/playerService.js';

test('PlayerService normalizes uppercase and object-shaped resource getters', () => {
  const player = {
    GetCreditsCount: () => ({ Base: 7_250_000 }),
    get_ResearchPoints: () => 4_500_000
  };
  const clientLib = {
    getPlayer: () => player,
    call(target, names) {
      for (const name of names) {
        if (typeof target?.[name] === 'function') return target[name]();
      }
      return undefined;
    }
  };
  const values = new Map();
  const cache = {
    get(key, factory) {
      if (!values.has(key)) values.set(key, factory());
      return values.get(key);
    },
    invalidate() {}
  };

  const snapshot = new PlayerService({ clientLib, cache, logger: {} }).current();
  assert.equal(snapshot.credits, 7_250_000);
  assert.equal(snapshot.researchPoints, 4_500_000);
});

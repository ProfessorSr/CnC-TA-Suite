import { BattleObjectRegistry } from '../../core/game/battle/battleObjectRegistry.js';

export function runBattleObjectRegistryTest() {
  const registry = new BattleObjectRegistry({
    logger: { debug() {} }
  });

  const object = { type: 'unit' };
  registry.register(8, object, { side: 'attacker' });

  if (registry.get(8) !== object) {
    throw new Error('Registry returned the wrong battle object.');
  }

  if (registry.snapshot()[0].metadata.side !== 'attacker') {
    throw new Error('Registry metadata mismatch.');
  }

  return true;
}

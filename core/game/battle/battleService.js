import { FormationModel } from './formationModel.js';

export class BattleService {
  constructor({ clientLib, objectDiscovery, cache, logger }) {
    this.clientLib = clientLib;
    this.objectDiscovery = objectDiscovery;
    this.cache = cache;
    this.logger = logger;
  }

  getCombatData() {
    return this.cache.get('battle:combat', () => {
      const mainData = this.clientLib.getMainData();

      return this.objectDiscovery.findFirst(mainData, [
        (value) => value?.get_Combat?.(),
        (value) => value?.get_Battle?.(),
        (value) => value?.get_Battleground?.(),
        (value) => value?.get_CombatData?.()
      ]);
    }, { ttl: 150 }) ?? null;
  }

  isActive() {
    const combat = this.getCombatData();
    if (!combat) return false;

    const value = this.clientLib.call(combat, [
      'get_IsBattleActive',
      'get_IsActive',
      'get_InCombat',
      'get_IsCombatActive'
    ]);

    return value === undefined ? true : Boolean(value);
  }

  getSideRaw(side) {
    const combat = this.getCombatData();
    const attacker = side === 'attacker';

    return this.objectDiscovery.findFirst(combat, attacker ? [
      (value) => value?.get_Attacker?.(),
      (value) => value?.get_Offense?.(),
      (value) => value?.get_OwnArmy?.()
    ] : [
      (value) => value?.get_Defender?.(),
      (value) => value?.get_Defense?.(),
      (value) => value?.get_EnemyArmy?.()
    ]);
  }

  getFormation(side = 'attacker') {
    const raw = this.getSideRaw(side);

    const collection = this.objectDiscovery.findFirst(raw, [
      (value) => value?.get_Formation?.(),
      (value) => value?.get_Units?.(),
      (value) => value
    ]);

    return FormationModel.fromCollection(collection, {
      clientLib: this.clientLib
    });
  }

  getTarget() {
    const combat = this.getCombatData();

    return this.objectDiscovery.findFirst(combat, [
      (value) => value?.get_Target?.(),
      (value) => value?.get_DefenderCity?.(),
      (value) => value?.get_TargetBase?.()
    ]);
  }

  getState() {
    return Object.freeze({
      active: this.isActive(),
      target: this.getTarget(),
      attacker: this.getFormation('attacker'),
      defender: this.getFormation('defender')
    });
  }

  invalidate() {
    this.cache.invalidate('battle');
  }
}

export class BattleSimulator {
  constructor(hub) { this.hub = hub; }
  launch() { return this.hub.openCombatSetup(); }
}

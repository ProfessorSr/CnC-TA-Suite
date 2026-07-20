import { Module } from '../../core/interfaces/module.js';
import { UpgradeManagerHub } from './upgrade-manager-hub.js';
import { UpgradeManagerWindow } from './upgrade-manager-window.js';
import { QuickUpgradeWindow } from './quick-upgrade-window.js';

const settings = Object.freeze({
  categoryBuildings: Object.freeze({ type: 'boolean', default: true }),
  categoryDefense: Object.freeze({ type: 'boolean', default: true }),
  categoryOffense: Object.freeze({ type: 'boolean', default: true }),
  affordableOnly: Object.freeze({ type: 'boolean', default: false }),
  resourceOnly: Object.freeze({ type: 'boolean', default: false }),
  strategy: Object.freeze({
    type: 'string', default: 'productive',
    enum: Object.freeze(['productive', 'collector-heavy', 'power-heavy', 'lowest-cost', 'highest-level'])
  }),
  targetLevel: Object.freeze({ type: 'number', default: 65, min: 1, max: 80 }),
  baseStates: Object.freeze({ type: 'object', default: Object.freeze({}) }),
  typeStates: Object.freeze({ type: 'object', default: Object.freeze({}) }),
  baseTypeStates: Object.freeze({ type: 'object', default: Object.freeze({}) })
});

export const upgradeManagerManifest = Object.freeze({
  id: 'upgrade-manager',
  name: 'Upgrade Manager',
  version: '1.0.0',
  apiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Plan, filter, rank, and manually apply upgrades across owned bases.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['events', 'game', 'notifications', 'settings', 'windows']),
  settings
});

export class UpgradeManagerModule extends Module {
  constructor() {
    super(upgradeManagerManifest);
    this.context = null;
    this.hub = null;
    this.window = null;
    this.allCandidates = [];
    this.filtered = [];
    this.quickWindow = null;
  }

  setting(key, fallback) { return this.context?.moduleSettings?.get(key, fallback) ?? fallback; }

  async enable(context) {
    this.context = context;
    this.hub = new UpgradeManagerHub(context);
    this.window = new UpgradeManagerWindow({
      context,
      getState: () => this.state(),
      refresh: () => this.refresh(),
      upgradeSelected: (candidate) => this.upgradeOne(candidate, true),
      upgradeAll: (candidates) => this.upgradeMany(candidates)
    });
    this.quickWindow = new QuickUpgradeWindow({ context, hub: this.hub });
    context.events?.on?.('game:tick', () => this.hub?.captureSelection?.());
    context.events?.on?.('game:selection-changed', () => this.hub?.captureSelection?.());
    this.refresh();
  }

  eligible(candidate) {
    const target = this.setting('targetLevel', 65);
    if (candidate.level >= target || candidate.damaged || candidate.locked) return false;
    if (!this.setting(`category${candidate.category[0].toUpperCase()}${candidate.category.slice(1)}`, true)) return false;
    const baseStates = this.setting('baseStates', {});
    if (baseStates[candidate.cityId] === false) return false;
    const typeStates = this.setting('typeStates', {});
    if (typeStates[candidate.name] === false) return false;
    const baseTypeStates = this.setting('baseTypeStates', {});
    if (baseTypeStates[`${candidate.cityId}::${candidate.name}`] === false) return false;
    if (this.setting('resourceOnly', false) && (candidate.category !== 'buildings' || candidate.coreBuilding || !candidate.resourceBuilding)) return false;
    if (this.setting('affordableOnly', false) && !candidate.affordable) return false;
    return true;
  }

  refresh() {
    try {
      this.allCandidates = this.hub.candidates();
      this.filtered = this.hub.rank(this.allCandidates.filter((item) => this.eligible(item)), this.setting('strategy', 'productive'));
      this.window?.render?.();
    } catch (error) {
      this.context?.logger?.warn?.('Unable to refresh upgrade candidates.', error);
      this.window?.addActivity?.(`Refresh failed — ${error?.message ?? error}`);
    }
    return this.state();
  }

  state() {
    const baseMap = new Map(this.allCandidates.map((item) => [item.cityId, item.base]));
    return Object.freeze({
      filtered: this.filtered,
      bases: [...baseMap].map(([id, name]) => ({ id, name })),
      types: [...new Set(this.allCandidates.map((item) => item.name))].sort(),
      baseTypes: [...new Map(this.allCandidates.map((item) => [
        `${item.cityId}::${item.name}`, { id: `${item.cityId}::${item.name}`, label: `${item.base} — ${item.name}` }
      ])).values()].sort((left, right) => left.label.localeCompare(right.label))
    });
  }

  async upgradeOne(candidate, manual = false) {
    if (!candidate) {
      if (manual) this.window?.addActivity?.('No upgrade candidate selected');
      return false;
    }
    const result = this.hub.upgrade(candidate);
    if (result.success) {
      this.window?.addActivity?.(`${candidate.base} — ${candidate.name} ${candidate.level} → ${candidate.nextLevel}`);
      this.context.notifications?.show?.(`Upgrading ${candidate.name} at ${candidate.base}.`);
    } else if (manual) {
      this.window?.addActivity?.(`${candidate.base} — ${candidate.name}: ${result.reason}`);
    }
    this.refresh();
    return result.success;
  }

  async upgradeMany(candidates) {
    const eligible = candidates.filter((candidate) => candidate.affordable && this.eligible(candidate));
    if (!eligible.length) {
      this.window?.addActivity?.('No filtered upgrades were currently eligible');
      return 0;
    }
    if (!(globalThis.confirm?.(`Upgrade ${eligible.length} currently eligible item(s)? This spends game resources immediately.`) ?? false)) {
      this.window?.addActivity?.('Bulk upgrade cancelled');
      return 0;
    }
    let upgraded = 0;
    for (const candidate of eligible) {
      if (await this.upgradeOne(candidate, false)) upgraded += 1;
    }
    if (!upgraded) this.window?.addActivity?.('No filtered upgrades were currently eligible');
    return upgraded;
  }

  async open(context) {
    if (!this.window) await this.enable(context);
    const record = await this.window.open();
    this.refresh();
    return record;
  }

  async openQuick() {
    if (!this.quickWindow) throw new Error('Upgrade Manager is not enabled.');
    this.hub?.captureSelection?.();
    return this.quickWindow.open();
  }

  async disable(context) {
    context?.windows?.close?.('upgrade-manager');
    context?.windows?.close?.('upgrade-manager-quick');
    this.context = null;
    this.hub = null;
    this.window = null;
    this.allCandidates = [];
    this.filtered = [];
    this.quickWindow = null;
  }

  async destroy(context) { await this.disable(context); }
}

export default UpgradeManagerModule;

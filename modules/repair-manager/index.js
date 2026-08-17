import { Module } from '../../core/interfaces/module.js';
import { RepairManagerHub } from './repair-manager-hub.js';
import { RepairManagerWindow } from './repair-manager-window.js';
import { RepairQuickDock } from './repair-quick-dock.js';

export const repairManagerManifest = Object.freeze({
  id: 'repair-manager',
  name: 'Repair & Collection Manager',
  version: '0.4.0',
  apiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Automatic and manual repair and resource collection controls for owned bases.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['events', 'game', 'modules', 'notifications', 'settings', 'windows']),
  settings: Object.freeze({
    autoCollect: Object.freeze({ type: 'boolean', default: false }),
    autoRepairBuildings: Object.freeze({ type: 'boolean', default: false }),
    autoRepairOffense: Object.freeze({ type: 'boolean', default: false }),
    autoRepairDefense: Object.freeze({ type: 'boolean', default: false }),
    repairPriority: Object.freeze({
      type: 'string',
      default: 'defense-first',
      enum: Object.freeze(['defense-first', 'production-first', 'core-first'])
    }),
    intervalSeconds: Object.freeze({ type: 'number', default: 15, min: 5, max: 300 })
  })
});

export class RepairManagerModule extends Module {
  constructor() {
    super(repairManagerManifest);
    this.context = null;
    this.hub = null;
    this.window = null;
    this.quickDock = null;
    this.lastRunAt = 0;
    this.lastDockRefreshAt = 0;
    this.running = false;
  }

  async enable(context) {
    this.context = context;
    this.hub = new RepairManagerHub(context);
    this.window = new RepairManagerWindow({
      context,
      hub: this.hub,
      runAction: (action, options) => this.runAction(action, options)
    });
    this.quickDock = new RepairQuickDock({
      context,
      hub: this.hub,
      runAction: (action, options) => this.runAction(action, options),
      openManager: () => this.window.open()
    });
    this.quickDock.refresh();
    context.events.on('game:tick', () => { void this.tick(); });
  }

  async tick() {
    if (this.running || !this.context || !this.hub) return;
    const interval = Math.max(5, Number(this.context.moduleSettings.get('intervalSeconds', 15))) * 1000;
    const now = Date.now();
    if (now - this.lastDockRefreshAt >= 2000) {
      this.lastDockRefreshAt = now;
      // DOM discovery and Qooxdoo layout flushing do not belong in the
      // central game-state dispatch budget. Defer the dock refresh one turn.
      globalThis.setTimeout?.(() => this.quickDock?.refresh?.(), 0);
    }
    if (now - this.lastRunAt < interval) return;
    this.lastRunAt = now;
    this.running = true;
    try {
      const actions = [];
      if (this.context.moduleSettings.get('autoCollect', false)) actions.push('collect');
      if (this.context.moduleSettings.get('autoRepairDefense', false)) actions.push('defense');
      if (this.context.moduleSettings.get('autoRepairBuildings', false)) actions.push('buildings');
      if (this.context.moduleSettings.get('autoRepairOffense', false)) actions.push('offense');
      for (const action of actions) await this.runAction(action, { manual: false });
      this.window?.refresh?.();
      this.quickDock?.refresh?.();
    } catch (error) {
      this.context.logger?.warn?.('Repair automation failed.', error);
      this.window?.setStatus?.(`Automation failed: ${error?.message ?? error}`);
    } finally {
      this.running = false;
    }
  }

  async runAction(action, { manual = false } = {}) {
    let result;
    if (action === 'collect') result = this.hub.collectAll();
    else if (action === 'buildings') {
      result = this.hub.repairBuildings(
        this.context.moduleSettings.get('repairPriority', 'defense-first')
      );
    } else if (action === 'offense') result = this.hub.repairAllMode('offense');
    else if (action === 'defense') result = this.hub.repairAllMode('defense');
    else throw new Error(`Unknown repair action: ${action}`);

    const label = {
      collect: 'Collection',
      buildings: 'Building repair',
      offense: 'Offense repair',
      defense: 'Defense repair'
    }[action];
    const message = !result.supported
      ? `${label} is not exposed by this game build.`
      : result.affected
        ? `${label} started for ${result.affected} ${result.affected === 1 ? 'base/item' : 'bases/items'}.`
        : `${label}: nothing currently requires action.`;
    const actionLabels = {
      collect: 'Collected packages',
      buildings: 'Repaired Buildings',
      offense: 'Repaired Offense',
      defense: 'Repaired Defense'
    };
    for (const detail of result.details ?? []) {
      this.window?.addActivity?.(`${detail.base} — ${actionLabels[detail.action] ?? label}`);
    }
    if (manual && !result.affected) {
      this.window?.addActivity?.(
        action === 'collect' ? 'No packages ready to collect' : 'No repairs needed'
      );
    }
    if (manual) this.context.logger?.info?.(message);
    return { ...result, message };
  }

  async open(context) {
    if (!this.window) await this.enable(context);
    return this.window.open();
  }

  async disable(context) {
    context?.windows?.close?.('repair-manager');
    this.quickDock?.destroy?.();
    this.context = null;
    this.hub = null;
    this.window = null;
    this.quickDock = null;
    this.running = false;
  }

  async destroy(context) {
    await this.disable(context);
  }
}

export default RepairManagerModule;

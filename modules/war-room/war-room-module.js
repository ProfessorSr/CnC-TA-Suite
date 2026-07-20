import { BattleSimulator } from './battle-simulator.js';
import { CombatStats } from './combat-stats.js';
import { WarRoomHub } from './war-room-hub.js';
import { WarRoomWindow } from './war-room-window.js';

export class WarRoomModule {
  constructor() {
    this.id = 'war-room';
    this.name = 'War Room';
    this.title = 'War Room';
    this.version = '1.0.0';
    this.author = 'ProfessorSr';
    this.description = 'Unified attack planning, simulation, reports, army, target, and combat analysis.';
    this.category = 'Combat';
    this.settingsKey = 'warRoom';
    this.window = null;
    this.context = null;
    this.attackSetupActive = false;
    this.attackTargetId = null;
    this.unsubscribeTick = null;
  }

  async start(context) {
    this.context = context;
    this.unsubscribeTick?.();
    this.unsubscribeTick = context.eventBus?.on?.('game:tick', () => {
      const hub = this.window?.hub ?? new WarRoomHub(context);
      const snapshot = hub.snapshot();
      const active = hub.isAttackSetupOpen(snapshot);
      const targetId = active ? String(snapshot.target?.id ?? '') : null;
      if (active && (!this.attackSetupActive || targetId !== this.attackTargetId)) {
        void this.open(context, 'planner').catch((error) => context.logger?.warn?.('War Room could not auto-open for attack setup.', error));
      }
      this.attackSetupActive = active;
      this.attackTargetId = targetId;
    });
  }

  ensureInitialized(context) {
    if (this.window) return;
    const hub = new WarRoomHub(context);
    const stats = new CombatStats(context.storage);
    void stats.load().then(() => this.window?.refreshAll?.()).catch((error) => {
      context.logger?.warn?.('War Room combat history failed to load.', error);
    });
    this.window = new WarRoomWindow({
      context,
      hub,
      stats,
      simulator: new BattleSimulator(hub)
    });
  }

  async open(context, page = null) {
    this.ensureInitialized(context);
    const record = await this.window.open();
    if (page) this.window.showPage?.(page);
    return record;
  }

  async disable(context) {
    this.unsubscribeTick?.();
    this.unsubscribeTick = null;
    context?.windows?.close?.('war-room');
    this.window = null;
    this.context = null;
    this.attackSetupActive = false;
    this.attackTargetId = null;
  }

  async destroy(context) {
    await this.disable(context);
  }
}

export default WarRoomModule;

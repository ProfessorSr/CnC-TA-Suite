export class DiagnosticsService {
  constructor({ eventBus, game, hooks, observers, logger }) {
    this.eventBus = eventBus;
    this.game = game;
    this.hooks = hooks;
    this.observers = observers;
    this.logger = logger;
    this.startedAt = Date.now();
  }

  snapshot() {
    const gameStatus = this.game.getStatus();
    const cache = this.game.services?.tryGet?.('cache');
    const monitor = this.game.integration?.monitor;

    return Object.freeze({
      generatedAt: Date.now(),
      uptimeMs: Date.now() - this.startedAt,
      game: gameStatus,
      eventBus: this.eventBus.snapshot?.() ?? null,
      cache: cache?.snapshot?.() ?? null,
      hooks: Object.freeze(this.hooks.snapshot()),
      observers: Object.freeze(this.observers.snapshot()),
      monitor: monitor?.getStatus?.() ?? Object.freeze({ running: false })
    });
  }

  health() {
    const snapshot = this.snapshot();
    const checks = {
      gameReady: Boolean(snapshot.game.ready),
      compatibility: Boolean(snapshot.game.compatibility?.compatible),
      monitorRunning: Boolean(snapshot.monitor.running),
      eventErrors: (snapshot.eventBus?.failed ?? 0) === 0
    };

    return Object.freeze({
      healthy: Object.values(checks).every(Boolean),
      checks: Object.freeze(checks)
    });
  }
}

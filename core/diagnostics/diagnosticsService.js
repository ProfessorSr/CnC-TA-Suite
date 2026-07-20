const SENSITIVE_KEY = /(?:token|secret|password|email|message|chat|auth|cookie|session|playername|allianceannouncement)/i;

function redact(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, seen);
  }
  return result;
}

export class DiagnosticsService {
  constructor({ eventBus, game, hooks, observers, logger, rootLogger, modules, hub }) {
    this.eventBus = eventBus;
    this.game = game;
    this.hooks = hooks;
    this.observers = observers;
    this.logger = logger;
    this.rootLogger = rootLogger ?? logger;
    this.modules = modules;
    this.hub = hub;
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
      monitor: monitor?.getStatus?.() ?? Object.freeze({ running: false }),
      performance: this.game.services?.tryGet?.('performance')?.snapshot?.() ?? null,
      modules: this.modules?.snapshot?.() ?? null,
      logs: this.rootLogger?.snapshot?.() ?? null
    });
  }

  supportBundle() {
    let hubContract = null;
    try {
      const snapshot = this.hub?.snapshot?.();
      hubContract = snapshot ? { schemaVersion: snapshot.schemaVersion, ready: snapshot.ready, generatedAt: snapshot.generatedAt } : null;
    } catch (error) {
      hubContract = { error: error instanceof Error ? error.message : String(error) };
    }
    return Object.freeze(redact({
      formatVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      diagnostics: this.snapshot(),
      hub: hubContract,
      userAgent: globalThis.navigator?.userAgent ?? 'unavailable'
    }));
  }

  exportJson() { return JSON.stringify(this.supportBundle(), null, 2); }

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

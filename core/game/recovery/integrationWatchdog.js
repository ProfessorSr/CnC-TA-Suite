import { Events } from '../../events/eventTypes.js';

export class IntegrationWatchdog {
  constructor({ integration, eventBus, logger, interval = 5000, failureThreshold = 3 }) {
    this.integration = integration;
    this.eventBus = eventBus;
    this.logger = logger;
    this.interval = interval;
    this.failureThreshold = failureThreshold;
    this.timer = null;
    this.failures = 0;
    this.lastCheckAt = null;
    this.lastHealthyAt = null;
    this.connectionLost = false;
  }

  check() {
    this.lastCheckAt = Date.now();
    const clientLib = this.integration.services.tryGet('clientLib');
    const healthy = Boolean(
      this.integration.ready
      && clientLib
      && clientLib.getMainData?.()
      && clientLib.getServer?.()
    );

    if (healthy) {
      const wasLost = this.connectionLost;
      this.failures = 0;
      this.lastHealthyAt = this.lastCheckAt;
      this.connectionLost = false;
      if (wasLost) {
        this.eventBus.emit(Events.GAME_CONNECTION_RESTORED, {
          restoredAt: this.lastHealthyAt
        });
      }
      return true;
    }

    this.failures += 1;
    if (this.failures === this.failureThreshold) {
      this.connectionLost = true;
      this.logger.warn('Game integration health check failed repeatedly.');
      this.eventBus.emit(Events.GAME_CONNECTION_LOST, {
        failures: this.failures,
        checkedAt: this.lastCheckAt
      });
    }
    return false;
  }

  start() {
    if (this.timer) return;
    this.check();
    this.timer = window.setInterval(() => this.check(), this.interval);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.failures = 0;
  }

  getStatus() {
    return Object.freeze({
      running: Boolean(this.timer),
      failures: this.failures,
      lastCheckAt: this.lastCheckAt,
      lastHealthyAt: this.lastHealthyAt,
      connectionLost: this.connectionLost
    });
  }
}

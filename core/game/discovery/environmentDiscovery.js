import { waitFor } from '../../utils/timers.js';

export class EnvironmentDiscovery {
  constructor({ logger, timeout = 60000, interval = 250 }) {
    this.logger = logger;
    this.timeout = timeout;
    this.interval = interval;
  }

  async discover() {
    const startedAt = Date.now();

    const [clientLib, application] = await Promise.all([
      waitFor(
        () => window.ClientLib,
        {
          timeout: this.timeout,
          interval: this.interval,
          description: 'ClientLib'
        }
      ),
      waitFor(
        () => window.qx?.core?.Init?.getApplication?.(),
        {
          timeout: this.timeout,
          interval: this.interval,
          description: 'qx application'
        }
      )
    ]);

    const result = Object.freeze({
      clientLib,
      application,
      discoveredAt: Date.now(),
      discoveryDurationMs: Date.now() - startedAt
    });

    this.logger.info('Game environment discovered.', {
      discoveryDurationMs: result.discoveryDurationMs
    });

    return result;
  }
}

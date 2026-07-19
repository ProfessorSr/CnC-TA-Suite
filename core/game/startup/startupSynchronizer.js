import { waitFor } from '../../utils/timers.js';

export class StartupSynchronizer {
  constructor({
    logger,
    clientLibManager,
    readinessProbe,
    timeout = 60000,
    interval = 250
  }) {
    this.logger = logger;
    this.clientLibManager = clientLibManager;
    this.readinessProbe = readinessProbe;
    this.timeout = timeout;
    this.interval = interval;
  }

  async waitUntilReady(environment) {
    const result = await waitFor(
      () => {
        const probe = this.readinessProbe.inspect(environment);
        return probe.ready ? probe : false;
      },
      {
        timeout: this.timeout,
        interval: this.interval,
        description: 'game data services'
      }
    );

    this.logger.info('Game startup synchronization complete.');
    return result;
  }
}

export class ReadinessProbe {
  constructor({ logger }) {
    this.logger = logger;
  }

  inspect(environment) {
    const clientLib = environment?.clientLib;
    const application = environment?.application;

    const checks = {
      hasClientLib: Boolean(clientLib),
      hasApplication: Boolean(application),
      hasMainData: Boolean(clientLib?.Data?.MainData?.GetInstance),
      hasServer: Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_Server),
      hasPlayer: Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_Player),
      hasCities: Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_Cities),
      hasWorld: Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_World)
    };

    const failed = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    const result = Object.freeze({
      ready: failed.length === 0,
      checks: Object.freeze(checks),
      failed: Object.freeze(failed)
    });

    if (!result.ready) {
      this.logger.warn('Game readiness probe found missing capabilities.', failed);
    }

    return result;
  }
}

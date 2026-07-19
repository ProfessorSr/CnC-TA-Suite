export class ClientLibManager {
  constructor({ environment, logger }) {
    this.environment = environment;
    this.logger = logger;
  }

  get root() {
    return this.environment.clientLib;
  }

  getMainData() {
    return this.root?.Data?.MainData?.GetInstance?.() || null;
  }

  getServer() {
    return this.getMainData()?.get_Server?.() || null;
  }

  getPlayer() {
    return this.getMainData()?.get_Player?.() || null;
  }

  getCities() {
    return this.getMainData()?.get_Cities?.() || null;
  }

  getWorld() {
    return this.getMainData()?.get_World?.() || null;
  }

  call(target, methodNames, ...args) {
    const names = Array.isArray(methodNames) ? methodNames : [methodNames];

    for (const name of names) {
      const method = target?.[name];
      if (typeof method !== 'function') continue;

      try {
        return method.apply(target, args);
      } catch (error) {
        this.logger.debug(`ClientLib call failed: ${name}`, error);
      }
    }

    return undefined;
  }

  has(path) {
    return String(path)
      .split('.')
      .filter(Boolean)
      .reduce((value, key) => value?.[key], this.root) !== undefined;
  }
}

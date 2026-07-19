export class QxManager {
  constructor({ environment, logger }) {
    this.environment = environment;
    this.logger = logger;
  }

  get root() {
    return window.qx || null;
  }

  getApplication() {
    return this.environment.application || null;
  }

  getDesktop() {
    return this.getApplication()?.getDesktop?.() || null;
  }

  defer(callback) {
    const timer = this.root?.event?.Timer;
    if (timer?.once) {
      timer.once(callback, null, 0);
      return;
    }

    queueMicrotask(callback);
  }

  connect(object, eventName, handler, context = null) {
    if (!object || typeof object.addListener !== 'function') {
      throw new Error(`Cannot connect qx event: ${eventName}`);
    }

    const listenerId = object.addListener(eventName, handler, context);
    return () => {
      try {
        object.removeListenerById?.(listenerId);
      } catch (error) {
        this.logger.debug(`Failed to remove qx listener: ${eventName}`, error);
      }
    };
  }
}

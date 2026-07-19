import { eventBus } from '../events/eventBus.js';
import { Events } from '../events/eventTypes.js';
import { logger } from '../utils/logger.js';
import { Lifecycle } from './lifecycle.js';
import { createApplication } from './startup.js';

let applicationPromise = null;

export function bootstrap() {
  if (applicationPromise) return applicationPromise;

  applicationPromise = (async () => {
    const lifecycle = new Lifecycle(logger.child('Lifecycle'));
    lifecycle.transition('bootstrapping');
    eventBus.emit(Events.SUITE_BOOTSTRAP_STARTED);

    const context = await createApplication({ eventBus, logger });
    context.lifecycle = lifecycle;

    try {
      await context.game.initialize();
    } catch (error) {
      logger.warn('Game integration is not ready yet. Core UI will still start.', error);
    }

    await context.modules.startEnabled();
    lifecycle.transition('ready');

    window.CnCTASuite = Object.freeze({
      version: '0.2.0',
      context
    });

    eventBus.emit(Events.SUITE_READY, { version: '0.2.0' });
    context.notifications.show('CnC-TA-Suite v0.2.0 is ready.');
    logger.info('CnC-TA-Suite is ready.');
    return context;
  })().catch((error) => {
    eventBus.emit(Events.SUITE_ERROR, { error });
    throw error;
  });

  return applicationPromise;
}

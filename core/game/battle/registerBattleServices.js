import { BattleService } from './battleService.js';
import { BattleObjectRegistry } from './battleObjectRegistry.js';

export function registerBattleServices(gameIntegration) {
  const { services, logger } = gameIntegration;
  const clientLib = services.get('clientLib');
  const objectDiscovery = services.get('objectDiscovery');
  const cache = services.get('cache');

  services.register('battleObjects', new BattleObjectRegistry({
    logger: logger.child('BattleObjects')
  }));

  services.register('battle', new BattleService({
    clientLib,
    objectDiscovery,
    cache,
    logger: logger.child('Battle')
  }));
}

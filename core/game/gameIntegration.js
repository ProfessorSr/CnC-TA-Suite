import { EnvironmentDiscovery } from './discovery/environmentDiscovery.js';
import { ReadinessProbe } from './discovery/readinessProbe.js';
import { ObjectDiscovery } from './discovery/objectDiscovery.js';
import { ClientLibManager } from '../clientlib/clientLibManager.js';
import { QxManager } from '../clientlib/qxManager.js';
import { VersionManager } from './compatibility/versionManager.js';
import { CompatibilityDetector } from './compatibility/compatibilityDetector.js';
import { ServiceRegistry } from './registry/serviceRegistry.js';
import { GameObjectRegistry } from './registry/gameObjectRegistry.js';
import { StartupSynchronizer } from './startup/startupSynchronizer.js';
import { CacheManager } from './cache/cacheManager.js';
import { PlayerService } from './player/playerService.js';
import { CityService } from './city/cityService.js';
import { WorldService } from './world/worldService.js';
import { AllianceService } from './alliance/allianceService.js';
import { BaseService } from './base/baseService.js';
import { SelectionManager } from './selection/selectionManager.js';
import { registerBattleServices } from './battle/registerBattleServices.js';
import { createGameApi } from './public/gameApi.js';
import { GameStateMonitor } from './events/gameStateMonitor.js';
import { Events } from '../events/eventTypes.js';
import { IntegrationWatchdog } from './recovery/integrationWatchdog.js';
import { ClientApiAdapter } from './compatibility/clientApiAdapter.js';
import { PerformanceProfiler } from '../performance/performanceProfiler.js';

export class GameIntegration {
  constructor({ eventBus, logger }) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.ready = false;
    this.environment = null;
    this.version = null;
    this.compatibility = null;
    this.api = null;
    this.monitor = null;
    this.watchdog = null;
    this.initializing = null;

    this.services = new ServiceRegistry({
      logger: logger.child('Services')
    });

    this.objects = new GameObjectRegistry({
      logger: logger.child('Objects')
    });
  }

  registerCoreServices({ clientLib, qx, objectDiscovery, adapter, performance }) {
    const cache = new CacheManager({
      logger: this.logger.child('Cache'),
      defaultTtl: 1000
    });

    this.services.register('clientLib', clientLib);
    this.services.register('qx', qx);
    this.services.register('objectDiscovery', objectDiscovery);
    this.services.register('cache', cache);
    this.services.register('clientApiAdapter', adapter);
    this.services.register('performance', performance);

    this.services.register('selection', new SelectionManager({
      clientLib,
      qx,
      objectDiscovery,
      cache,
      logger: this.logger.child('Selection')
    }));

    const player = new PlayerService({
      clientLib,
      cache,
      logger: this.logger.child('Player')
    });

    const city = new CityService({
      clientLib,
      cache,
      objectDiscovery,
      logger: this.logger.child('City'),
      performance
    });

    const world = new WorldService({
      clientLib,
      cache,
      logger: this.logger.child('World')
    });

    const alliance = new AllianceService({
      clientLib,
      cache,
      player,
      logger: this.logger.child('Alliance')
    });

    const base = new BaseService({
      clientLib,
      cache,
      city,
      selection: this.services.get('selection'),
      logger: this.logger.child('Base')
    });

    this.services.register('player', player);
    this.services.register('city', city);
    this.services.register('world', world);
    this.services.register('alliance', alliance);
    this.services.register('base', base);

    registerBattleServices(this);
  }

  async initialize() {
    if (this.ready) return this;
    if (this.initializing) return this.initializing;

    this.initializing = this.performInitialize();
    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async performInitialize() {
    this.eventBus.emit(Events.GAME_DISCOVERY_STARTED);

    try {
      const discovery = new EnvironmentDiscovery({
        logger: this.logger.child('Discovery')
      });

      this.environment = await discovery.discover();
      this.eventBus.emit(Events.GAME_DISCOVERED, {
        discoveryDurationMs: this.environment.discoveryDurationMs
      });

      const readinessProbe = new ReadinessProbe({
        logger: this.logger.child('Readiness')
      });

      const clientLib = new ClientLibManager({
        environment: this.environment,
        logger: this.logger.child('ClientLib')
      });

      const qx = new QxManager({
        environment: this.environment,
        logger: this.logger.child('Qx')
      });

      const objectDiscovery = new ObjectDiscovery({
        logger: this.logger.child('ObjectDiscovery')
      });

      const synchronizer = new StartupSynchronizer({
        logger: this.logger.child('Startup'),
        clientLibManager: clientLib,
        readinessProbe
      });

      await synchronizer.waitUntilReady(this.environment);

      const versionManager = new VersionManager({
        clientLibManager: clientLib,
        logger: this.logger.child('Version')
      });

      this.version = versionManager.detect();

      const adapter = new ClientApiAdapter({
        environment: this.environment,
        clientLibManager: clientLib,
        logger: this.logger.child('ClientAdapter')
      });
      const adapterReport = adapter.report();

      const compatibilityDetector = new CompatibilityDetector({
        logger: this.logger.child('Compatibility')
      });

      this.compatibility = compatibilityDetector.evaluate(
        this.environment,
        this.version,
        adapterReport
      );

      this.eventBus.emit(Events.GAME_COMPATIBILITY_CHECKED, this.compatibility);

      if (!this.compatibility.compatible) {
        throw new Error('The current game environment is not compatible.');
      }

      this.services.register('versionManager', versionManager);
      this.services.register('compatibilityDetector', compatibilityDetector);
      const performance = new PerformanceProfiler({
        logger: this.logger.child('Performance'),
        limits: { 'game-state.tick': 16, 'hub.snapshot': 25, 'module.enable': 50, 'module.open': 50 }
      });
      this.registerCoreServices({ clientLib, qx, objectDiscovery, adapter, performance });

      this.objects.set('mainData', clientLib.getMainData());
      this.objects.set('server', clientLib.getServer());
      this.objects.set('player', clientLib.getPlayer());
      this.objects.set('cities', clientLib.getCities());
      this.objects.set('world', clientLib.getWorld());
      this.objects.set('application', qx.getApplication());

      this.api = createGameApi(this);
      this.monitor = new GameStateMonitor({
        eventBus: this.eventBus,
        services: this.services,
        logger: this.logger.child('StateMonitor'),
        performance
      });

      this.watchdog = new IntegrationWatchdog({
        integration: this,
        eventBus: this.eventBus,
        logger: this.logger.child('Watchdog')
      });

      this.ready = true;
      this.monitor.start();
      this.watchdog.start();

      const payload = this.getStatus();
      this.eventBus.emit(Events.GAME_READY, payload);
      this.logger.info('Game integration layer initialized.');
      return this;
    } catch (error) {
      this.watchdog?.stop();
      this.monitor?.stop();
      this.watchdog = null;
      this.monitor = null;
      this.ready = false;
      this.services.clear();
      this.objects.clear();
      this.api = null;
      this.eventBus.emit(Events.GAME_ERROR, { error });
      throw error;
    }
  }

  shutdown() {
    this.watchdog?.stop();
    this.monitor?.stop();
    this.services.tryGet('cache')?.clear?.();
    this.watchdog = null;
    this.monitor = null;
    this.initializing = null;
    this.ready = false;
  }

  getService(name) {
    return this.services.get(name);
  }

  getObject(name) {
    return this.objects.get(name);
  }

  getPublicApi() {
    return this.api;
  }

  getStatus() {
    return Object.freeze({
      ready: this.ready,
      version: this.version,
      compatibility: this.compatibility,
      services: this.services.snapshot(),
      objects: this.objects.snapshot(),
      monitoring: Boolean(this.monitor),
      monitor: this.monitor?.getStatus?.() ?? null,
      watchdog: this.watchdog?.getStatus?.() ?? null
    });
  }
}

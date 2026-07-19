import { ClientLibService } from '../clientlib/clientlib.js';
import { PlayerService } from './player.js';
import { CityService } from './city.js';
import { WorldService } from './world.js';
import { GameScanner } from './scanner.js';
import { getGameVersion } from './version.js';
import { Events } from '../events/eventTypes.js';

export class GameService {
  constructor({ eventBus, logger }) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.clientLib = new ClientLibService(logger.child('ClientLib'));
    this.ready = false;
  }

  async initialize() {
    await this.clientLib.initialize();
    this.player = new PlayerService(this.clientLib);
    this.city = new CityService(this.clientLib);
    this.world = new WorldService(this.clientLib);
    this.scanner = new GameScanner({ world: this.world, logger: this.logger });
    this.version = getGameVersion();
    this.ready = true;
    this.eventBus.emit(Events.GAME_READY, {
      version: this.version,
      playerName: this.player.getName()
    });
    return this;
  }
}

import { GameIntegration } from './gameIntegration.js';

export class GameService {
  constructor({ eventBus, logger }) {
    this.integration = new GameIntegration({ eventBus, logger });
  }

  get ready() { return this.integration.ready; }
  get version() { return this.integration.version?.normalized || 'unknown'; }
  get compatibility() { return this.integration.compatibility; }
  get services() { return this.integration.services; }
  get objects() { return this.integration.objects; }
  get api() { return this.integration.getPublicApi(); }

  get player() { return this.api?.player; }
  get city() { return this.api?.city; }
  get world() { return this.api?.world; }
  get alliance() { return this.api?.alliance; }
  get base() { return this.api?.base; }
  get battle() { return this.api?.battle; }
  get selection() { return this.api?.selection; }
  get events() { return this.integration.eventBus; }

  async initialize() {
    await this.integration.initialize();
    return this;
  }

  shutdown() {
    this.integration.shutdown();
  }

  getService(name) { return this.integration.getService(name); }
  getObject(name) { return this.integration.getObject(name); }
  getStatus() { return this.integration.getStatus(); }
}

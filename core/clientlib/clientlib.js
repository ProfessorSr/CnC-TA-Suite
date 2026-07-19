import { discoverClientLib, discoverQxApplication } from './discovery.js';
import { getMainData } from './wrappers.js';

export class ClientLibService {
  constructor(logger) {
    this.logger = logger;
    this.clientLib = null;
    this.application = null;
  }

  async initialize() {
    this.clientLib = await discoverClientLib();
    this.application = await discoverQxApplication();
    this.logger.info('ClientLib and qx application discovered.');
    return this;
  }

  getMainData() {
    return getMainData(this.clientLib);
  }
}

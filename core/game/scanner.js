export class GameScanner {
  constructor({ world, logger }) {
    this.world = world;
    this.logger = logger;
  }

  isAvailable() {
    return Boolean(this.world.getWorld());
  }
}

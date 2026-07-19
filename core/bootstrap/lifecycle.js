export class Lifecycle {
  constructor(logger) {
    this.logger = logger;
    this.state = 'created';
  }

  transition(next) {
    this.logger.debug(`Lifecycle: ${this.state} -> ${next}`);
    this.state = next;
  }
}

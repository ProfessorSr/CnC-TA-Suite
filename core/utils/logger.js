const LEVELS = ['debug', 'info', 'warn', 'error'];

export class Logger {
  constructor(namespace = 'CnC-TA-Suite', level = 'info') {
    this.namespace = namespace;
    this.level = LEVELS.includes(level) ? level : 'info';
  }

  setLevel(level) {
    if (!LEVELS.includes(level)) throw new Error(`Invalid log level: ${level}`);
    this.level = level;
  }

  shouldLog(level) {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.level);
  }

  log(level, message, data) {
    if (!this.shouldLog(level)) return;
    const fn = console[level] || console.log;
    const prefix = `[${this.namespace}]`;
    data === undefined ? fn(prefix, message) : fn(prefix, message, data);
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }

  child(name) {
    return new Logger(`${this.namespace}:${name}`, this.level);
  }
}

export const logger = new Logger();

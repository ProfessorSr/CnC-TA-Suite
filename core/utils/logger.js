const LEVELS = ['debug', 'info', 'warn', 'error'];

export class Logger {
  constructor(namespace = 'CnC-TA-Suite', level = 'info', shared = null) {
    this.namespace = namespace;
    this.level = LEVELS.includes(level) ? level : 'info';
    this.shared = shared ?? { entries: [], limit: 300 };
  }

  setLevel(level) {
    if (!LEVELS.includes(level)) throw new Error(`Invalid log level: ${level}`);
    this.level = level;
  }

  shouldLog(level) {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.level);
  }

  log(level, message, data) {
    const entry = Object.freeze({
      timestamp: Date.now(), level, namespace: this.namespace,
      message: String(message), data: this.normalizeData(data)
    });
    this.shared.entries.push(entry);
    if (this.shared.entries.length > this.shared.limit) this.shared.entries.shift();
    if (!this.shouldLog(level)) return entry;
    const fn = console[level] || console.log;
    const prefix = `[${this.namespace}]`;
    data === undefined ? fn(prefix, message) : fn(prefix, message, data);
    return entry;
  }

  normalizeData(data) {
    if (data === undefined) return null;
    if (data instanceof Error) return Object.freeze({ name: data.name, message: data.message, stack: data.stack ?? null });
    try { return structuredClone(data); }
    catch { return String(data); }
  }

  entries({ level, namespace, limit = this.shared.limit } = {}) {
    return Object.freeze(this.shared.entries
      .filter((entry) => (!level || entry.level === level) && (!namespace || entry.namespace.startsWith(namespace)))
      .slice(-limit));
  }

  snapshot() {
    const entries = this.entries();
    return Object.freeze({ count: entries.length, errors: entries.filter((entry) => entry.level === 'error').length, entries });
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }

  child(name) {
    return new Logger(`${this.namespace}:${name}`, this.level, this.shared);
  }
}

export const logger = new Logger();

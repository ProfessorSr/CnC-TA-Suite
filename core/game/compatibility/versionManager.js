export class VersionManager {
  constructor({ clientLibManager, logger }) {
    this.clientLibManager = clientLibManager;
    this.logger = logger;
  }

  detect() {
    const server = this.clientLibManager.getServer();

    const candidates = [
      this.clientLibManager.call(server, [
        'get_Version',
        'get_ServerVersion',
        'get_Revision'
      ]),
      document.querySelector('meta[name="version"]')?.content,
      document.documentElement.dataset.version
    ];

    const raw = candidates.find((value) => value !== undefined && value !== null);
    const normalized = raw === undefined || raw === null
      ? 'unknown'
      : String(raw).trim();

    const result = Object.freeze({
      raw: raw ?? null,
      normalized,
      known: normalized !== 'unknown'
    });

    this.logger.info('Game version detected.', result);
    return result;
  }
}

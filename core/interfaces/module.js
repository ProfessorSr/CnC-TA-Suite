/**
 * Base contract for CnC-TA-Suite modules.
 *
 * Subclasses may override any lifecycle method. ModuleManager guarantees the
 * order: initialize -> load -> enable -> disable -> unload -> destroy.
 */
export class Module {
  constructor({ id, name = id, version = '0.0.0', apiVersion = '1.1.0', author = '', description = '', dependencies = [], permissions = [], settings = {}, settingsKey = id, manual = null } = {}) {
    if (!id || typeof id !== 'string') {
      throw new TypeError('Module id must be a non-empty string.');
    }

    this.id = id;
    this.name = name;
    this.version = version;
    this.apiVersion = apiVersion;
    this.author = author;
    this.description = description;
    this.permissions = Object.freeze([...permissions]);
    this.settingsSchema = Object.freeze({ ...settings });
    // Every module owns its Command Manual contribution. A module may provide
    // a richer manual object; the manifest description is the safe baseline.
    this.manual = Object.freeze({
      title: name,
      summary: description,
      steps: Object.freeze([]),
      controls: Object.freeze([]),
      notes: Object.freeze([]),
      ...(manual ?? {}),
      id
    });
    this.manifest = Object.freeze({
      id, name, version, apiVersion, author, description,
      dependencies: Object.freeze([...dependencies]),
      permissions: this.permissions,
      settings: this.settingsSchema,
      manual: this.manual
    });
    this.dependencies = Object.freeze([...dependencies]);
    this.settingsKey = settingsKey;
  }

  async initialize() {}
  async load() {}
  async enable() {}
  async disable() {}
  async unload() {}
  async destroy() {}
}

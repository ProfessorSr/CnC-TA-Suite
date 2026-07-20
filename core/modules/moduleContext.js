import { ModuleEvents } from './moduleEvents.js';

const CAPABILITIES = Object.freeze({
  storage: 'storage',
  settings: 'settings',
  theme: 'theme',
  windows: 'windows',
  notifications: 'notifications',
  ui: 'ui',
  hooks: 'hooks',
  observers: 'observers',
  game: 'game',
  hub: 'game',
  modules: 'modules',
  diagnostics: 'diagnostics',
  qx: 'qx',
});

export class ModuleContext {
  constructor(applicationContext, module, { permissions, moduleSettings } = {}) {
    if (!applicationContext) throw new TypeError('Application context is required.');
    if (!module?.id) throw new TypeError('Module is required.');

    this.module = Object.freeze({
      id: module.id,
      name: module.name ?? module.id,
      version: module.version ?? '0.0.0',
      manifest: module.manifest ?? null
    });
    
    this.logger = applicationContext.logger.child?.(`Module:${module.id}`) ?? applicationContext.logger;
    this.eventBus = applicationContext.eventBus;
    this.permissions = Object.freeze({
      allows: (permission) => permissions?.allows(module.id, permission) ?? true,
      require: (permission) => permissions?.require(module.id, permission) ?? true,
      list: () => permissions?.snapshot(module.id) ?? Object.freeze(['*'])
    });
    this.events = new ModuleEvents({
      eventBus: applicationContext.eventBus,
      moduleId: module.id,
      permissions
    });
    this.moduleSettings = moduleSettings?.scoped(module.id) ?? null;

    for (const [property, permission] of Object.entries(CAPABILITIES)) {
      const allowed = permissions?.allows(module.id, permission) ?? true;
      this[property] = allowed ? applicationContext[property] : undefined;
    }
    this.qx = permissions?.allows(module.id, 'qx')
      ? (globalThis.qx ?? null)
      : undefined;
  }

  cleanup() {
    this.events.clear();
  }
}

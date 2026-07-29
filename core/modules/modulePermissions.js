export const ModulePermission = Object.freeze({
  EVENTS: 'events',
  GAME: 'game',
  STORAGE: 'storage',
  SETTINGS: 'settings',
  THEME: 'theme',
  WINDOWS: 'windows',
  NOTIFICATIONS: 'notifications',
  UI: 'ui',
  HOOKS: 'hooks',
  OBSERVERS: 'observers',
  MODULES: 'modules',
  DIAGNOSTICS: 'diagnostics'
});

const KNOWN = new Set(Object.values(ModulePermission));

export class ModulePermissions {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.grants = new Map();
    this.explicit = new Set();
  }

  register(moduleId, requested = [], { legacyUnrestricted = false } = {}) {
    const unknown = requested.filter((permission) => permission !== '*' && !KNOWN.has(permission));
    if (unknown.length) {
      throw new Error(`Module "${moduleId}" requests unknown permissions: ${unknown.join(', ')}`);
    }

    const permissions = new Set(requested);
    if (legacyUnrestricted || permissions.has('*')) permissions.add('*');
    this.grants.set(moduleId, permissions);
    if (!legacyUnrestricted) this.explicit.add(moduleId);
    return this.snapshot(moduleId);
  }

  unregister(moduleId) {
    this.explicit.delete(moduleId);
    return this.grants.delete(moduleId);
  }

  allows(moduleId, permission) {
    const permissions = this.grants.get(moduleId);
    return Boolean(permissions && (permissions.has('*') || permissions.has(permission)));
  }

  require(moduleId, permission) {
    if (!this.allows(moduleId, permission)) {
      throw new Error(`Module "${moduleId}" does not have the "${permission}" permission.`);
    }
    return true;
  }

  isExplicit(moduleId) {
    return this.explicit.has(moduleId);
  }

  snapshot(moduleId) {
    return Object.freeze([...(this.grants.get(moduleId) ?? [])].sort());
  }
}

import { Events } from '../events/eventTypes.js';
import { ModuleContext } from './moduleContext.js';
import { ModuleRegistry } from './moduleRegistry.js';
import { ModuleLoader } from './moduleLoader.js';
import { DependencyResolver } from './dependencyResolver.js';
import { ModuleManifest } from './moduleManifest.js';
import { ModulePermissions } from './modulePermissions.js';
import { ModuleSettings } from './moduleSettings.js';
import { adoptModuleDefinition, definitionSummary } from '../ui/declarative/moduleDefinitionBridge.js';

const State = Object.freeze({
  REGISTERED: 'registered',
  LOADED: 'loaded',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  UNLOADED: 'unloaded',
  ERROR: 'error'
});

export class ModuleManager {
  constructor({ eventBus, logger, context, registry, loader, dependencyResolver, permissions, moduleSettings }) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.context = context;
    this.registry = registry ?? new ModuleRegistry({ logger });
    this.loader = loader ?? new ModuleLoader({ logger });
    this.dependencyResolver = dependencyResolver ?? new DependencyResolver();
    this.permissions = permissions ?? new ModulePermissions({ logger });
    this.moduleSettings = moduleSettings ?? new ModuleSettings({
      settings: context.settings,
      eventBus,
      logger
    });
    this.states = new Map();
    this.contexts = new Map();

  }

  register(module, options) {
    const hasExplicitManifest = Boolean(module?.manifest);
    const manifest = ModuleManifest.normalize(module);
    module.id = manifest.id;
    module.name = manifest.name;
    module.version = manifest.version;
    module.apiVersion = manifest.apiVersion;
    module.dependencies = manifest.dependencies;
    module.manual = manifest.manual;
    module.manifest = manifest;
    adoptModuleDefinition(module, manifest);

    this.permissions.register(module.id, manifest.permissions, {
      legacyUnrestricted: !hasExplicitManifest
    });
    this.moduleSettings.register(module.id, manifest.settings);

    const registered = this.registry.register(module, options);
    this.states.set(module.id, State.REGISTERED);
    this.eventBus.emit(Events.MODULE_REGISTERED, { id: module.id });
    return registered;
  }

  registerMany(modules) {
    for (const module of modules) this.register(module);
    return this;
  }

  get(id) {
    return this.registry.get(id);
  }

  getState(id) {
    return this.states.get(id) ?? null;
  }

  getEnabledSettingPath(module) {
    return `modules.${module.settingsKey ?? module.id}`;
  }

  async setEnabled(id, shouldEnable) {
    const module = this.get(id);
    if (!module) throw new Error(`Unknown module: ${id}`);

    if (shouldEnable) {
      await this.enable(id);
    } else {
      await this.disable(id);
    }

    await this.context.settings.set(this.getEnabledSettingPath(module), shouldEnable);
    return module;
  }

  async open(id) {
    const module = this.get(id);
    if (!module) throw new Error(`Unknown module: ${id}`);
    await this.enable(id);
    if (typeof module.open !== 'function') {
      throw new Error(`Module does not expose an open() method: ${id}`);
    }
    const profiler = this.context.game?.services?.tryGet?.('performance');
    const openOperation = module.definition?.renderer === 'custom' && typeof module.definition.actions?.open === 'function'
      ? () => module.definition.actions.open({
        context: this.context,
        owner: module,
        providers: module.definition.providers
      })
      : () => module.open(this.context);
    return profiler?.measureAsync
      ? profiler.measureAsync('module.open', openOperation)
      : openOperation();
  }

  getModuleContext(module) {
    if (!this.contexts.has(module.id)) {
      this.contexts.set(module.id, new ModuleContext(this.context, module, {
        permissions: this.permissions,
        moduleSettings: this.moduleSettings
      }));
    }
    return this.contexts.get(module.id);
  }

  async load(id) {
    const module = this.get(id);
    const state = this.getState(id);
    if ([State.LOADED, State.ENABLED, State.DISABLED].includes(state)) return module;

    try {
      await this.loader.load(module, this.getModuleContext(module));
      this.states.set(id, State.LOADED);
      this.eventBus.emit(Events.MODULE_LOADED, { id });
      return module;
    } catch (error) {
      this.states.set(id, State.ERROR);
      this.logger.error(`Failed to load module: ${id}`, error);
      throw error;
    }
  }

  async enable(id) {
    const module = this.get(id);
    for (const dependency of module.dependencies ?? []) {
      await this.enable(dependency);
    }

    if (this.getState(id) === State.ENABLED) return module;
    await this.load(id);

    try {
      const moduleContext = this.getModuleContext(module);
      if (typeof module.enable === 'function') {
        const profiler = this.context.game?.services?.tryGet?.('performance');
        if (profiler?.measureAsync) await profiler.measureAsync('module.enable', () => module.enable(moduleContext));
        else await module.enable(moduleContext);
      } else if (typeof module.start === 'function') {
        // Compatibility with v0.3 built-in modules.
        await module.start(this.context);
      }
      this.states.set(id, State.ENABLED);
      this.eventBus.emit(Events.MODULE_STARTED, { id });
      return module;
    } catch (error) {
      this.states.set(id, State.ERROR);
      this.logger.error(`Failed to enable module: ${id}`, error);
      throw error;
    }
  }

  async disable(id) {
    const module = this.get(id);
    if (this.getState(id) !== State.ENABLED) return module;

    const dependents = this.registry.values().filter(
      (candidate) => (candidate.dependencies ?? []).includes(id)
        && this.getState(candidate.id) === State.ENABLED
    );
    for (const dependent of dependents) await this.disable(dependent.id);

    if (typeof module.disable === 'function') {
      await module.disable(this.getModuleContext(module));
    } else if (typeof module.stop === 'function') {
      await module.stop(this.context);
    }

    this.getModuleContext(module).cleanup();
    this.states.set(id, State.DISABLED);
    this.eventBus.emit(Events.MODULE_STOPPED, { id });
    return module;
  }

  async unload(id) {
    const module = this.get(id);
    await this.disable(id);
    await this.loader.unload(module, this.getModuleContext(module));
    this.states.set(id, State.UNLOADED);
    this.eventBus.emit(Events.MODULE_UNLOADED, { id });
    this.contexts.delete(id);
    return module;
  }

  async startEnabled() {
    const ordered = this.dependencyResolver.resolve(this.registry.modules);
    for (const module of ordered) {
      const enabled = this.context.settings.get(this.getEnabledSettingPath(module), true);
      if (enabled) await this.enable(module.id);
    }
  }

  async shutdown() {
    const ordered = this.dependencyResolver.resolve(this.registry.modules).reverse();
    for (const module of ordered) {
      await this.unload(module.id);
    }
  }

  snapshot() {
    return this.registry.snapshot(this.states);
  }

  definitionSnapshot() {
    return Object.freeze(this.registry.values().map(definitionSummary).filter(Boolean));
  }
}

export { State as ModuleState };

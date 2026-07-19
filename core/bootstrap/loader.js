import { LauncherModule } from '../../modules/launcher/launcher.js';
import { SuiteStatusModule } from '../../modules/suite-status/suiteStatus.js';
import { Events } from '../events/eventTypes.js';

export class ModuleLoader {
  constructor({ eventBus, logger, context }) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.context = context;
    this.modules = new Map();
  }

  register(module) {
    if (!module?.id) throw new Error('Module must define an id.');
    if (this.modules.has(module.id)) throw new Error(`Duplicate module: ${module.id}`);
    this.modules.set(module.id, module);
    this.eventBus.emit(Events.MODULE_REGISTERED, { id: module.id });
  }

  registerBuiltIns() {
    this.register(new LauncherModule());
    this.register(new SuiteStatusModule());
  }

  async startEnabled() {
    for (const module of this.modules.values()) {
      const enabled = this.context.settings.get(`modules.${module.settingsKey}`, true);
      if (!enabled) continue;
      await module.start(this.context);
      this.eventBus.emit(Events.MODULE_STARTED, { id: module.id });
    }
  }
}

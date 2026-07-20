import { StorageService } from '../storage/storage.js';
import { SettingsService } from '../settings/settings.js';
import { ThemeService } from '../theme/theme.js';
import { WindowManager } from '../windows/windowManager.js';
import { NotificationService } from '../windows/notifications.js';
import { UIService } from '../ui/ui.js';
import { TopBarService } from '../ui/topBar.js';
import { DialogService } from '../ui/dialogs.js';
import { GameService } from '../game/game.js';
// Keep the query aligned with the suite release when the Hub contract changes.
// Chrome may retain page-context ES modules by URL across extension reloads.
import { GameDataHub } from '../game/hub/gameDataHub.js?v=1.0.0-hub1';
import { HookRegistry } from '../hooks/hooks.js';
import { ObserverRegistry } from '../hooks/observers.js';
import { ModuleManager } from '../modules/moduleManager.js';
import { DiagnosticsService } from '../diagnostics/diagnosticsService.js';
import { registeredModules } from '../modules/moduleCatalog.generated.js';

export async function createApplication({ eventBus, logger }) {
  const storage = new StorageService(logger.child('Storage'));
  const settings = new SettingsService({
    storage,
    eventBus,
    logger: logger.child('Settings')
  });
  await settings.load();
  logger.setLevel(settings.get('general.logLevel', 'info'));

  const theme = new ThemeService({ eventBus, settings });
  theme.apply();

  const windows = new WindowManager({
    eventBus,
    storage,
    settings,
    logger: logger.child('Windows')
  });

  const notifications = new NotificationService();
  const topBar = new TopBarService({ logger: logger.child('TopBar') });
  const dialogs = new DialogService();
  const ui = new UIService({
    windowManager: windows,
    notifications,
    topBar,
    dialogs
  });
  const hooks = new HookRegistry(logger.child('Hooks'));
  const observers = new ObserverRegistry(logger.child('Observers'));
  const game = new GameService({ eventBus, logger: logger.child('Game') });
  const hub = new GameDataHub({ game, logger: logger.child('Hub') });

  const context = {
    eventBus,
    logger,
    storage,
    settings,
    theme,
    windows,
    notifications,
    topBar,
    dialogs,
    ui,
    hooks,
    observers,
    game,
    hub
  };

  const modules = new ModuleManager({
    eventBus,
    logger: logger.child('Modules'),
    context
  });
  modules.registerMany(registeredModules.map((ModuleClass) => new ModuleClass()));
  context.modules = modules;
  windows.setHelpHandler(async (windowId) => {
    const candidates = modules.registry.values()
      .map((module) => module.id)
      .filter((id) => windowId === id || String(windowId).startsWith(`${id}-`))
      .sort((left, right) => right.length - left.length);
    const sectionId = candidates[0] ?? 'welcome';
    const manual = modules.get('command-manual');
    if (!manual) return null;
    await modules.enable('command-manual');
    return manual.openTo?.(sectionId, manual.context ?? context) ?? modules.open('command-manual');
  });
  context.modulePermissions = modules.permissions;
  context.moduleSettings = modules.moduleSettings;
  context.diagnostics = new DiagnosticsService({
    eventBus,
    game,
    hooks,
    observers,
    logger: logger.child('Diagnostics'),
    rootLogger: logger,
    modules,
    hub
  });

  topBar.registerLink({
    id: 'module-manager',
    label: 'Module Manager',
    order: 10,
    onExecute: () => modules.open('module-manager')
  });

  return context;
}

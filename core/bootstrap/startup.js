import { StorageService } from '../storage/storage.js';
import { SettingsService } from '../settings/settings.js';
import { ThemeService } from '../theme/theme.js';
import { WindowManager } from '../windows/windowManager.js';
import { NotificationService } from '../windows/notifications.js';
import { UIService } from '../ui/ui.js';
import { GameService } from '../game/game.js';
import { HookRegistry } from '../hooks/hooks.js';
import { ModuleLoader } from './loader.js';

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
  const ui = new UIService({ windowManager: windows, notifications });
  const hooks = new HookRegistry(logger.child('Hooks'));
  const game = new GameService({ eventBus, logger: logger.child('Game') });

  const context = {
    eventBus,
    logger,
    storage,
    settings,
    theme,
    windows,
    notifications,
    ui,
    hooks,
    game
  };

  const modules = new ModuleLoader({
    eventBus,
    logger: logger.child('Modules'),
    context
  });
  modules.registerBuiltIns();
  context.modules = modules;

  return context;
}

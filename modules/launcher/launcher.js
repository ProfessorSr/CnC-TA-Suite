import { buildLauncherWindow } from './launcherWindow.js';

export class LauncherModule {
  constructor() {
    this.id = 'launcher';
    this.settingsKey = 'launcher';
  }

  async start(context) {
    if (context.settings.get('general.showLauncherOnStartup', true)) {
      await this.open(context);
    }
  }

  async open(context) {
    return context.windows.open({
      id: 'launcher',
      title: 'CnC-TA-Suite',
      content: buildLauncherWindow(context),
      x: 24,
      y: 70,
      width: 330,
      height: 230
    });
  }
}

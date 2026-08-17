import { buildLauncherWindow } from './launcherWindow.js';

export class LauncherModule {
  constructor() {
    this.id = 'launcher';
    this.name = 'Suite Dashboard';
    this.version = '0.4.0';
    this.apiVersion = '1.0.0';
    this.author = 'ProfessorSr';
    this.lastUpdated = '2026-08-12';
    this.description = 'Live dashboard for Suite, module, base, update, and dependency status.';
    this.manual = Object.freeze({
      id: this.id, title: this.name, summary: this.description,
      steps: ['Open the Dashboard.', 'Select a status card or tab.', 'Refresh after module or game-state changes.'],
      controls: [['Status cards', 'Filter module status.'], ['Refresh', 'Rebuilds live dashboard data.']], notes: []
    });
    this.permissions = ['game', 'modules', 'windows'];
    this.settingsKey = 'launcher';
  }

  async start() {
    // Launcher is available on demand from Module Manager.
  }

  async open(context) {
    const existing = context.windows?.windows?.get?.('launcher');
    if (existing?.window && !existing.window.isDisposed?.()) {
      existing.window.open();
      existing.window.setActive?.(true);
      existing.window.focus?.();
      existing.body?.__suiteDashboardRefresh?.();
      return existing;
    }
    return context.windows.open({
      id: 'launcher',
      title: 'CnC-TA-Suite Dashboard',
      content: buildLauncherWindow(context),
      x: 24,
      y: 70,
      width: 720,
      height: 560,
      resizable: true,
      singleton: true
    });
  }
}

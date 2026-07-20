import { buildSuiteStatusWindow } from './suiteStatusWindow.js';

export class SuiteStatusModule {
  constructor() {
    this.id = 'suite-status';
    this.version = '1.0.0';
    this.author = 'ProfessorSr';
    this.settingsKey = 'suiteStatus';
  }

  async start() {
    // Status window opens on demand from the launcher.
  }

  async open(context) {
    return context.windows.open({
      id: 'suite-status',
      title: 'Suite Status',
      content: buildSuiteStatusWindow(context),
      x: 380,
      y: 70,
      width: 380,
      height: 360
    });
  }
}

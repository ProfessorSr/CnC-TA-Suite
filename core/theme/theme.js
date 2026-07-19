import { Events } from '../events/eventTypes.js';

export class ThemeService {
  constructor({ eventBus, settings }) {
    this.eventBus = eventBus;
    this.settings = settings;
  }

  apply() {
    const themeName = this.settings.get('theme.name', 'command-dark');
    document.documentElement.dataset.cncSuiteTheme = themeName;
    document.documentElement.classList.toggle(
      'cnc-suite-compact',
      this.settings.get('theme.compact', false)
    );
    this.eventBus.emit(Events.THEME_CHANGED, { themeName });
  }
}

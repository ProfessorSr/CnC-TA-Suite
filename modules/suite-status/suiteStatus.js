import { DeclarativeModule } from '../../core/ui/declarative/declarativeModule.js';
import { suiteStatusDefinition } from './suiteStatusWindow.js';

export class SuiteStatusModule extends DeclarativeModule {
  constructor() {
    super(suiteStatusDefinition);
    this.settingsKey = 'suiteStatus';
  }
}

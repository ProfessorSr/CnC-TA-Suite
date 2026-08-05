import { DeclarativeModule } from '../../core/ui/declarative/declarativeModule.js';
import { buildCommandManual } from './command-manual-window.js';

export const commandManualDefinition = Object.freeze({
  manifest: {
    id: 'command-manual', name: 'Command Manual', version: '0.4.0', apiVersion: '1.0.0', hubApiVersion: '1.0.0',
    author: 'ProfessorSr', description: 'Interactive searchable command center with contextual module help, workflows, FAQ, troubleshooting, release notes, and glossary.',
    permissions: ['modules', 'windows'], settings: {}
  },
  window: {
    title: 'CnC-TA-Suite Command Manual', icon: 'command-manual', x: 100, y: 55, width: 920, height: 680,
    tabs: [{ id: 'manual', title: 'Manual', controls: [{
      type: 'custom', render: ({ context, owner }) => buildCommandManual(context, owner)
    }] }]
  },
  providers: {}, actions: {}
});

export class CommandManualModule extends DeclarativeModule {
  constructor() { super(commandManualDefinition); }

  async openTo(sectionId = 'welcome', context = this.context) {
    const record = await this.open(context);
    this.navigateManual?.(sectionId);
    return record;
  }
}

export default CommandManualModule;

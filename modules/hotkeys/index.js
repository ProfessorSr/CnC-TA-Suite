import { DeclarativeModule } from '../../core/ui/declarative/declarativeModule.js';

const BINDS = Object.freeze([
  ['moduleManagerKey', 'Module Manager', 'module-manager', 'Alt+M'],
  ['warRoomKey', 'War Room', 'war-room', 'Alt+W'],
  ['scannerKey', 'Scanner', 'scanner', 'Alt+S'],
  ['baseInfoKey', 'Base Intelligence', 'base-intelligence', 'Alt+B'],
  ['playerDetailsKey', 'Insert Player Details', 'communications', 'Alt+P', 'player-details']
]);

function signature(event) {
  return `${event.ctrlKey ? 'Ctrl+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.metaKey ? 'Meta+' : ''}${event.key.length === 1 ? event.key.toUpperCase() : event.key}`;
}

const settings = Object.freeze(Object.fromEntries(BINDS.map(([key, label, , defaultValue]) => [key, {
  type: 'string', default: defaultValue, label
}])));

export const hotkeysDefinition = Object.freeze({
  manifest: {
    id: 'hotkeys', name: 'Hotkeys', version: '0.2.0', apiVersion: '1.0.0', hubApiVersion: '1.0.0',
    author: 'ProfessorSr', description: 'Configurable keyboard shortcuts for Suite navigation and tools.',
    permissions: ['modules', 'settings', 'windows'], settings
  },
  window: {
    title: 'Hotkeys', icon: 'hotkeys', x: 220, y: 110, width: 500, height: 390,
    tabs: [{ id: 'settings', title: 'Settings', controls: [
      { type: 'text', value: 'Enter shortcuts such as Alt+M, Ctrl+Shift+W, or Meta+B. Shortcuts are ignored while typing in fields.' },
      { type: 'settings', schema: settings, labelWidth: 180 }
    ] }]
  },
  providers: {}, actions: {}
});

export class HotkeysModule extends DeclarativeModule {
  constructor() { super(hotkeysDefinition); }

  async enable(context) {
    await super.enable(context);
    this.handler = (event) => {
      if (/INPUT|TEXTAREA/.test(event.target?.tagName ?? '')) return;
      const hit = BINDS.find(([key]) => this.context.moduleSettings.get(key, '') === signature(event));
      if (!hit) return;
      event.preventDefault();
      void this.context.modules.open(hit[2]).then(() => {
        if (hit[4] === 'player-details') {
          const module = this.context.modules.get('communications');
          module?.append?.(module.playerDetails?.());
        }
      });
    };
    globalThis.document?.addEventListener?.('keydown', this.handler);
  }

  async disable(context = this.context) {
    globalThis.document?.removeEventListener?.('keydown', this.handler);
    this.handler = null;
    await super.disable(context);
  }
}

export default HotkeysModule;

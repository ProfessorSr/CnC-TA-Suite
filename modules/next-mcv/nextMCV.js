import {
  buildNextMCVWindow,
  getNextMCVWindowController
} from './nextMCVWindow.js?v=1.0.0-mcv1';

export class NextMCVModule {
  constructor() {
    this.id = 'next-mcv';
    this.name = 'Next MCV';
    this.title = 'Next MCV';
    this.version = '0.5.0';
    this.author = 'ProfessorSr';
    this.description = 'Shows credit and research progress toward the next MCV.';
    this.manual = Object.freeze({
      id: this.id, title: this.name, summary: this.description,
      steps: ['Open Next MCV.', 'Review current, required, remaining, and ETA values.', 'Refresh after resource changes.'],
      controls: [['Refresh', 'Reads the current BaseFound requirement.'], ['Compact', 'Reduces the standalone view.']], notes: []
    });
    this.category = 'Economy';
    this.settingsKey = 'nextMCV';
  }

  async start() {
    // Opens on demand through the Hub launcher/module manager.
  }

  buildEmbedded(context) {
    return buildNextMCVWindow(context, { embedded: true });
  }

  async open(context) {
    const content = buildNextMCVWindow(context);
    const compactController = getNextMCVWindowController(content);
    const record = await context.windows.open({
      id: this.id,
      title: this.title,
      content,
      x: 410,
      y: 80,
      width: 360,
      height: 330,
      resizable: true,
      singleton: true,
      showMinimize: true
    });

    if (!record.listenerIds.compactPreventMinimize) {
      record.listenerIds.compactPreventMinimize = record.window.addListener(
        'beforeMinimize',
        (event) => event.preventDefault?.()
      );
    }

    if (!record.compactButton) {
      try {
        const button = record.window.getChildControl?.('minimize-button');
        if (!button) throw new Error('Qooxdoo minimize caption control is unavailable.');

        button.removeAllListeners?.('execute');
        button.setIcon?.(null);
        button.setLabel?.('−');
        button.setToolTipText?.('Reduce to text summary');

        let expandedBounds = null;
        button.addListener('execute', () => {
          const compact = !compactController.isCompact();
          if (compact) expandedBounds = record.window.getBounds?.() ?? null;
          compactController.setCompact(compact);
          button.setLabel?.(compact ? '□' : '−');
          button.setToolTipText?.(compact ? 'Restore detailed view' : 'Reduce to text summary');
          record.window.setWidth?.(compact ? 330 : (expandedBounds?.width ?? 360));
          record.window.setHeight?.(compact ? 100 : (expandedBounds?.height ?? 330));
        });
        record.compactButton = button;
      } catch (error) {
        context.logger?.warn?.(
          'Next MCV compact title-bar control could not be installed.',
          error
        );
      }
    }

    return record;
  }
}

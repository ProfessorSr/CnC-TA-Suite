import { element } from '../../core/utils/dom.js';
import { statusRow } from '../../core/ui/components.js';

export function buildSuiteStatusWindow(context) {
  const list = element('ul', { className: 'cnc-suite-status-list' });
  const gameReady = context.game.ready;

  list.append(
    statusRow('Bootstrap', 'Ready', true),
    statusRow('Event Bus', 'Ready', true),
    statusRow('Storage', 'Ready', true),
    statusRow('Settings', 'Ready', true),
    statusRow('Theme', 'Ready', true),
    statusRow('Window Manager', 'Ready', true),
    statusRow('Game Integration', gameReady ? 'Ready' : 'Waiting', gameReady),
    statusRow('Player', gameReady ? context.game.player.getName() : 'Unavailable', gameReady),
    statusRow('Game Version', gameReady ? context.game.version : 'Unknown', gameReady)
  );

  return element('div', {
    className: 'cnc-suite-grid',
    children: [
      element('p', {
        className: 'cnc-suite-muted',
        text: 'Current framework health'
      }),
      list
    ]
  });
}

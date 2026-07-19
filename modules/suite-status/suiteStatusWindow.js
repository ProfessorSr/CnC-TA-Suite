import { element } from '../../core/utils/dom.js';
import { statusRow } from '../../core/ui/components.js';

export function buildSuiteStatusWindow(context) {
  const list = element('ul', { className: 'cnc-suite-status-list' });
  const gameStatus = context.game.getStatus();
  const compatible = gameStatus.compatibility?.compatible ?? false;

  list.append(
    statusRow('Bootstrap', 'Ready', true),
    statusRow('Event Bus', 'Ready', true),
    statusRow('Storage', 'Ready', true),
    statusRow('Settings', 'Ready', true),
    statusRow('Theme', 'Ready', true),
    statusRow('Window Manager', 'Ready', true),
    statusRow('Game Integration', gameStatus.ready ? 'Ready' : 'Waiting', gameStatus.ready),
    statusRow('Compatibility', compatible ? 'Passed' : 'Pending', compatible),
    statusRow('Game Version', gameStatus.version?.normalized || 'Unknown', gameStatus.version?.known),
    statusRow('State Monitor', gameStatus.monitoring ? 'Running' : 'Stopped', gameStatus.monitoring),
    statusRow('Registered Services', String(Object.keys(gameStatus.services || {}).length), true),
    statusRow('Registered Objects', String(Object.keys(gameStatus.objects || {}).length), true)
  );

  return element('div', {
    className: 'cnc-suite-grid',
    children: [
      element('p', {
        className: 'cnc-suite-muted',
        text: 'Current framework and game-integration health'
      }),
      list
    ]
  });
}

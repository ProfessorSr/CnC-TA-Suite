import { element } from '../../core/utils/dom.js';
import { statusRow } from '../../core/ui/components.js';

export function buildSuiteStatusWindow(context) {
  const list = element('ul', { className: 'cnc-suite-status-list' });
  const diagnostics = context.diagnostics.snapshot();
  const health = context.diagnostics.health();
  const gameStatus = diagnostics.game;
  const compatible = gameStatus.compatibility?.compatible ?? false;

  list.append(
    statusRow('Overall Health', health.healthy ? 'Healthy' : 'Needs Attention', health.healthy),
    statusRow('Bootstrap', 'Ready', true),
    statusRow('Game Integration', gameStatus.ready ? 'Ready' : 'Waiting', gameStatus.ready),
    statusRow('Compatibility', compatible ? 'Passed' : 'Pending', compatible),
    statusRow(
      'Game Version',
      gameStatus.version?.known
        ? gameStatus.version.normalized
        : 'Unknown (Compatible Runtime)',
      gameStatus.version?.known || compatible
    ),
    statusRow(
      'Runtime Fingerprint',
      gameStatus.version?.runtimeFingerprint || 'Unavailable',
      Boolean(gameStatus.version?.runtimeFingerprint)
    ),
    statusRow('State Monitor', diagnostics.monitor.running ? 'Running' : 'Stopped', diagnostics.monitor.running),
    statusRow('Monitor Errors', String(diagnostics.monitor.errorCount ?? 0), (diagnostics.monitor.errorCount ?? 0) === 0),
    statusRow('Watchdog Failures', String(gameStatus.watchdog?.failures ?? 0), (gameStatus.watchdog?.failures ?? 0) === 0),
    statusRow('Registered Services', String(Object.keys(gameStatus.services || {}).length), true),
    statusRow('Registered Objects', String(Object.keys(gameStatus.objects || {}).length), true),
    statusRow('Cache Entries', String(diagnostics.cache?.size ?? 0), true),
    statusRow('Cache Hits / Misses', `${diagnostics.cache?.metrics?.hits ?? 0} / ${diagnostics.cache?.metrics?.misses ?? 0}`, true),
    statusRow('Event Listeners', String(diagnostics.eventBus?.listenerCount ?? 0), true),
    statusRow('Event Errors', String(diagnostics.eventBus?.failed ?? 0), (diagnostics.eventBus?.failed ?? 0) === 0),
    statusRow('Hooks / Observers', `${diagnostics.hooks.length} / ${diagnostics.observers.length}`, true)
  );

  return element('div', {
    className: 'cnc-suite-grid',
    children: [
      element('p', {
        className: 'cnc-suite-muted',
        text: 'Live framework, integration, cache, event, and lifecycle diagnostics'
      }),
      list
    ]
  });
}

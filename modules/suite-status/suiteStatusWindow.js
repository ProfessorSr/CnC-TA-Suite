import { statusRow } from '../../core/ui/components.js';

export function buildSuiteStatusWindow(context) {
  const qx = globalThis.qx;
  const content = new qx.ui.container.Composite(
    new qx.ui.layout.VBox(8)
  );
  const diagnostics = context.diagnostics.snapshot();
  const health = context.diagnostics.health();
  const gameStatus = diagnostics.game;
  const compatible = gameStatus.compatibility?.compatible ?? false;

  const description = new qx.ui.basic.Label(
    'Live framework, integration, cache, event, and lifecycle diagnostics'
  );
  description.set({ wrap: true });
  content.add(description);

  const rows = [
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
  ];

  for (const row of rows) content.add(row);
  return content;
}

import { DeclarativeRenderer } from '../../core/ui/declarative/declarativeRenderer.js';

const status = (label, value, ok = () => true, fallback) => ({ label, value, ok, fallback });

export const suiteStatusDefinition = Object.freeze({
  manifest: {
    id: 'suite-status', name: 'Suite Status', version: '1.0.0', apiVersion: '1.0.0', hubApiVersion: '1.0.0',
    author: 'ProfessorSr', description: 'Live framework, compatibility, performance, and lifecycle diagnostics.',
    permissions: ['diagnostics', 'windows'], settings: {}
  },
  window: {
    title: 'Suite Status', icon: 'status', x: 380, y: 70, width: 430, height: 500,
    toolbar: [{ id: 'refresh', label: 'Refresh', tooltip: 'Refresh live diagnostics' }],
    tabs: [{
      id: 'status', title: 'Status', controls: [
        { type: 'text', value: 'Live framework, integration, compatibility, cache, event, performance, and lifecycle diagnostics.', color: '#d5e2e8' },
        { type: 'status-list', provider: 'status', items: [
          status('Overall Health', (data) => data.health.healthy ? 'Healthy' : 'Needs Attention', (data) => data.health.healthy),
          status('Game Integration', (data) => data.diagnostics.game.ready ? 'Ready' : 'Waiting', (data) => data.diagnostics.game.ready),
          status('Compatibility', (data) => data.diagnostics.game.compatibility?.compatible ? 'Passed' : 'Pending', (data) => data.diagnostics.game.compatibility?.compatible),
          status('EA Build', (data) => data.diagnostics.game.version?.support?.status ?? 'Unverified', (data) => !data.diagnostics.game.version?.support?.migrationRequired),
          status('Runtime Fingerprint', 'diagnostics.game.version.runtimeFingerprint', (data) => Boolean(data.diagnostics.game.version?.runtimeFingerprint), 'Unavailable'),
          status('State Monitor', (data) => data.diagnostics.monitor.running ? 'Running' : 'Stopped', (data) => data.diagnostics.monitor.running),
          status('Monitor Errors', (data) => String(data.diagnostics.monitor.errorCount ?? 0), (data) => (data.diagnostics.monitor.errorCount ?? 0) === 0),
          status('Event Errors', (data) => String(data.diagnostics.eventBus?.failed ?? 0), (data) => (data.diagnostics.eventBus?.failed ?? 0) === 0),
          status('Structured Log Errors', (data) => String(data.diagnostics.logs?.errors ?? 0), (data) => (data.diagnostics.logs?.errors ?? 0) === 0),
          status('Performance Violations', (data) => String(data.diagnostics.performance?.violations?.length ?? 0), (data) => (data.diagnostics.performance?.violations?.length ?? 0) === 0),
          status('Cache Hits / Misses', (data) => `${data.diagnostics.cache?.metrics?.hits ?? 0} / ${data.diagnostics.cache?.metrics?.misses ?? 0}`),
          status('Hooks / Observers', (data) => `${data.diagnostics.hooks.length} / ${data.diagnostics.observers.length}`)
        ] }
      ]
    }]
  },
  providers: {
    status: ({ context }) => ({ diagnostics: context.diagnostics.snapshot(), health: context.diagnostics.health() })
  },
  actions: {}
});

export function buildSuiteStatusWindow(context) {
  return new DeclarativeRenderer({ definition: suiteStatusDefinition, context, owner: null }).build();
}

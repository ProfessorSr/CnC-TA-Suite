import { Module } from '../../core/interfaces/module.js';
import { inspectPublicApi, redactedExport, safeClone } from './api-inspector-utils.js';

const EXAMPLES = Object.freeze([
  ['Current player', 'CnCTASuite.game.player.current()'],
  ['Owned bases', 'CnCTASuite.game.city.all()'],
  ['World information', 'CnCTASuite.game.world.info()'],
  ['Current alliance', 'CnCTASuite.game.alliance.current()'],
  ['Selected base', 'CnCTASuite.game.base.selected()'],
  ['Battle state', 'CnCTASuite.game.battle.state()'],
  ['Current selection', 'CnCTASuite.game.selection.snapshot()'],
  ['Cache status', 'CnCTASuite.game.cache.snapshot()'],
  ['Diagnostic health', 'CnCTASuite.diagnostics.health()'],
  ['Diagnostic snapshot', 'CnCTASuite.diagnostics.snapshot()']
]);

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

function summary(entry) {
  if (!entry?.available) return entry?.error ?? 'Unavailable';
  const value = entry.value;
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value == null) return 'No current value';
  if (typeof value === 'object') return `${Object.keys(value).length} field(s)`;
  return String(value);
}

export class ApiInspectorModule extends Module {
  constructor() {
    super({
      id: 'api-inspector',
      name: 'API Inspector',
      version: '0.1.0',
      apiVersion: '1.0.0',
      author: 'ProfessorSr',
      description: 'Inspect the frozen public Suite API and export redacted diagnostics.',
      permissions: ['game', 'diagnostics', 'modules', 'windows'],
      settings: {}
    });
  }

  async enable(context) {
    this.context = context;
  }

  publicApi() {
    return globalThis.CnCTASuite?.game
      ?? this.context?.game?.integration?.api
      ?? this.context?.game?.api
      ?? null;
  }

  refresh() {
    this.snapshot = inspectPublicApi(this.publicApi());
    const health = this.context?.diagnostics?.health?.() ?? { healthy: false, checks: {} };
    const modules = this.context?.modules?.snapshot?.() ?? {};
    this.overviewModel?.setData?.([
      ['Suite version', globalThis.CnCTASuite?.version ?? '1.0.0'],
      ['Public API ready', this.snapshot.ready ? 'Yes' : 'No'],
      ['Game version', this.snapshot.version],
      ['Diagnostic health', health.healthy ? 'Healthy' : 'Attention required'],
      ['Cataloged modules', Object.keys(modules).length],
      ['Public services', Object.keys(this.snapshot.services).length]
    ]);
    this.serviceModel?.setData?.(Object.entries(this.snapshot.services).map(([name, entry]) => [
      name,
      entry.available ? 'Available' : 'Unavailable',
      summary(entry)
    ]));
    this.snapshotArea?.setValue?.(stringify(safeClone(this.snapshot)));
    this.diagnosticsArea?.setValue?.(stringify(redactedExport({
      suiteVersion: globalThis.CnCTASuite?.version ?? '1.0.0',
      apiSnapshot: this.snapshot,
      diagnostics: this.context?.diagnostics?.snapshot?.() ?? null
    })));
    this.status?.setValue?.('Snapshots refreshed from the frozen public API. No mutable ClientLib objects are displayed.');
  }

  table(qx, columns) {
    const model = new qx.ui.table.model.Simple();
    model.setColumns(columns);
    return { model, widget: new qx.ui.table.Table(model).set({ statusBarVisible: false }) };
  }

  async copy(text, label) {
    if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
    else globalThis.prompt?.(`Copy ${label}`, text);
    this.status.setValue(`${label} copied.`);
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 9 });
    const toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const refresh = new qx.ui.form.Button('Refresh');
    const copySnapshot = new qx.ui.form.Button('Copy API Snapshot');
    const copyDiagnostics = new qx.ui.form.Button('Copy Redacted Diagnostics');
    toolbar.add(refresh); toolbar.add(copySnapshot); toolbar.add(copyDiagnostics);
    toolbar.add(new qx.ui.core.Spacer(), { flex: 1 });
    root.add(toolbar);

    this.status = new qx.ui.basic.Label('').set({ textColor: '#ffffff', wrap: true });
    root.add(this.status);
    const tabs = new qx.ui.tabview.TabView();

    const overview = new qx.ui.tabview.Page('Overview').set({ layout: new qx.ui.layout.VBox(6) });
    const overviewTable = this.table(qx, ['Field', 'Value']);
    this.overviewModel = overviewTable.model;
    overview.add(overviewTable.widget, { flex: 1 });
    tabs.add(overview);

    const services = new qx.ui.tabview.Page('Services').set({ layout: new qx.ui.layout.VBox(6) });
    const serviceTable = this.table(qx, ['Service', 'Status', 'Summary']);
    this.serviceModel = serviceTable.model;
    services.add(serviceTable.widget, { flex: 1 });
    tabs.add(services);

    const snapshots = new qx.ui.tabview.Page('Snapshots').set({ layout: new qx.ui.layout.VBox(6) });
    this.snapshotArea = new qx.ui.form.TextArea().set({ readOnly: true, wrap: false });
    snapshots.add(this.snapshotArea, { flex: 1 });
    tabs.add(snapshots);

    const examples = new qx.ui.tabview.Page('Examples').set({ layout: new qx.ui.layout.VBox(6) });
    const exampleTable = this.table(qx, ['Purpose', 'Public API call']);
    exampleTable.model.setData(EXAMPLES.map((entry) => [...entry]));
    examples.add(new qx.ui.basic.Label('Examples are documentation only; the inspector does not evaluate arbitrary code.').set({ textColor: '#ffffff' }));
    examples.add(exampleTable.widget, { flex: 1 });
    tabs.add(examples);

    const diagnostics = new qx.ui.tabview.Page('Diagnostics').set({ layout: new qx.ui.layout.VBox(6) });
    this.diagnosticsArea = new qx.ui.form.TextArea().set({ readOnly: true, wrap: false });
    diagnostics.add(this.diagnosticsArea, { flex: 1 });
    tabs.add(diagnostics);

    root.add(tabs, { flex: 1 });
    refresh.addListener('execute', () => this.refresh());
    copySnapshot.addListener('execute', () => { void this.copy(this.snapshotArea.getValue(), 'API snapshot'); });
    copyDiagnostics.addListener('execute', () => { void this.copy(this.diagnosticsArea.getValue(), 'redacted diagnostics'); });
    this.refresh();
    return root;
  }

  async open(context = this.context) {
    if (!this.context) await this.enable(context);
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.refresh();
      this.record.window.open();
      this.record.window.setActive?.(true);
      return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'api-inspector',
      title: 'API Inspector',
      content: this.build(),
      x: 180,
      y: 90,
      width: 820,
      height: 560,
      resizable: true,
      singleton: true
    });
    return this.record;
  }

  async disable(context = this.context) {
    context?.windows?.close?.('api-inspector');
    this.record = null;
    this.context = null;
  }
}

export default ApiInspectorModule;

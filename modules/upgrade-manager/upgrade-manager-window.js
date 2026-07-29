function white(qx, text, options = {}) {
  return new qx.ui.basic.Label(text).set({ textColor: '#ffffff', rich: true, ...options });
}

function number(value) { return Math.round(Number(value) || 0).toLocaleString(); }

function eta(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds <= 0) return 'Now';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export class UpgradeManagerWindow {
  constructor({ context, getState, refresh, upgradeSelected, upgradeAll, upgradeToLevel }) {
    this.context = context;
    this.getState = getState;
    this.requestRefresh = refresh;
    this.upgradeSelected = upgradeSelected;
    this.upgradeAll = upgradeAll;
    this.upgradeToLevel = upgradeToLevel;
    this.record = null;
    this.activityEntries = [];
  }

  widgetAvailable(widget) {
    return Boolean(widget && !widget.isDisposed?.());
  }

  clearWidgetReferences() {
    this.model = null;
    this.table = null;
    this.overviewStatus = null;
    this.strategy = null;
    this.baseBox = null;
    this.typeBox = null;
    this.baseTypeBox = null;
    this.activity = null;
  }

  setting(key, fallback) { return this.context.moduleSettings.get(key, fallback); }

  async setSetting(key, value) {
    await this.context.moduleSettings.set(key, value);
    this.requestRefresh();
  }

  check(qx, label, key, fallback = false) {
    const control = new qx.ui.form.CheckBox(label).set({ value: this.setting(key, fallback), textColor: '#ffffff' });
    control.addListener('changeValue', (event) => { void this.setSetting(key, Boolean(event.getData())); });
    return control;
  }

  buildOverview(qx) {
    const page = new qx.ui.tabview.Page('Overview').set({ layout: new qx.ui.layout.VBox(7), padding: 8 });
    const toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const refresh = new qx.ui.form.Button('Refresh');
    const selected = new qx.ui.form.Button('Upgrade Selected');
    const highest = new qx.ui.form.Button('Upgrade Highest Ranked');
    const all = new qx.ui.form.Button('Upgrade All Eligible');
    const targetLabel = white(qx, 'Target', { alignY: 'middle' });
    this.bulkTargetLevel = new qx.ui.form.Spinner(1, this.setting('targetLevel', 65), 80).set({ width: 68 });
    const allToTarget = new qx.ui.form.Button('Upgrade Eligible to Level');
    refresh.addListener('execute', () => this.requestRefresh());
    selected.addListener('execute', () => { void this.upgradeSelected(this.selectedCandidate()); });
    highest.addListener('execute', () => { void this.upgradeSelected(this.filtered?.[0]); });
    all.addListener('execute', () => { void this.upgradeAll(this.filtered ?? []); });
    allToTarget.addListener('execute', () => {
      void this.upgradeToLevel(this.filtered ?? [], Number(this.bulkTargetLevel.getValue()));
    });
    for (const button of [refresh, selected, highest, all]) toolbar.add(button);
    toolbar.add(targetLabel);
    toolbar.add(this.bulkTargetLevel);
    toolbar.add(allToTarget);
    page.add(toolbar);

    this.model = new qx.ui.table.model.Simple();
    this.model.setColumns(['Base', 'Category', 'Upgrade', 'Level', 'Tiberium', 'Crystal', 'Power', 'Shortfall', 'ETA', 'Status']);
    this.table = new qx.ui.table.Table(this.model).set({ statusBarVisible: true });
    [125, 75, 145, 55, 85, 85, 85, 160, 70, 100].forEach((width, index) =>
      this.table.getTableColumnModel().setColumnWidth(index, width)
    );
    page.add(this.table, { flex: 1 });
    this.overviewStatus = white(qx, 'Loading candidates…');
    page.add(this.overviewStatus);
    return page;
  }

  selectedCandidate() {
    const row = this.table?.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
    return row >= 0 ? this.filtered?.[row] : null;
  }

  buildFilters(qx) {
    const page = new qx.ui.tabview.Page('Filters & Strategy').set({ layout: new qx.ui.layout.VBox(8), padding: 10 });
    const categories = new qx.ui.groupbox.GroupBox('Categories').set({ layout: new qx.ui.layout.HBox(12), padding: 8 });
    categories.add(this.check(qx, 'Buildings', 'categoryBuildings', true));
    categories.add(this.check(qx, 'Defense', 'categoryDefense', true));
    categories.add(this.check(qx, 'Offense', 'categoryOffense', true));
    categories.add(this.check(qx, 'Affordable only', 'affordableOnly'));
    categories.add(this.check(qx, 'Resource-only mode', 'resourceOnly'));
    page.add(categories);

    const strategyRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    strategyRow.add(white(qx, 'Ranking strategy', { alignY: 'middle' }));
    this.strategy = new qx.ui.form.SelectBox().set({ width: 200 });
    for (const [label, id] of [
      ['Most productive', 'productive'], ['Collector-heavy / new world', 'collector-heavy'],
      ['Power-heavy / old world', 'power-heavy'], ['Lowest cost', 'lowest-cost'], ['Highest level', 'highest-level']
    ]) this.strategy.add(new qx.ui.form.ListItem(label, null, id));
    const selected = this.strategy.getSelectables().find((item) => item.getModel() === this.setting('strategy', 'productive'));
    if (selected) this.strategy.setSelection([selected]);
    this.strategy.addListener('changeSelection', () => void this.setSetting('strategy', this.strategy.getSelection()[0]?.getModel() ?? 'productive'));
    strategyRow.add(this.strategy);
    strategyRow.add(white(qx, 'Target level', { alignY: 'middle' }));
    const target = new qx.ui.form.Spinner(1, this.setting('targetLevel', 65), 80).set({ width: 70 });
    target.addListener('changeValue', (event) => void this.setSetting('targetLevel', Number(event.getData())));
    strategyRow.add(target);
    page.add(strategyRow);

    this.baseBox = new qx.ui.groupbox.GroupBox('Enabled bases').set({ layout: new qx.ui.layout.Flow(12, 6), padding: 8 });
    this.typeBox = new qx.ui.groupbox.GroupBox('Enabled building and unit types').set({ layout: new qx.ui.layout.Flow(12, 6), padding: 8 });
    this.baseTypeBox = new qx.ui.groupbox.GroupBox('Per-base building and unit types').set({ layout: new qx.ui.layout.Flow(12, 6), padding: 8 });
    page.add(this.baseBox);
    page.add(this.typeBox, { flex: 1 });
    page.add(this.baseTypeBox, { flex: 1 });
    return page;
  }

  buildActivity(qx) {
    const page = new qx.ui.tabview.Page('Activity').set({ layout: new qx.ui.layout.VBox(8), padding: 10 });
    const clear = new qx.ui.form.Button('Clear').set({ width: 65 });
    clear.addListener('execute', () => { this.activityEntries = []; this.renderActivity(); });
    page.add(clear);
    this.activity = white(qx, 'No upgrade activity yet.', { wrap: true });
    page.add(this.activity, { flex: 1 });
    return page;
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 5, textColor: '#ffffff' });
    const tabs = new qx.ui.tabview.TabView();
    tabs.add(this.buildOverview(qx));
    tabs.add(this.buildFilters(qx));
    tabs.add(this.buildActivity(qx));
    root.add(tabs, { flex: 1 });
    return root;
  }

  rebuildChecks(box, items, settingKey) {
    if (!this.widgetAvailable(box)) return;
    box.removeAll();
    const states = this.setting(settingKey, {});
    for (const item of items) {
      const check = new globalThis.qx.ui.form.CheckBox(item.label).set({ value: states[item.id] !== false, textColor: '#ffffff' });
      check.addListener('changeValue', async (event) => {
        await this.setSetting(settingKey, { ...this.setting(settingKey, {}), [item.id]: Boolean(event.getData()) });
      });
      box.add(check);
    }
  }

  render() {
    const state = this.getState();
    this.filtered = state.filtered;
    if (this.widgetAvailable(this.model)) this.model.setData(state.filtered.map((item) => [
      item.base, item.category, item.name, `${item.level} → ${item.nextLevel}`,
      number(item.costs.tiberium), number(item.costs.crystal), number(item.costs.power),
      Object.entries(item.shortfall).filter(([, value]) => value > 0).map(([key, value]) => `${key} ${number(value)}`).join(', ') || 'None',
      eta(item.etaSeconds), item.damaged ? 'Damaged' : item.affordable ? 'Affordable' : 'Waiting'
    ]));
    if (this.widgetAvailable(this.overviewStatus)) {
      this.overviewStatus.setValue(`${state.filtered.length} candidates · ${state.filtered.filter((item) => item.affordable).length} affordable`);
    }
    this.rebuildChecks(this.baseBox, state.bases.map((base) => ({ id: base.id, label: base.name })), 'baseStates');
    this.rebuildChecks(this.typeBox, state.types.map((name) => ({ id: name, label: name })), 'typeStates');
    this.rebuildChecks(this.baseTypeBox, state.baseTypes, 'baseTypeStates');
  }

  addActivity(message, date = new Date()) {
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    this.activityEntries.unshift({ time, message });
    this.activityEntries = this.activityEntries.slice(0, 100);
    this.renderActivity();
  }

  renderActivity() {
    if (!this.widgetAvailable(this.activity)) return;
    this.activity.setValue(this.activityEntries.length ? this.activityEntries.map((entry) =>
      `<span style="color:#9fb3c8">${escapeHtml(entry.time)}</span>&nbsp;&nbsp;${escapeHtml(entry.message)}`
    ).join('<br>') : 'No upgrade activity yet.');
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.record.window.open();
      this.record.window.setActive?.(true);
      this.render();
      this.renderActivity();
      return this.record;
    }
    this.record = null;
    this.clearWidgetReferences();
    this.record = await this.context.windows.open({
      id: 'upgrade-manager', title: 'Upgrade Manager', content: this.build(),
      x: 90, y: 70, width: 1080, height: 680, resizable: true, singleton: true
    });
    this.render();
    this.renderActivity();
    return this.record;
  }
}

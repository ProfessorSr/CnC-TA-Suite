function table(qx, columns, widths) {
  const model = new qx.ui.table.model.Simple(); model.setColumns(columns);
  const widget = new qx.ui.table.Table(model).set({ statusBarVisible: true });
  widths.forEach((width, index) => widget.getTableColumnModel().setColumnWidth(index, width));
  return { model, widget };
}

const LABELS = Object.freeze({
  move: 'Move base', ruin: 'Create ruin', 'ruin-for': 'Create ruin for',
  level: 'Level up', remove: 'Remove object'
});

export class StrategicPlannerWindow {
  constructor({ context, planner }) {
    this.context = context;
    this.planner = planner;
    this.record = null;
    this.selection = null;
    this.pendingType = 'move';
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 8, textColor: '#ffffff' });
    const warning = new qx.ui.basic.Label(
      '<b>Planning preview only.</b> No base, ruin, territory, or world object is changed in the live game.'
    ).set({ rich: true, wrap: true, textColor: '#ffcf66' });
    root.add(warning);

    const controls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    this.action = new qx.ui.form.SelectBox().set({ width: 150 });
    for (const [type, label] of Object.entries(LABELS)) this.action.add(new qx.ui.form.ListItem(label, null, type));
    this.x = new qx.ui.form.Spinner(0, 0, 9999).set({ width: 72 });
    this.y = new qx.ui.form.Spinner(0, 0, 9999).set({ width: 72 });
    this.level = new qx.ui.form.Spinner(1, 1, 100).set({ width: 65 });
    this.ruinOwner = new qx.ui.form.TextField().set({ width: 145, placeholder: 'Ruin alliance/name' });
    const add = new qx.ui.form.Button('Add Plan');
    const undo = new qx.ui.form.Button('Undo Latest');
    const reset = new qx.ui.form.Button('Reset to Live');
    controls.add(this.action); controls.add(new qx.ui.basic.Label('X').set({ textColor: '#fff', alignY: 'middle' })); controls.add(this.x);
    controls.add(new qx.ui.basic.Label('Y').set({ textColor: '#fff', alignY: 'middle' })); controls.add(this.y);
    controls.add(new qx.ui.basic.Label('Level').set({ textColor: '#fff', alignY: 'middle' })); controls.add(this.level);
    controls.add(this.ruinOwner); controls.add(add); controls.add(undo); controls.add(reset);
    root.add(controls);
    this.subject = new qx.ui.basic.Label('Open this planner from a contextual object menu.').set({ textColor: '#ffffff' });
    root.add(this.subject);

    const tabs = new qx.ui.tabview.TabView();
    const plansPage = new qx.ui.tabview.Page('Planned Changes').set({ layout: new qx.ui.layout.VBox(5), padding: 6 });
    this.plans = table(qx, ['#', 'Action', 'Object', 'From', 'To / Result', 'Time'], [40, 125, 175, 85, 190, 145]);
    plansPage.add(this.plans.widget, { flex: 1 }); tabs.add(plansPage);
    const territoryPage = new qx.ui.tabview.Page('Territory & Influence').set({ layout: new qx.ui.layout.VBox(6), padding: 8 });
    this.territory = new qx.ui.basic.Label('').set({ rich: true, wrap: true, textColor: '#ffffff' });
    territoryPage.add(this.territory); tabs.add(territoryPage);
    const tunnelsPage = new qx.ui.tabview.Page('Nearby Tunnels').set({ layout: new qx.ui.layout.VBox(5), padding: 6 });
    this.tunnels = table(qx, ['Coordinates', 'Tunnel level', 'Distance', 'Current offense', 'Required offense', 'Status'], [100, 95, 85, 105, 110, 100]);
    tunnelsPage.add(this.tunnels.widget, { flex: 1 }); tabs.add(tunnelsPage);
    root.add(tabs, { flex: 1 });
    this.status = new qx.ui.basic.Label('').set({ textColor: '#cbd8df', wrap: true }); root.add(this.status);

    this.action.addListener('changeSelection', () => this.updateControlState());
    add.addListener('execute', () => this.addPlan());
    undo.addListener('execute', () => { this.planner.undo(); this.render(); });
    reset.addListener('execute', () => { this.planner.reset(); this.render(); });
    this.updateControlState(); this.render();
    return root;
  }

  selectedType() { return this.action?.getSelection?.()?.[0]?.getModel?.() ?? this.pendingType; }
  setType(type) {
    if (!type || !this.action) return;
    const item = this.action.getSelectables().find((entry) => entry.getModel() === type);
    if (item) this.action.setSelection([item]);
  }
  updateControlState() {
    const type = this.selectedType();
    this.x?.setEnabled?.(type === 'move'); this.y?.setEnabled?.(type === 'move');
    this.level?.setEnabled?.(type === 'level'); this.ruinOwner?.setEnabled?.(type === 'ruin-for');
  }

  addPlan() {
    try {
      if (!this.selection) throw new Error('Open the planner from a selected map object first.');
      const type = this.selectedType();
      this.planner.add(type, this.selection, {
        x: this.x.getValue(), y: this.y.getValue(), level: this.level.getValue(), ruinOwner: this.ruinOwner.getValue()
      });
      this.render();
    } catch (error) { this.status.setValue(error?.message ?? String(error)); }
  }

  render() {
    if (!this.plans) return;
    const analysis = this.planner.analysis(this.selection);
    this.plans.model.setData(analysis.operations.map((operation, index) => [
      index + 1, LABELS[operation.type] ?? operation.type, operation.object.name,
      `${operation.object.x}:${operation.object.y}`,
      operation.type === 'move' ? `${operation.destination.x}:${operation.destination.y}`
        : operation.type === 'level' ? `Level ${operation.level}`
          : operation.type === 'ruin-for' ? `Ruin for ${operation.ruinOwner}` : LABELS[operation.type],
      new Date(operation.at).toLocaleTimeString()
    ]));
    const conflicts = analysis.conflicts.length
      ? analysis.conflicts.map((item) => `<span style="color:#ff6868">${item}</span>`).join('<br>')
      : '<span style="color:#54d67a">No live-position conflicts detected.</span>';
    this.territory.setValue(
      `<b>Projected objects:</b> ${analysis.projected.length}<br>`
      + `<b>Estimated influenced cells:</b> ${analysis.influenceCells.toLocaleString()}<br>`
      + `<b>Planning history hash:</b> ${analysis.historyHash}<br><br>${conflicts}`
    );
    this.tunnels.model.setData(analysis.tunnels.map((tunnel) => [
      `${tunnel.x}:${tunnel.y}`, tunnel.level, tunnel.distance.toFixed(2),
      tunnel.offense.toFixed(1), tunnel.requiredOffense, tunnel.usable ? 'Usable' : 'Blocked'
    ]));
    const blocked = analysis.tunnels.filter((item) => !item.usable);
    this.status.setValue(
      `${analysis.operations.length} planned changes · tunnel influence ${analysis.tunnelRange} · `
      + `${analysis.tunnels.length} nearby tunnels · required offense ${blocked.length ? Math.max(...blocked.map((item) => item.requiredOffense)) : 'met'}`
    );
  }

  async open(type = null, selection = null) {
    await this.planner.load();
    if (selection) this.selection = selection;
    if (type) this.pendingType = type;
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.setType(type); this.prepareSelection(); this.render();
      this.record.window.open(); this.record.window.setActive?.(true); return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'context-strategic-planner', title: 'Strategic Planning', content: this.build(),
      x: 110, y: 75, width: 1080, height: 610, resizable: true, singleton: true
    });
    this.setType(type); this.prepareSelection(); this.render(); return this.record;
  }

  prepareSelection() {
    if (!this.selection || !this.x) return;
    this.x.setValue(Math.max(0, Number(this.selection.x) || 0));
    this.y.setValue(Math.max(0, Number(this.selection.y) || 0));
    this.level.setValue(Math.max(1, Number(this.selection.level || 0) + 1));
    this.subject.setValue(`${this.selection.name} · ${this.selection.type} · level ${this.selection.level || '—'} · ${this.selection.x}:${this.selection.y}`);
    this.updateControlState();
  }
}

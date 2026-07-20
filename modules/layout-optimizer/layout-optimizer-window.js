import { HEIGHT, WIDTH, kind } from './layout-optimizer.js';

export const EXPERIMENTAL_ONE_CLICK_BUILDING_MOVES_ENABLED = true;

function white(qx, text, options = {}) {
  return new qx.ui.basic.Label(text).set({ textColor: '#ffffff', wrap: true, ...options });
}

function number(value) { return Math.round(Number(value) || 0).toLocaleString(); }

function code(building) {
  const names = {
    'tiberium-harvester': 'TH', 'crystal-harvester': 'CH', refinery: 'REF',
    'power-plant': 'PP', accumulator: 'ACC', silo: 'SIL', other: 'BLD'
  };
  return `${names[kind(building)] ?? 'BLD'}${building.level}`;
}

export class LayoutOptimizerWindow {
  constructor({ context, hub, optimize }) {
    this.context = context;
    this.hub = hub;
    this.optimize = optimize;
    this.record = null;
    this.plan = null;
    this.snapshot = null;
    this.fixedIds = new Set();
    this.replacementIds = new Set();
  }

  weights() {
    const goal = this.goal.getSelection()[0]?.getModel() ?? 'balanced';
    if (goal === 'tiberium') return { tiberium: 100, crystal: 10, power: 10, storage: 2 };
    if (goal === 'crystal') return { tiberium: 10, crystal: 100, power: 10, storage: 2 };
    if (goal === 'power') return { tiberium: 10, crystal: 10, power: 100, storage: 2 };
    if (goal === 'custom') return {
      tiberium: this.weightTiberium.getValue(), crystal: this.weightCrystal.getValue(),
      power: this.weightPower.getValue(), storage: this.weightStorage.getValue()
    };
    return { tiberium: 34, crystal: 33, power: 33, storage: 0 };
  }

  buildGoals(qx) {
    const page = new qx.ui.tabview.Page('Goals & Constraints').set({ layout: new qx.ui.layout.VBox(8), padding: 10 });
    const goalRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    goalRow.add(white(qx, 'Production goal', { alignY: 'middle' }));
    this.goal = new qx.ui.form.SelectBox().set({ width: 210 });
    for (const [label, id] of [['Max Tiberium', 'tiberium'], ['Max Crystal', 'crystal'], ['Max Power', 'power'], ['Balanced production', 'balanced'], ['Custom percentage weights', 'custom']]) {
      this.goal.add(new qx.ui.form.ListItem(label, null, id));
    }
    goalRow.add(this.goal);
    goalRow.add(white(qx, 'Minimum storage', { alignY: 'middle' }));
    this.minimumStorage = new qx.ui.form.Spinner(0, 0, 1000000).set({ width: 120 });
    goalRow.add(this.minimumStorage);
    goalRow.add(white(qx, 'Maximum moves', { alignY: 'middle' }));
    this.maximumMoves = new qx.ui.form.Spinner(0, 12, 72).set({ width: 75 });
    goalRow.add(this.maximumMoves);
    page.add(goalRow);

    const custom = new qx.ui.groupbox.GroupBox('Custom weights (%)').set({ layout: new qx.ui.layout.HBox(8), padding: 8 });
    for (const [title, property, initial] of [['Tiberium', 'weightTiberium', 34], ['Crystal', 'weightCrystal', 33], ['Power', 'weightPower', 33], ['Storage', 'weightStorage', 0]]) {
      custom.add(white(qx, title, { alignY: 'middle' }));
      this[property] = new qx.ui.form.Spinner(0, initial, 100).set({ width: 65 });
      custom.add(this[property]);
    }
    page.add(custom);
    this.fixedBox = new qx.ui.groupbox.GroupBox('Buildings that must remain fixed').set({ layout: new qx.ui.layout.Flow(10, 5), padding: 8 });
    this.replaceBox = new qx.ui.groupbox.GroupBox('Buildings available for replacement (recommendations only)').set({ layout: new qx.ui.layout.Flow(10, 5), padding: 8 });
    page.add(this.fixedBox, { flex: 1 });
    page.add(this.replaceBox, { flex: 1 });
    const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    row.add(white(qx, 'Maximum replacements', { alignY: 'middle' }));
    this.maximumReplacements = new qx.ui.form.Spinner(0, 0, 20).set({ width: 70 });
    row.add(this.maximumReplacements);
    const calculate = new qx.ui.form.Button('Calculate Ranked Layouts');
    calculate.addListener('execute', () => this.calculate());
    row.add(calculate);
    page.add(row);
    return page;
  }

  buildLayout(qx) {
    const page = new qx.ui.tabview.Page('Layout Optimizer').set({ layout: new qx.ui.layout.VBox(7), padding: 8 });
    page.add(white(qx, 'Proposed base grid · coordinates are shown in each cell'));
    this.layoutGrid = new qx.ui.container.Composite(new qx.ui.layout.Grid(3, 3)).set({
      width: 456,
      height: 332,
      alignX: 'center',
      padding: 4,
      backgroundColor: '#101d26',
      decorator: new qx.ui.decoration.Decorator(1, 'solid', '#60798b')
    });
    for (let row = 0; row < HEIGHT; row += 1) this.layoutGrid.getLayout().setRowHeight(row, 37);
    for (let column = 0; column < WIDTH; column += 1) this.layoutGrid.getLayout().setColumnWidth(column, 47);
    this.layoutCells = [];
    for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
      const cell = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({
        padding: 2,
        backgroundColor: '#1d3342',
        decorator: new qx.ui.decoration.Decorator(1, 'solid', '#60798b')
      });
      const coordinate = white(qx, `${x + 1},${y + 1}`, { font: 'default', textColor: '#8799a6' });
      const building = white(qx, 'EMPTY', { font: 'bold', textAlign: 'center', textColor: '#71818d' });
      cell.add(coordinate);
      cell.add(building, { flex: 1 });
      this.layoutGrid.add(cell, { row: y, column: x });
      this.layoutCells.push({ x, y, cell, building });
    }
    page.add(this.layoutGrid);
    this.productionModel = new qx.ui.table.model.Simple();
    this.productionModel.setColumns(['Resource', 'Current / hour', 'Proposed / hour', 'Expected gain']);
    this.productionTable = new qx.ui.table.Table(this.productionModel).set({ statusBarVisible: false, height: 135 });
    page.add(this.productionTable);
    this.summary = white(qx, 'Choose goals and calculate a layout.', { textColor: '#d6b85a' });
    page.add(this.summary);

    const warning = new qx.ui.container.Composite(new qx.ui.layout.VBox(6)).set({
      padding: 8, backgroundColor: '#321414',
      decorator: new qx.ui.decoration.Decorator(2, 'solid', '#ff3b30')
    });
    warning.add(white(qx, '⚠ EXPERIMENTAL — ONE-CLICK BUILDING MOVEMENT', { font: 'bold', textColor: '#ff6b63' }));
    warning.add(white(qx, 'Moves are automated and may violate EA rules. Use may result in account suspension or a permanent ban. Replacements, additions, and upgrades are never executed by this button.'));
    this.apply = new qx.ui.form.Button('Apply Proposed Building Moves').set({ enabled: false, width: 245, alignX: 'left' });
    this.apply.addListener('execute', () => { void this.confirmAndApply(); });
    warning.add(this.apply);
    if (EXPERIMENTAL_ONE_CLICK_BUILDING_MOVES_ENABLED) page.add(warning);
    return page;
  }

  buildAnalysis(qx) {
    const page = new qx.ui.tabview.Page('Changes & Costs').set({ layout: new qx.ui.layout.VBox(7), padding: 8 });
    this.changeModel = new qx.ui.table.model.Simple();
    this.changeModel.setColumns(['Action', 'Building', 'From', 'To', 'Level', 'Estimated cost']);
    const table = new qx.ui.table.Table(this.changeModel).set({ statusBarVisible: true });
    page.add(table, { flex: 1 });
    this.conflicts = white(qx, 'Conflicts and unmet constraints: —');
    page.add(this.conflicts);
    return page;
  }

  buildAlternatives(qx) {
    const page = new qx.ui.tabview.Page('Alternative Layouts').set({ layout: new qx.ui.layout.VBox(7), padding: 8 });
    this.alternativeModel = new qx.ui.table.model.Simple();
    this.alternativeModel.setColumns(['Rank', 'Layout', 'Score', 'Moves', 'Storage score', 'Constraint status']);
    this.alternativeTable = new qx.ui.table.Table(this.alternativeModel).set({ statusBarVisible: true });
    this.alternativeTable.addListener('cellTap', (event) => this.selectAlternative(event.getRow?.()));
    page.add(this.alternativeTable, { flex: 1 });
    page.add(white(qx, 'Click an alternative to preview it in the Layout Optimizer tab.'));
    return page;
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 5, textColor: '#ffffff' });
    const tabs = new qx.ui.tabview.TabView();
    tabs.add(this.buildGoals(qx));
    tabs.add(this.buildLayout(qx));
    tabs.add(this.buildAnalysis(qx));
    tabs.add(this.buildAlternatives(qx));
    root.add(tabs, { flex: 1 });
    this.refreshBase();
    return root;
  }

  refreshBase() {
    try {
      this.snapshot = this.hub.snapshot();
      for (const [box, selected] of [[this.fixedBox, this.fixedIds], [this.replaceBox, this.replacementIds]]) {
        box.removeAll();
        for (const building of this.snapshot.buildings) {
          const checkbox = new globalThis.qx.ui.form.CheckBox(`${building.name} L${building.level} (${building.x + 1},${building.y + 1})`).set({ textColor: '#ffffff', value: selected.has(String(building.id)) });
          checkbox.addListener('changeValue', (event) => event.getData() ? selected.add(String(building.id)) : selected.delete(String(building.id)));
          box.add(checkbox);
        }
      }
    } catch (error) {
      this.summary?.setValue?.(`Base data unavailable: ${error?.message ?? error}`);
    }
  }

  calculate() {
    try {
      this.refreshBase();
      this.plan = this.optimize(this.snapshot, {
        weights: this.weights(), minimumStorage: this.minimumStorage.getValue(),
        maximumMoves: this.maximumMoves.getValue(), maximumReplacements: this.maximumReplacements.getValue(),
        fixedIds: this.fixedIds, replacementIds: this.replacementIds
      });
      this.showCandidate(this.plan.best);
      this.renderChanges(this.plan.recommendations);
      this.productionModel.setData([
        ...Object.entries(this.plan.production).map(([resource, values]) => [resource, number(values.current), number(values.proposed), `${values.gain >= 0 ? '+' : ''}${number(values.gain)}`]),
        ['storage capacity', number(this.plan.storage.current), number(this.plan.storage.proposed), `${this.plan.storage.proposed >= this.plan.storage.current ? '+' : ''}${number(this.plan.storage.proposed - this.plan.storage.current)}`]
      ]);
      this.alternativeModel.setData(this.plan.ranked.map((item) => [item.rank, item.name, Math.round(item.value), item.changes.length, Math.round(item.totals.storage), item.shortfall ? 'Storage unmet' : 'Valid']));
      this.conflicts.setValue(`Conflicts and unmet constraints: ${this.plan.conflicts.join(' • ') || 'None'}`);
    } catch (error) {
      this.summary.setValue(`Optimization failed: ${error?.message ?? error}`);
      this.apply.setEnabled(false);
    }
  }

  showCandidate(candidate) {
    if (!candidate) return;
    this.selectedCandidate = candidate;
    const positions = new Map(candidate.layout.map((building) => [`${building.x}:${building.y}`, building]));
    const fields = new Map((this.snapshot.resourceFields ?? []).map((field) => [`${field.x}:${field.y}`, field.type]));
    for (const entry of this.layoutCells) {
      const building = positions.get(`${entry.x}:${entry.y}`);
      const moved = building && candidate.changes.some((change) => String(change.id) === String(building.id));
      const field = fields.get(`${entry.x}:${entry.y}`);
      entry.building.setValue(building ? code(building) : field === 1 ? 'TIB' : field === 2 ? 'CRY' : 'EMPTY');
      entry.building.setTextColor(building ? '#ffffff' : field === 1 ? '#30c36b' : field === 2 ? '#3fa9f5' : '#71818d');
      entry.cell.setBackgroundColor(moved ? '#4b6d82' : building ? '#1d3342' : field ? '#162832' : '#111d25');
      entry.cell.setDecorator(new globalThis.qx.ui.decoration.Decorator(
        moved ? 2 : 1,
        'solid',
        moved ? '#f2d15e' : '#60798b'
      ));
      entry.cell.setToolTipText(building ? `${building.name} level ${building.level}` : 'Empty building slot');
    }
    this.renderChanges(candidate.changes);
    this.summary.setValue(`${this.snapshot.cityName} · ${candidate.name} · ${candidate.changes.length} building moves · score ${Math.round(candidate.value)}`);
    this.apply.setEnabled(Boolean(EXPERIMENTAL_ONE_CLICK_BUILDING_MOVES_ENABLED && candidate.changes.length));
  }

  renderChanges(changes) {
    this.changeModel.setData(changes.map((item) => {
      const cost = item.estimatedCost && Object.values(item.estimatedCost).some(Boolean)
        ? Object.entries(item.estimatedCost).filter(([, value]) => value).map(([key, value]) => `${key} ${number(value)}`).join(', ')
        : item.action === 'Move' ? 'No resource cost' : 'Requires in-game quote';
      return [item.action, item.name,
        item.fromX == null ? '—' : `${item.fromX + 1}:${item.fromY + 1}`,
        `${item.toX + 1}:${item.toY + 1}`, item.level, cost];
    }));
  }

  selectAlternative(row) {
    const candidate = this.plan?.ranked?.[row];
    if (candidate) this.showCandidate(candidate);
  }

  confirmMove() {
    const qx = globalThis.qx;
    return new Promise((resolve) => {
      const win = new qx.ui.window.Window('Experimental Building Movement Warning').set({ modal: true, showMinimize: false, showMaximize: false, showClose: false, resizable: false, width: 510, layout: new qx.ui.layout.VBox(10), padding: 12, decorator: new qx.ui.decoration.Decorator(3, 'solid', '#ff3b30') });
      win.add(white(qx, '⚠ This automated action may violate EA rules.', { font: 'bold', textColor: '#ff4d45' }));
      win.add(white(qx, `The extension will issue ${this.selectedCandidate.changes.length} building-move commands after one click. Your account could be suspended or permanently banned. Continue only on a test account and at your own risk.`));
      const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
      row.add(new qx.ui.core.Spacer(), { flex: 1 });
      for (const [title, answer] of [['Cancel', false], ['I Understand — Move Buildings', true]]) {
        const button = new qx.ui.form.Button(title);
        button.addListener('execute', () => { resolve(answer); win.close(); win.destroy(); });
        row.add(button);
      }
      win.add(row);
      qx.core.Init.getApplication().getRoot().add(win);
      win.center();
      win.open();
    });
  }

  async confirmAndApply() {
    try {
      if (!EXPERIMENTAL_ONE_CLICK_BUILDING_MOVES_ENABLED) throw new Error('Building movement is disabled in this build.');
      if (!(await this.confirmMove())) return;
      this.apply.setEnabled(false);
      const count = await this.hub.applyLayout({ cityId: this.snapshot.cityId, changes: this.selectedCandidate.changes });
      this.summary.setValue(`${count} building move commands submitted. Refresh after the game finishes processing them.`);
    } catch (error) {
      this.summary.setValue(`Building moves failed: ${error?.message ?? error}`);
      this.context.logger?.warn?.('Layout Optimizer building moves failed.', error);
    }
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.refreshBase(); this.record.window.open(); this.record.window.setActive?.(true); return this.record;
    }
    this.record = await this.context.windows.open({ id: 'layout-optimizer', title: 'Base Layout Optimizer', content: this.build(), x: 80, y: 55, width: 1120, height: 720, resizable: true, singleton: true });
    return this.record;
  }
}

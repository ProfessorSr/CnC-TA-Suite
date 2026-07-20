function white(qx, text, options = {}) { return new qx.ui.basic.Label(text).set({ textColor: '#ffffff', rich: true, wrap: true, ...options }); }
function number(value) { return Math.round(Number(value) || 0).toLocaleString(); }
function duration(seconds) {
  if (!seconds) return 'Ready';
  const h = Math.floor(seconds / 3600); const m = Math.ceil((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
function table(qx, columns, widths = []) {
  const model = new qx.ui.table.model.Simple(); model.setColumns(columns);
  const widget = new qx.ui.table.Table(model).set({ statusBarVisible: true });
  widths.forEach((width, index) => widget.getTableColumnModel().setColumnWidth(index, width));
  return { model, widget };
}
function page(qx, title) { return new qx.ui.tabview.Page(title).set({ layout: new qx.ui.layout.VBox(7), padding: 8 }); }
function compositionText(items) { return items.map((item) => `${item.name} ×${item.count}`).join(', ') || 'None'; }

export class BaseIntelligenceWindow {
  constructor({ context, hub, sticker }) { this.context = context; this.hub = hub; this.sticker = sticker; this.record = null; this.rows = []; }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 5, textColor: '#ffffff' });
    const toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const refresh = new qx.ui.form.Button('Refresh'); refresh.addListener('execute', () => this.render());
    const access = new qx.ui.form.Button('Access Selected Base'); access.addListener('execute', () => this.accessSelected());
    const sticker = new qx.ui.form.Button('Open Status Sticker'); sticker.addListener('execute', () => { void this.sticker.open(); });
    toolbar.add(refresh); toolbar.add(access); toolbar.add(sticker); toolbar.add(new qx.ui.core.Spacer(), { flex: 1 });
    this.header = white(qx, 'Loading player and world information…', { alignY: 'middle' }); toolbar.add(this.header);
    root.add(toolbar);
    const tabs = new qx.ui.tabview.TabView();

    const overview = page(qx, 'Overview');
    this.overview = table(qx, ['Information', 'Value'], [230, 600]); overview.add(this.overview.widget, { flex: 1 });
    tabs.add(overview);

    const bases = page(qx, 'Owned Bases');
    this.bases = table(qx, ['Base', 'Coordinates', 'Faction', 'Base', 'Offense', 'Defense', 'Support', 'Condition', 'Status'], [150, 90, 75, 60, 65, 65, 65, 85, 95]);
    this.bases.widget.addListener('cellDbltap', () => this.accessSelected()); bases.add(this.bases.widget, { flex: 1 });
    bases.add(white(qx, 'Double-click a base to access it directly.'));
    tabs.add(bases);

    const composition = page(qx, 'Composition');
    this.composition = table(qx, ['Base', 'Buildings', 'Offense', 'Defense', 'Support', 'Support assignment'], [120, 240, 205, 205, 135, 155]); composition.add(this.composition.widget, { flex: 1 }); tabs.add(composition);

    const resources = page(qx, 'Resources');
    this.resources = table(qx, ['Base', 'Resource', 'Stock', 'Capacity', 'Production/hr', 'Time to cap', 'Packages'], [135, 90, 115, 115, 115, 100, 90]); resources.add(this.resources.widget, { flex: 1 }); tabs.add(resources);

    const repairs = page(qx, 'Repairs');
    this.repairs = table(qx, ['Base', 'Category', 'Repair time', 'Stored charge', 'Capacity', 'Condition'], [150, 100, 110, 125, 125, 100]); repairs.add(this.repairs.widget, { flex: 1 }); tabs.add(repairs);

    const combat = page(qx, 'Combat & Loot');
    this.combat = table(qx, ['Base', 'Lootable Tiberium', 'Lootable Crystal', 'Lootable Power', 'Offense units', 'Defense units', 'Attack summary'], [145, 130, 130, 120, 105, 105, 180]); combat.add(this.combat.widget, { flex: 1 }); tabs.add(combat);

    const display = page(qx, 'Display & Tooltips');
    const modeRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    modeRow.add(white(qx, 'Sticker mode', { alignY: 'middle' }));
    const mode = new qx.ui.form.SelectBox().set({ width: 170 });
    for (const [label, id] of [['Compact', 'compact'], ['Super compact', 'super-compact']]) mode.add(new qx.ui.form.ListItem(label, null, id));
    const selectedMode = mode.getSelectables().find((item) => item.getModel() === this.context.moduleSettings.get('stickerMode', 'compact'));
    if (selectedMode) mode.setSelection([selectedMode]);
    mode.addListener('changeSelection', () => void this.context.moduleSettings.set('stickerMode', mode.getSelection()[0]?.getModel() ?? 'compact'));
    modeRow.add(mode); display.add(modeRow);
    for (const [key, title, fallback] of [
      ['stickerPinned', 'Keep sticker above other Suite windows', true],
      ['stickerLocked', 'Lock sticker position', false],
      ['showRegionDetails', 'Show offense, defense, and repair details in region information', true],
      ['showOnlineColors', 'Color online-state details for alliance player cities', true]
    ]) {
      const check = new qx.ui.form.CheckBox(title).set({ value: this.context.moduleSettings.get(key, fallback), textColor: '#ffffff' });
      check.addListener('changeValue', (event) => void this.context.moduleSettings.set(key, Boolean(event.getData()))); display.add(check);
    }
    display.add(white(qx, 'Resource order', { font: 'bold' }));
    const order = new qx.ui.form.SelectBox().set({ width: 260 });
    for (const [label, value] of [['Tiberium · Crystal · Power', 'tiberium,crystal,power'], ['Power · Tiberium · Crystal', 'power,tiberium,crystal'], ['Crystal · Tiberium · Power', 'crystal,tiberium,power']]) order.add(new qx.ui.form.ListItem(label, null, value));
    const selectedOrder = order.getSelectables().find((item) => item.getModel() === this.context.moduleSettings.get('resourceOrder', 'tiberium,crystal,power'));
    if (selectedOrder) order.setSelection([selectedOrder]);
    order.addListener('changeSelection', () => void this.context.moduleSettings.set('resourceOrder', order.getSelection()[0]?.getModel())); display.add(order);
    display.add(white(qx, 'Window positions and sizes are persisted automatically. The sticker can also use the native minimize control.'));
    tabs.add(display);

    root.add(tabs, { flex: 1 }); this.render(); return root;
  }

  selectedBase() {
    const row = this.bases?.widget?.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
    return row >= 0 ? this.rows[row] : null;
  }
  accessSelected() {
    try { const city = this.selectedBase(); if (!city) throw new Error('Select a base first.'); this.hub.focus(city.id); this.header.setValue(`Accessing ${city.name}.`); }
    catch (error) { this.header.setValue(error?.message ?? String(error)); }
  }

  render() {
    try {
      const data = this.hub.snapshot(); this.rows = data.cities;
      this.header?.setValue?.(`${data.player?.name ?? 'Player'} · ${data.cities.length} bases · ${data.world?.name ?? data.world?.id ?? 'World'}`);
      this.overview?.model?.setData?.([
        ['Player', data.player?.name ?? 'Unknown'], ['Player ID', data.player?.id ?? '—'], ['Faction', data.player?.faction ?? '—'],
        ['Rank / score', `${data.player?.rank ?? '—'} / ${number(data.player?.score)}`], ['Command points', data.player?.commandPoints ?? '—'],
        ['Alliance', data.alliance?.name ?? data.player?.allianceName ?? 'None'], ['Alliance rank / members', `${data.alliance?.rank ?? '—'} / ${data.alliance?.memberCount ?? '—'}`],
        ['World', data.world?.name ?? data.world?.id ?? 'Unknown'], ['Server', data.account.host], ['Language', data.account.language],
        ['Owned bases', data.cities.length], ['Damaged / collectable', `${data.cities.filter((city) => city.status === 'Damaged').length} / ${data.cities.filter((city) => city.collectable).length}`]
      ]);
      this.bases?.model?.setData?.(data.cities.map((city) => [city.name, `${city.x}:${city.y}`, city.faction, city.baseLevel.toFixed(1), city.offenseLevel.toFixed(1), city.defenseLevel.toFixed(1), city.supportLevel.toFixed(1), `${city.condition.toFixed(0)}%`, city.status]));
      this.composition?.model?.setData?.(data.cities.map((city) => [city.name, compositionText(city.composition.buildings), compositionText(city.composition.offense), compositionText(city.composition.defense), `${city.supportName} L${city.supportLevel}`, city.supportTarget]));
      this.resources?.model?.setData?.(data.cities.flatMap((city) => Object.entries(city.resources).map(([name, value]) => [city.name, name, number(value.current), number(value.capacity), number(value.perHour), duration(value.timeToCapSeconds), city.packageIncome[name] ? number(city.packageIncome[name]) : city.collectable ? 'Ready' : 'None'])));
      this.repairs?.model?.setData?.(data.cities.flatMap((city) => Object.entries(city.repair).map(([name, value]) => [city.name, name, duration(value.timeSeconds), number(value.stored), number(value.capacity), `${(name === 'base' ? city.baseCondition : city.offenseCondition).toFixed(0)}%`])));
      this.combat?.model?.setData?.(data.cities.map((city) => [city.name, number(city.loot.tiberium), number(city.loot.crystal), number(city.loot.power), city.counts.offense, city.counts.defense, `Base ${city.baseLevel.toFixed(1)} · Off ${city.offenseLevel.toFixed(1)} · Def ${city.defenseLevel.toFixed(1)}`]));
      if (this.sticker?.record?.window?.isVisible?.()) this.sticker.render();
    } catch (error) {
      if (this.header && !this.header.isDisposed?.()) {
        this.header.setValue?.(`Base information unavailable: ${error?.message ?? error}`);
      }
      this.context.logger?.warn?.('Base Intelligence refresh failed.', error);
    }
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) { this.render(); this.record.window.open(); this.record.window.setActive?.(true); return this.record; }
    this.record = await this.context.windows.open({ id: 'base-intelligence', title: 'Base Intelligence', content: this.build(), x: 65, y: 45, width: 1180, height: 720, resizable: true, singleton: true }); return this.record;
  }
}

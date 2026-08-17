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
function statCard(qx, title, accent = '#9fe8ff') {
  const card = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 12, backgroundColor: '#1d2d38', decorator: 'main', minHeight: 82 });
  card.add(white(qx, title.toUpperCase(), { textColor: '#8da2ad', font: 'bold' }));
  const value = white(qx, '—', { textColor: accent, font: 'bold' });
  card.add(value);
  return { card, value };
}

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
    this.header = white(qx, 'Loading player information…', { alignY: 'middle' }); toolbar.add(this.header);
    root.add(toolbar);
    const tabs = new qx.ui.tabview.TabView();

    const overview = page(qx, 'Overview');
    this.playerCard = new qx.ui.container.Composite(new qx.ui.layout.VBox(12)).set({ padding: 18, decorator: 'main', backgroundColor: '#111c23' });
    this.playerName = white(qx, 'Player', { font: 'bold', textColor: '#9fe8ff' });
    this.playerIdentity = white(qx, 'Loading…', { textColor: '#cbd8de' });
    const stats = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
    this.rankCard = statCard(qx, 'World rank', '#ffd36a');
    this.scoreCard = statCard(qx, 'Score / next level', '#9fe8ff');
    this.cpCard = statCard(qx, 'Command points', '#8dff9f');
    stats.add(this.rankCard.card, { flex: 1 }); stats.add(this.scoreCard.card, { flex: 1 }); stats.add(this.cpCard.card, { flex: 1 });
    const details = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
    const worldPanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 12, backgroundColor: '#17262f', decorator: 'main' });
    const basePanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 12, backgroundColor: '#17262f', decorator: 'main' });
    worldPanel.add(white(qx, 'WORLD & ACCOUNT', { font: 'bold', textColor: '#8da2ad' }));
    basePanel.add(white(qx, 'BASE NETWORK', { font: 'bold', textColor: '#8da2ad' }));
    this.playerWorld = white(qx, ''); this.playerSummary = white(qx, '');
    worldPanel.add(this.playerWorld); basePanel.add(this.playerSummary);
    details.add(worldPanel, { flex: 1 }); details.add(basePanel, { flex: 1 });
    this.playerCard.add(this.playerName); this.playerCard.add(this.playerIdentity); this.playerCard.add(stats); this.playerCard.add(details);
    overview.add(this.playerCard);
    tabs.add(overview);

    const achievements = page(qx, 'Achievements');
    this.achievements = table(qx, ['Achievement', 'Description', 'Progress', 'Status'], [210, 480, 120, 100]);
    achievements.add(this.achievements.widget, { flex: 1 }); tabs.add(achievements);

    const bases = page(qx, 'Owned Bases');
    this.bases = table(qx, ['Base', 'Coordinates', 'Faction', 'Base', 'Offense', 'Defense', 'Support', 'Condition', 'Status'], [150, 90, 75, 60, 65, 65, 65, 85, 95]);
    this.bases.widget.addListener('cellTap', () => this.accessSelected()); bases.add(this.bases.widget, { flex: 1 });
    bases.add(white(qx, 'Click a base row to focus that player base.'));
    tabs.add(bases);

    const support = page(qx, 'Support');
    this.support = table(qx, ['Base', 'Support structure', 'Level', 'Set on'], [190, 280, 100, 260]); support.add(this.support.widget, { flex: 1 }); tabs.add(support);

    const resources = page(qx, 'Resources');
    const collect = new qx.ui.form.Button('Collect Packages'); collect.addListener('execute', () => this.runAction('collect'));
    resources.add(collect);
    this.resources = table(qx, ['Base', 'Resource', 'Stock', 'Capacity', 'Continuous/hr', 'Package production', 'Alliance bonus/hr', 'Total/hr', 'Time to cap'], [125, 80, 95, 95, 105, 120, 115, 95, 95]); resources.add(this.resources.widget, { flex: 1 }); tabs.add(resources);

    const repairs = page(qx, 'Repairs');
    const repairAll = new qx.ui.form.Button('Repair All'); repairAll.addListener('execute', () => this.runAction('repair'));
    repairs.add(repairAll);
    this.repairs = table(qx, ['Base', 'Category', 'Repair time', 'Stored charge', 'Capacity', 'Condition'], [150, 100, 110, 125, 125, 100]); repairs.add(this.repairs.widget, { flex: 1 }); tabs.add(repairs);

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
  runAction(action) {
    try {
      const affected = action === 'collect' ? this.hub.collectPackages() : this.hub.repairAll();
      this.header.setValue(`${action === 'collect' ? 'Collected packages from' : 'Repaired'} ${affected} base${affected === 1 ? '' : 's'}.`);
      this.render();
    } catch (error) { this.header.setValue(error?.message ?? String(error)); }
  }

  render() {
    try {
      const data = this.hub.snapshot(); this.rows = data.cities;
      this.header?.setValue?.(`${data.player?.name ?? 'Player'} · ${data.cities.length} bases · ${data.world?.name ?? data.world?.id ?? 'World'}`);
      this.playerName?.setValue?.(`<span style="font-size:22px">${data.player?.name ?? 'Unknown player'}</span>`);
      this.playerIdentity?.setValue?.(`<span style="color:#8da2ad">${data.player?.faction ?? '—'} COMMANDER</span><br><b>${data.alliance?.name ?? data.player?.allianceName ?? 'No alliance'}</b>`);
      this.rankCard?.value?.setValue?.(`<span style="font-size:20px">#${data.player?.rank ?? '—'}</span>`);
      this.scoreCard?.value?.setValue?.(`<span style="font-size:20px">${data.player?.score == null ? '—' : number(data.player.score)} / ${data.player?.nextScore == null ? '—' : number(data.player.nextScore)}</span>`);
      const cpCurrent = data.player?.commandPoints == null ? '—' : number(data.player.commandPoints);
      const cpMax = data.player?.commandPointsMax == null ? '—' : number(data.player.commandPointsMax);
      this.cpCard?.value?.setValue?.(`<span style="font-size:20px">${cpCurrent} / ${cpMax}</span>`);
      this.playerWorld?.setValue?.(`<b>${data.world?.name ?? data.world?.id ?? 'Unknown world'}</b><br>${data.account.host}<br>${data.account.language}`);
      this.playerSummary?.setValue?.(`<b>${data.cities.length}</b> owned bases<br><span style="color:#ff9d8d">${data.cities.filter((city) => city.status === 'Damaged').length} damaged</span><br><span style="color:#8dff9f">${data.cities.filter((city) => city.collectable).length} ready to collect</span>`);
      this.achievements?.model?.setData?.(this.hub.achievements().map((item) => [item.name, item.description, item.target > 0 ? `${number(item.current)} / ${number(item.target)}` : number(item.current), item.complete ? 'Completed' : 'In progress']));
      this.bases?.model?.setData?.(data.cities.map((city) => [city.name, `${city.x}:${city.y}`, city.faction, city.baseLevel.toFixed(1), city.offenseLevel.toFixed(1), city.defenseLevel.toFixed(1), city.supportLevel.toFixed(1), `${city.condition.toFixed(0)}%`, city.status]));
      this.support?.model?.setData?.(data.cities.map((city) => [city.name, city.supportName, city.supportLevel.toFixed(1), city.supportTarget]));
      this.resources?.model?.setData?.(data.cities.flatMap((city) => Object.entries(city.resources).map(([name, value]) => [city.name, name, number(value.current), number(value.capacity), number(value.continuousPerHour), number(value.packagePerHour), number(value.allianceBonusPerHour), number(value.totalPerHour), duration(value.timeToCapSeconds)])));
      this.repairs?.model?.setData?.(data.cities.flatMap((city) => Object.entries(city.repair).map(([name, value]) => [city.name, name, duration(value.timeSeconds), number(value.stored), number(value.capacity), `${(name === 'base' ? city.baseCondition : city.offenseCondition).toFixed(0)}%`])));
      if (this.sticker?.record?.window?.isVisible?.()) this.sticker.render();
    } catch (error) {
      if (this.header && !this.header.isDisposed?.()) {
        this.header.setValue?.(`Player information unavailable: ${error?.message ?? error}`);
      }
      this.context.logger?.warn?.('Player Intelligence refresh failed.', error);
    }
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) { this.render(); this.record.window.open(); this.record.window.setActive?.(true); return this.record; }
    this.record = await this.context.windows.open({ id: 'base-intelligence', title: 'Player Intelligence v0.6.0', content: this.build(), x: 65, y: 45, width: 1180, height: 720, resizable: true, singleton: true }); return this.record;
  }
}

function white(qx, text, options = {}) {
  return new qx.ui.basic.Label(text).set({ textColor: '#ffffff', rich: true, ...options });
}

function number(value) { return Math.floor(Number(value) || 0).toLocaleString(); }

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export class ResourceTransferWindow {
  constructor({ context, hub, supplies, execute, getQuickProfiles, saveQuickProfile }) {
    this.context = context;
    this.hub = hub;
    this.supplies = supplies;
    this.executeTransfer = execute;
    this.getQuickProfiles = getQuickProfiles;
    this.saveQuickProfile = saveQuickProfile;
    this.record = null;
    this.resourceName = 'tiberium';
    this.fraction = 1;
    this.rows = [];
    this.activityEntries = [];
  }

  setting(key, fallback) { return this.context.moduleSettings.get(key, fallback); }

  selectedSourceIds() {
    const result = [];
    const selection = this.table?.getSelectionModel?.();
    selection?.iterateSelection?.((index) => {
      if (this.rows[index]) result.push(this.rows[index].id);
    });
    return result;
  }

  destinationId() { return String(this.destination?.getSelection?.()?.[0]?.getModel?.() ?? ''); }

  populate() {
    if (this.populating) return;
    this.populating = true;
    try {
    const snapshot = this.hub.snapshot(this.resourceName);
    const priorDestination = this.destinationId() || snapshot.currentDestinationId;
    this.destination.removeAll();
    for (const city of snapshot.cities) this.destination.add(new globalThis.qx.ui.form.ListItem(city.name, null, city.id));
    const destination = this.destination.getSelectables().find((item) => item.getModel() === priorDestination);
    if (destination) this.destination.setSelection([destination]);
    this.rows = snapshot.cities.filter((city) => city.id !== this.destinationId());
    this.model.setData(this.rows.map((city) => [city.name, `${city.x}:${city.y}`, number(city.amount), number(city.storage)]));
    this.table.getSelectionModel().resetSelection();
    this.updatePlan();
    } finally {
      this.populating = false;
    }
  }

  updatePlan() {
    if (!this.destination || !this.table) return;
    try {
      const sourceIds = this.selectedSourceIds();
      this.plan = this.hub.plan({
        destinationId: this.destinationId(), sourceIds, resourceName: this.resourceName,
        reserveAmount: this.setting('reserveAmount', 0), fraction: this.fraction
      });
      this.summary.setValue(
        `<b>${number(this.plan.totalAmount)}</b> ${this.resourceName} to <b>${escapeHtml(this.plan.destination.name)}</b> · `
        + `Credits ${number(this.plan.totalCost)} · destination storage does not limit this transfer`
      );
      this.status.setValue(!sourceIds.length ? 'Select one or more source bases.'
        : !this.plan.totalAmount ? 'Nothing can be transferred with the current source reserve setting.'
          : !this.plan.affordable ? 'Not enough Credits for this transfer.' : 'Ready for manual transfer.');
      this.transferButton.setEnabled(this.plan.totalAmount > 0 && this.plan.affordable);
    } catch (error) {
      this.status?.setValue?.(`Plan unavailable: ${error?.message ?? error}`);
      this.transferButton?.setEnabled?.(false);
    }
  }

  selectAll() {
    if (!this.rows.length) return;
    this.table.getSelectionModel().setSelectionInterval(0, this.rows.length - 1);
  }

  confirmPlan() {
    if (!this.setting('requireConfirmation', true) || this.plan.entries.filter((item) => item.eligible).length <= 1) {
      return Promise.resolve(true);
    }
    const qx = globalThis.qx;
    return new Promise((resolve) => {
      const win = new qx.ui.window.Window('Confirm Bulk Transfer').set({
        modal: true, showMinimize: false, showMaximize: false, showClose: false,
        resizable: false, width: 430, layout: new qx.ui.layout.VBox(10), padding: 12
      });
      win.add(white(qx,
        `Transfer <b>${number(this.plan.totalAmount)} ${this.resourceName}</b> from `
        + `<b>${this.plan.entries.filter((item) => item.eligible).length} bases</b> to `
        + `<b>${escapeHtml(this.plan.destination.name)}</b> for ${number(this.plan.totalCost)} Credits?`, { wrap: true }
      ));
      const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
      row.add(new qx.ui.core.Spacer(), { flex: 1 });
      for (const [label, answer] of [['Cancel', false], ['Transfer', true]]) {
        const button = new qx.ui.form.Button(label);
        button.addListener('execute', () => { resolve(answer); win.close(); win.destroy(); });
        row.add(button);
      }
      win.add(row);
      qx.core.Init.getApplication().getRoot().add(win);
      win.center();
      win.open();
    });
  }

  async transfer() {
    if (!this.plan || !(await this.confirmPlan())) {
      this.addActivity('Transfer cancelled');
      return;
    }
    await this.executeTransfer(this.plan);
    this.populate();
  }

  buildTransfer(qx) {
    const page = new qx.ui.tabview.Page('Transfer').set({ layout: new qx.ui.layout.VBox(7), padding: 8 });
    const controls = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    controls.add(white(qx, 'Destination', { alignY: 'middle' }));
    this.destination = new qx.ui.form.SelectBox().set({ width: 170 });
    this.destination.addListener('changeSelection', () => this.populate());
    controls.add(this.destination);
    controls.add(white(qx, 'Resource', { alignY: 'middle' }));
    const resource = new qx.ui.form.SelectBox().set({ width: 120 });
    resource.add(new qx.ui.form.ListItem('Tiberium', null, 'tiberium'));
    resource.add(new qx.ui.form.ListItem('Crystal', null, 'crystal'));
    resource.addListener('changeSelection', () => {
      this.resourceName = resource.getSelection()[0]?.getModel() ?? 'tiberium';
      this.populate();
    });
    controls.add(resource);
    const selectAll = new qx.ui.form.Button('Select All Sources');
    selectAll.addListener('execute', () => this.selectAll());
    controls.add(selectAll);
    const clear = new qx.ui.form.Button('Clear Selection');
    clear.addListener('execute', () => this.table.getSelectionModel().resetSelection());
    controls.add(clear);
    page.add(controls);

    const options = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    const confirmation = new qx.ui.form.CheckBox('Confirm bulk transfers').set({
      value: this.setting('requireConfirmation', true), textColor: '#ffffff'
    });
    confirmation.addListener('changeValue', (event) => {
      void this.context.moduleSettings.set('requireConfirmation', Boolean(event.getData()));
    });
    options.add(confirmation);
    options.add(white(qx, 'Keep at each source', { alignY: 'middle' }));
    const reserve = new qx.ui.form.Spinner(0, Math.min(1000000000000, this.setting('reserveAmount', 0)), 1000000000000).set({ width: 140 });
    reserve.addListener('changeValue', async (event) => {
      await this.context.moduleSettings.set('reserveAmount', Number(event.getData()));
      this.updatePlan();
    });
    options.add(reserve);
    page.add(options);

    this.model = new qx.ui.table.model.Simple();
    this.model.setColumns(['Source Base', 'Coordinates', 'Available', 'Storage']);
    this.table = new qx.ui.table.Table(this.model).set({ statusBarVisible: true });
    this.table.getSelectionModel().setSelectionMode(qx.ui.table.selection.Model.MULTIPLE_INTERVAL_SELECTION);
    this.table.getSelectionModel().addListener('changeSelection', () => this.updatePlan());
    [180, 100, 130, 130].forEach((width, index) => this.table.getTableColumnModel().setColumnWidth(index, width));
    page.add(this.table, { flex: 1 });

    const percentages = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    percentages.add(white(qx, 'Transfer from each selected source', { alignY: 'middle' }));
    for (const value of [10, 25, 50, 75, 100]) {
      const button = new qx.ui.form.Button(`${value}%`).set({ width: 50 });
      button.addListener('execute', () => { this.fraction = value / 100; this.updatePlan(); });
      percentages.add(button);
    }
    page.add(percentages);
    this.summary = white(qx, 'Select sources to calculate a transfer.', { wrap: true });
    this.status = white(qx, 'Ready.', { wrap: true, textColor: '#d6b85a' });
    page.add(this.summary);
    page.add(this.status);
    this.transferButton = new qx.ui.form.Button('Transfer Selected').set({ enabled: false, width: 170, alignX: 'right' });
    this.transferButton.addListener('execute', () => { void this.transfer(); });
    page.add(this.transferButton);
    return page;
  }

  buildSupplies(qx) {
    const page = new qx.ui.tabview.Page('Supplies').set({ layout: new qx.ui.layout.VBox(8), padding: 12 });
    const defaultTab = new qx.ui.form.CheckBox('Default to the useful Supplies tab').set({
      value: this.setting('defaultSuppliesTab', true), textColor: '#ffffff'
    });
    const disableFunds = new qx.ui.form.CheckBox('Disable Funds controls while Supplies is open').set({
      value: this.setting('disableFundsInSupplies', false), textColor: '#ffffff'
    });
    defaultTab.addListener('changeValue', (event) => void this.context.moduleSettings.set('defaultSuppliesTab', Boolean(event.getData())));
    disableFunds.addListener('changeValue', async (event) => {
      await this.context.moduleSettings.set('disableFundsInSupplies', Boolean(event.getData()));
      this.supplies.apply();
    });
    page.add(defaultTab);
    page.add(disableFunds);
    page.add(white(qx, 'Funds controls are disabled reversibly at the UI layer. Player inventory methods are not modified.', { wrap: true }));
    const open = new qx.ui.form.Button('Open Supplies').set({ width: 140 });
    open.addListener('execute', () => {
      try { this.supplies.open(); } catch (error) { this.context.notifications?.show?.(error.message); }
    });
    page.add(open);
    return page;
  }

  quickDestinationId() {
    return String(this.quickDestination?.getSelection?.()?.[0]?.getModel?.() ?? '');
  }

  setQuickMode(mode) {
    const item = this.quickMode?.getSelectables?.().find((candidate) => candidate.getModel() === mode);
    if (item) this.quickMode.setSelection([item]);
    const custom = mode === 'custom';
    this.quickTiberiumPercent?.setEnabled?.(custom);
    this.quickCrystalPercent?.setEnabled?.(custom);
  }

  updateQuickProfileSummary() {
    const mode = this.quickMode?.getSelection?.()?.[0]?.getModel?.() ?? 'all';
    const effectiveTiberium = mode === 'all' || mode === 'tiberium' ? 100
      : mode === 'crystal' ? 0 : this.quickTiberiumPercent.getValue();
    const effectiveCrystal = mode === 'all' || mode === 'crystal' ? 100
      : mode === 'tiberium' ? 0 : this.quickCrystalPercent.getValue();
    const name = this.quickDestination?.getSelection?.()?.[0]?.getLabel?.() ?? 'selected base';
    this.quickProfileStatus?.setValue?.(
      `${name}: Quick Transfer will pull ${effectiveTiberium}% Tiberium and ${effectiveCrystal}% Crystal from every other eligible owned base.`
    );
  }

  loadQuickProfile() {
    if (this.loadingQuickProfile) return;
    const destinationId = this.quickDestinationId();
    if (!destinationId) return;
    const raw = this.getQuickProfiles?.()?.[destinationId] ?? {};
    const mode = ['all', 'crystal', 'tiberium', 'custom'].includes(raw.mode) ? raw.mode : 'all';
    this.loadingQuickProfile = true;
    try {
      this.setQuickMode(mode);
      this.quickTiberiumPercent.setValue(Math.max(0, Math.min(100, Number(raw.tiberiumPercent ?? 100))));
      this.quickCrystalPercent.setValue(Math.max(0, Math.min(100, Number(raw.crystalPercent ?? 100))));
      this.updateQuickProfileSummary();
    } finally {
      this.loadingQuickProfile = false;
    }
  }

  populateQuickDestinations() {
    const snapshot = this.hub.snapshot('tiberium');
    const selected = this.quickDestinationId() || snapshot.currentDestinationId;
    this.quickDestination.removeAll();
    for (const city of snapshot.cities) {
      const label = city.id === snapshot.currentDestinationId ? `${city.name} (current)` : city.name;
      this.quickDestination.add(new globalThis.qx.ui.form.ListItem(label, null, city.id));
    }
    const item = this.quickDestination.getSelectables().find((candidate) => candidate.getModel() === selected)
      ?? this.quickDestination.getSelectables().find((candidate) => candidate.getModel() === snapshot.currentDestinationId);
    if (item) this.quickDestination.setSelection([item]);
    this.loadQuickProfile();
  }

  buildQuickProfiles(qx) {
    const page = new qx.ui.tabview.Page('Quick Transfer').set({ layout: new qx.ui.layout.VBox(9), padding: 12 });
    page.add(white(qx,
      '<b>Per-base Quick Transfer profiles</b><br>When you click the quick-transfer icon, the profile for the currently open destination base is used. Sources are all other eligible owned bases.',
      { wrap: true }
    ));
    const destinationRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    destinationRow.add(white(qx, 'Destination profile', { alignY: 'middle' }));
    this.quickDestination = new qx.ui.form.SelectBox().set({ width: 210 });
    destinationRow.add(this.quickDestination);
    const refreshBases = new qx.ui.form.Button('Refresh Bases');
    destinationRow.add(refreshBases);
    page.add(destinationRow);

    const modeRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    modeRow.add(white(qx, 'Quick action', { alignY: 'middle' }));
    this.quickMode = new qx.ui.form.SelectBox().set({ width: 210 });
    for (const [name, id] of [
      ['All resources (100% each)', 'all'],
      ['Crystal only (100%)', 'crystal'],
      ['Tiberium only (100%)', 'tiberium'],
      ['Custom percentages', 'custom']
    ]) this.quickMode.add(new qx.ui.form.ListItem(name, null, id));
    modeRow.add(this.quickMode);
    page.add(modeRow);

    const percentageRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    percentageRow.add(white(qx, 'Tiberium %', { alignY: 'middle' }));
    this.quickTiberiumPercent = new qx.ui.form.Spinner(0, 100, 100).set({ width: 80 });
    percentageRow.add(this.quickTiberiumPercent);
    percentageRow.add(white(qx, 'Crystal %', { alignY: 'middle' }));
    this.quickCrystalPercent = new qx.ui.form.Spinner(0, 100, 100).set({ width: 80 });
    percentageRow.add(this.quickCrystalPercent);
    page.add(percentageRow);

    this.quickProfileStatus = white(qx, 'Choose a destination profile.', { wrap: true, textColor: '#d6b85a' });
    page.add(this.quickProfileStatus);
    const save = new qx.ui.form.Button('Save Profile for This Base').set({ width: 220 });
    page.add(save);

    this.quickDestination.addListener('changeSelection', () => this.loadQuickProfile());
    this.quickMode.addListener('changeSelection', () => {
      if (this.loadingQuickProfile) return;
      this.setQuickMode(this.quickMode.getSelection?.()?.[0]?.getModel?.() ?? 'all');
      this.updateQuickProfileSummary();
    });
    for (const spinner of [this.quickTiberiumPercent, this.quickCrystalPercent]) {
      spinner.addListener('changeValue', () => { if (!this.loadingQuickProfile) this.updateQuickProfileSummary(); });
    }
    refreshBases.addListener('execute', () => this.populateQuickDestinations());
    save.addListener('execute', () => {
      void (async () => {
        const destinationId = this.quickDestinationId();
        if (!destinationId) return;
        await this.saveQuickProfile?.(destinationId, {
          mode: this.quickMode.getSelection?.()?.[0]?.getModel?.() ?? 'all',
          tiberiumPercent: this.quickTiberiumPercent.getValue(),
          crystalPercent: this.quickCrystalPercent.getValue()
        });
        this.quickProfileStatus.setValue(`${this.quickDestination.getSelection()[0].getLabel()}: profile saved.`);
      })().catch((error) => this.quickProfileStatus.setValue(`Unable to save profile: ${error?.message ?? error}`));
    });
    this.populateQuickDestinations();
    return page;
  }

  buildHistory(qx) {
    const page = new qx.ui.tabview.Page('History').set({ layout: new qx.ui.layout.VBox(7), padding: 10 });
    const clear = new qx.ui.form.Button('Clear').set({ width: 65 });
    clear.addListener('execute', () => { this.activityEntries = []; this.renderActivity(); });
    page.add(clear);
    this.activity = white(qx, 'No transfers yet.', { wrap: true });
    page.add(this.activity, { flex: 1 });
    return page;
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 5, textColor: '#ffffff' });
    const tabs = new qx.ui.tabview.TabView();
    tabs.add(this.buildTransfer(qx));
    tabs.add(this.buildQuickProfiles(qx));
    tabs.add(this.buildSupplies(qx));
    tabs.add(this.buildHistory(qx));
    root.add(tabs, { flex: 1 });
    this.populate();
    return root;
  }

  addActivity(message, date = new Date()) {
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    this.activityEntries.unshift({ time, message });
    this.activityEntries = this.activityEntries.slice(0, 100);
    this.renderActivity();
  }

  renderActivity() {
    if (!this.activity) return;
    this.activity.setValue(this.activityEntries.length ? this.activityEntries.map((entry) =>
      `<span style="color:#9fb3c8">${escapeHtml(entry.time)}</span>&nbsp;&nbsp;${escapeHtml(entry.message)}`
    ).join('<br>') : 'No transfers yet.');
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.populate();
      this.populateQuickDestinations?.();
      this.record.window.open(); this.record.window.setActive?.(true); return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'resource-transfer', title: 'Resource Transfer Manager', content: this.build(),
      x: 140, y: 80, width: 760, height: 610, resizable: true, singleton: true
    });
    return this.record;
  }
}

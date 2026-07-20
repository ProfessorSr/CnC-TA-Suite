function label(qx, text, options = {}) {
  return new qx.ui.basic.Label(text).set({ textColor: '#ffffff', rich: true, ...options });
}

function duration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function number(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export class RepairManagerWindow {
  constructor({ context, hub, runAction }) {
    this.context = context;
    this.hub = hub;
    this.runAction = runAction;
    this.record = null;
    this.activityEntries = [];
  }

  setting(key, fallback) {
    return this.context.moduleSettings?.get(key, fallback) ?? fallback;
  }

  async setSetting(key, value) {
    await this.context.moduleSettings?.set(key, value);
    this.setStatus('Settings saved.');
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(10)).set({
      padding: 12,
      textColor: '#ffffff'
    });

    root.add(label(qx, '<b>Automation</b>', { font: 'bold' }));
    const settingsBox = new qx.ui.groupbox.GroupBox('Automatic actions').set({
      layout: new qx.ui.layout.VBox(7),
      padding: 10
    });
    const toggles = [
      ['autoCollect', 'Auto-collect completed packages and building production'],
      ['autoRepairBuildings', 'Auto-repair buildings'],
      ['autoRepairOffense', 'Auto-repair offense units'],
      ['autoRepairDefense', 'Auto-repair defense units when supported']
    ];
    this.checks = {};
    for (const [key, text] of toggles) {
      const check = new qx.ui.form.CheckBox(text).set({
        value: this.setting(key, false),
        textColor: '#ffffff'
      });
      check.addListener('changeValue', (event) => {
        void this.setSetting(key, Boolean(event.getData())).catch((error) => {
          this.setStatus(`Unable to save setting: ${error?.message ?? error}`);
        });
      });
      this.checks[key] = check;
      settingsBox.add(check);
    }

    const settingsRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    settingsRow.add(label(qx, 'Building priority', { alignY: 'middle' }));
    this.priority = new qx.ui.form.SelectBox().set({ width: 170 });
    for (const [name, id] of [
      ['Defense first', 'defense-first'],
      ['Production first', 'production-first'],
      ['Core buildings first', 'core-first']
    ]) this.priority.add(new qx.ui.form.ListItem(name, null, id));
    const priorityItem = this.priority.getSelectables?.().find((item) =>
      item.getModel?.() === this.setting('repairPriority', 'defense-first')
    );
    if (priorityItem) this.priority.setSelection([priorityItem]);
    this.priority.addListener('changeSelection', () => {
      const value = this.priority.getSelection?.()?.[0]?.getModel?.() ?? 'defense-first';
      void this.setSetting('repairPriority', value);
    });
    settingsRow.add(this.priority);
    settingsRow.add(label(qx, 'Check every', { alignY: 'middle' }));
    this.interval = new qx.ui.form.Spinner(5, this.setting('intervalSeconds', 15), 300).set({ width: 70 });
    this.interval.addListener('changeValue', (event) => {
      void this.setSetting('intervalSeconds', Number(event.getData()));
    });
    settingsRow.add(this.interval);
    settingsRow.add(label(qx, 'seconds', { alignY: 'middle' }));
    settingsBox.add(settingsRow);
    root.add(settingsBox);

    const manual = new qx.ui.groupbox.GroupBox('Manual actions').set({
      layout: new qx.ui.layout.VBox(7),
      padding: 10
    });
    const actionRows = [[
      ['Collect Now', 'collect'],
      ['Repair Buildings', 'buildings'],
      ['Repair Offense', 'offense'],
      ['Repair Defense', 'defense']
    ]];
    for (const actions of actionRows) {
      const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
      for (const [text, action] of actions) {
        const button = new qx.ui.form.Button(text).set({ minWidth: 125 });
        button.addListener('execute', () => { void this.execute(action); });
        row.add(button);
      }
      manual.add(row);
    }
    root.add(manual);

    const statusBox = new qx.ui.groupbox.GroupBox('Live status').set({
      layout: new qx.ui.layout.VBox(5),
      padding: 10
    });
    this.summary = label(qx, 'Loading base status…', { wrap: true });
    this.times = label(qx, '', { wrap: true });
    this.resources = label(qx, '', { wrap: true });
    this.status = label(qx, 'Ready.', { wrap: true, textColor: '#d6b85a' });
    statusBox.add(this.summary);
    statusBox.add(this.times);
    statusBox.add(this.resources);
    statusBox.add(this.status);
    root.add(statusBox, { flex: 1 });

    const activityBox = new qx.ui.groupbox.GroupBox('Activity log').set({
      layout: new qx.ui.layout.VBox(5),
      padding: 8
    });
    const activityHeader = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    activityHeader.add(label(qx, 'Recent repairs and collections', { alignY: 'middle' }), { flex: 1 });
    const clearActivity = new qx.ui.form.Button('Clear').set({ width: 55 });
    clearActivity.addListener('execute', () => {
      this.activityEntries = [];
      this.renderActivity();
    });
    activityHeader.add(clearActivity);
    activityBox.add(activityHeader);
    this.activity = label(qx, 'No activity yet.', { wrap: true, minHeight: 72 });
    activityBox.add(this.activity);
    root.add(activityBox);

    this.refresh();
    this.renderActivity();
    return root;
  }

  addActivity(message, date = new Date()) {
    this.activityEntries.unshift({
      time: date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      message: String(message)
    });
    this.activityEntries = this.activityEntries.slice(0, 50);
    this.renderActivity();
  }

  renderActivity() {
    if (!this.activity) return;
    if (!this.activityEntries.length) {
      this.activity.setValue('No activity yet.');
      return;
    }
    this.activity.setValue(this.activityEntries.slice(0, 6).map((entry) =>
      `<span style="color:#9fb3c8">${escapeHtml(entry.time)}</span>&nbsp;&nbsp;${escapeHtml(entry.message)}`
    ).join('<br>'));
  }

  async execute(action) {
    try {
      const result = await this.runAction(action, { manual: true });
      this.setStatus(result.message);
      this.refresh();
    } catch (error) {
      this.setStatus(`Action failed: ${error?.message ?? error}`);
    }
  }

  setStatus(text) {
    if (this.status && !this.status.isDisposed?.()) this.status.setValue?.(text);
  }

  refresh() {
    try {
      const data = this.hub.snapshot();
      if (this.summary && !this.summary.isDisposed?.()) this.summary.setValue(
        `<b>${data.currentCity}</b> · ${data.cityCount} bases · `
        + `${data.damagedCities} damaged · ${data.collectableCities} ready to collect`
      );
      if (this.times && !this.times.isDisposed?.()) this.times.setValue(
        `Repair time — Infantry ${duration(data.repairSeconds.infantry)} · `
        + `Vehicles ${duration(data.repairSeconds.vehicle)} · `
        + `Aircraft ${duration(data.repairSeconds.aircraft)}`
      );
      if (this.resources && !this.resources.isDisposed?.()) this.resources.setValue(
        `Available resources — Tiberium ${number(data.resources.tiberium)} · `
        + `Crystal ${number(data.resources.crystal)} · Credits ${number(data.resources.credits)} · Power ${number(data.resources.power)}<br>`
        + `Estimated repair requirement — Tiberium ${number(data.requiredResources.tiberium)} · `
        + `Crystal ${number(data.requiredResources.crystal)} · Credits ${number(data.requiredResources.credits)} · Power ${number(data.requiredResources.power)}<br>`
        + `Repair capacity — `
        + `Defense repair ${data.defenseSupported ? 'supported' : 'not exposed by this game build'}<br>`
        + 'Unit-category repair — use Repair Offense; separate infantry, vehicle, and aircraft actions are not exposed'
      );
    } catch (error) {
      this.setStatus(`Status unavailable: ${error?.message ?? error}`);
    }
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.refresh();
      this.record.window.open();
      this.record.window.setActive?.(true);
      return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'repair-manager',
      title: 'Repair & Collection Manager',
      content: this.build(),
      x: 150,
      y: 90,
      width: 650,
      height: 650,
      resizable: true,
      singleton: true
    });
    return this.record;
  }
}

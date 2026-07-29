function valueAt(source, path, fallback = '') {
  try {
    if (typeof path === 'function') return path(source) ?? fallback;
    const value = String(path ?? '').split('.').filter(Boolean).reduce((current, key) => current?.[key], source);
    return value ?? fallback;
  } catch { return fallback; }
}

function clear(widget) {
  for (const child of widget.removeAll?.() ?? []) child.destroy?.();
}

export class DeclarativeRenderer {
  constructor({ definition, context, owner }) {
    this.definition = definition;
    this.context = context;
    this.owner = owner;
    this.providerState = {};
    this.bindings = [];
    this.refreshing = null;
  }

  label(value, options = {}) {
    return new globalThis.qx.ui.basic.Label(String(value ?? '')).set({ wrap: true, textColor: '#ffffff', ...options });
  }

  statusList(control, parent) {
    const box = new globalThis.qx.ui.container.Composite(new globalThis.qx.ui.layout.VBox(4));
    parent.add(box);
    this.bindings.push(() => {
      clear(box);
      const data = control.provider ? this.providerState[control.provider]?.data : this.providerState;
      for (const item of control.items ?? []) {
        const row = new globalThis.qx.ui.container.Composite(new globalThis.qx.ui.layout.HBox(8));
        const ok = item.ok === undefined ? true : Boolean(valueAt(data, item.ok));
        row.add(this.label(item.label, { textColor: '#d5e2e8' }), { flex: 1 });
        row.add(this.label(valueAt(data, item.value, item.fallback ?? 'Unavailable'), {
          font: item.bold === false ? null : 'bold', textAlign: 'right', textColor: ok ? '#7ee69a' : '#ff8b82'
        }));
        box.add(row);
      }
    });
  }

  settings(control, parent) {
    const schema = control.schema ?? this.definition.manifest.settings ?? {};
    for (const [key, rule] of Object.entries(schema)) {
      const row = new globalThis.qx.ui.container.Composite(new globalThis.qx.ui.layout.HBox(8));
      row.add(this.label(rule.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()), { width: control.labelWidth ?? 190, textColor: '#d5e2e8', alignY: 'middle' }));
      let field;
      const current = this.context.moduleSettings.get(key, rule.default);
      if (rule.type === 'boolean') {
        field = new globalThis.qx.ui.form.CheckBox().set({ value: Boolean(current) });
        field.addListener('changeValue', (event) => void this.context.moduleSettings.set(key, event.getData()));
      } else {
        field = new globalThis.qx.ui.form.TextField(String(current ?? '')).set({ allowGrowX: true });
        field.addListener('changeValue', (event) => void this.context.moduleSettings.set(key, event.getData()));
      }
      row.add(field, { flex: 1 });
      parent.add(row);
    }
  }

  control(control, parent) {
    if (control.type === 'text') {
      const widget = this.label(control.value ?? '', { rich: Boolean(control.rich), textColor: control.color ?? '#d5e2e8' });
      parent.add(widget);
      if (control.provider || control.path) this.bindings.push(() => {
        const data = control.provider ? this.providerState[control.provider]?.data : this.providerState;
        widget.setValue(String(valueAt(data, control.path ?? ((value) => value), control.fallback ?? '')));
      });
    } else if (control.type === 'status-list') this.statusList(control, parent);
    else if (control.type === 'settings') this.settings(control, parent);
    else if (control.type === 'custom') {
      const widget = control.render({ context: this.context, owner: this.owner, renderer: this });
      // A custom body is the page's primary content. Flex lets its nested lists
      // and scroll panes consume the available window height.
      parent.add(widget, { flex: 1 });
    }
  }

  build() {
    const qx = globalThis.qx;
    this.root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 9, textColor: '#ffffff' });
    if (Object.keys(this.definition.providers).length) {
      this.stateLabel = this.label('Loading…', { textColor: '#9fd9f2' });
      this.stateLabel.exclude?.();
      this.root.add(this.stateLabel);
    }
    if (this.definition.window.toolbar.length) {
      const toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
      for (const action of this.definition.window.toolbar) {
        const button = new qx.ui.form.Button(action.label, action.icon ?? null).set({ toolTipText: action.tooltip ?? action.label });
        button.addListener('execute', () => void this.execute(action.id));
        toolbar.add(button);
      }
      this.root.add(toolbar);
    }
    const tabs = this.definition.window.tabs;
    const host = tabs.length > 1 ? new qx.ui.tabview.TabView() : this.root;
    if (host !== this.root) this.root.add(host, { flex: 1 });
    for (const tab of tabs) {
      const page = tabs.length > 1
        ? new qx.ui.tabview.Page(tab.title).set({ layout: new qx.ui.layout.VBox(6), padding: 8 })
        : new qx.ui.container.Composite(new qx.ui.layout.VBox(6));
      if (tabs.length > 1) host.add(page); else this.root.add(page, { flex: 1 });
      for (const control of tab.controls ?? []) this.control(control, page);
    }
    this.root.__suiteDeclarativeRefresh = () => this.refresh();
    this.root.addListenerOnce?.('appear', () => { void this.refresh(); });
    return this.root;
  }

  async execute(id) {
    if (id === 'refresh') return this.refresh(true);
    const action = this.definition.actions[id];
    if (typeof action !== 'function') throw new Error(`Unknown declarative action: ${id}`);
    const result = await action({ context: this.context, owner: this.owner, providers: this.providerState, refresh: () => this.refresh(true) });
    if (result?.refresh !== false) await this.refresh(true);
    return result;
  }

  async refresh(force = false) {
    if (this.refreshing && !force) return this.refreshing;
    this.refreshing = (async () => {
      if (this.stateLabel) {
        this.stateLabel.setValue('Refreshing data…');
        this.stateLabel.setTextColor?.('#9fd9f2');
        this.stateLabel.show?.();
      }
      for (const [id, provider] of Object.entries(this.definition.providers)) {
        this.providerState[id] = { status: 'loading', data: this.providerState[id]?.data ?? null, error: null };
        try {
          const data = await provider({ context: this.context, owner: this.owner });
          this.providerState[id] = { status: data == null ? 'empty' : 'ready', data, error: null, updatedAt: Date.now() };
        } catch (error) {
          this.providerState[id] = { status: 'error', data: null, error: error instanceof Error ? error.message : String(error), updatedAt: Date.now() };
          this.context.logger?.warn?.(`Declarative provider failed: ${id}`, error);
        }
      }
      for (const binding of this.bindings) binding();
      const errors = Object.entries(this.providerState).filter(([, state]) => state.status === 'error');
      const empty = Object.values(this.providerState).filter((state) => state.status === 'empty').length;
      if (this.stateLabel) {
        if (errors.length) {
          this.stateLabel.setValue(`Unable to load ${errors.map(([id]) => id).join(', ')}: ${errors.map(([, state]) => state.error).join(' · ')}`);
          this.stateLabel.setTextColor?.('#ff8b82');
          this.stateLabel.show?.();
        } else if (empty) {
          this.stateLabel.setValue('No data is currently available.');
          this.stateLabel.setTextColor?.('#d7c579');
          this.stateLabel.show?.();
        } else this.stateLabel.exclude?.();
      }
      return this.providerState;
    })();
    try { return await this.refreshing; }
    finally { this.refreshing = null; }
  }
}

export { valueAt as declarativeValueAt };

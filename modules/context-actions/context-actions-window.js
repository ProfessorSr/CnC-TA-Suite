import { ACTIONS } from './context-actions-panel.js';

const settingKey = (id) => `show${id[0].toUpperCase()}${id.slice(1)}`;

export class ContextActionsWindow {
  constructor({ context }) {
    this.context = context;
    this.record = null;
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(8)).set({ padding: 12, textColor: '#ffffff' });
    const navigator = new qx.ui.groupbox.GroupBox('World Coordinate Navigator').set({
      layout: new qx.ui.layout.HBox(7), padding: 8
    });
    navigator.add(new qx.ui.basic.Label('X').set({ textColor: '#ffffff', alignY: 'middle' }));
    const x = new qx.ui.form.Spinner(0, 0, 9999).set({ width: 80 });
    navigator.add(x);
    navigator.add(new qx.ui.basic.Label('Y').set({ textColor: '#ffffff', alignY: 'middle' }));
    const y = new qx.ui.form.Spinner(0, 0, 9999).set({ width: 80 });
    navigator.add(y);
    const go = new qx.ui.form.Button('Go to Coordinates');
    go.addListener('execute', () => {
      try {
        const rootApi = this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib;
        const vis = rootApi?.Vis?.VisMain?.GetInstance?.();
        if (typeof vis?.CenterGridPosition !== 'function') throw new Error('World navigation is unavailable.');
        vis.CenterGridPosition(Number(x.getValue()), Number(y.getValue()));
        vis.Update?.(); vis.ViewUpdate?.();
      } catch (error) { this.context.notifications?.show?.(`Navigation failed: ${error?.message ?? error}`); }
    });
    navigator.add(go);
    root.add(navigator);
    root.add(new qx.ui.basic.Label('Choose the actions shown when a base, camp, or outpost is selected.').set({ textColor: '#ffffff', wrap: true }));
    const shared = new qx.ui.groupbox.GroupBox('All selected objects').set({ layout: new qx.ui.layout.VBox(6), padding: 8 });
    const target = new qx.ui.groupbox.GroupBox('Targets, camps, and outposts').set({ layout: new qx.ui.layout.VBox(6), padding: 8 });
    const own = new qx.ui.groupbox.GroupBox('Your bases').set({ layout: new qx.ui.layout.VBox(6), padding: 8 });
    for (const action of ACTIONS) {
      const key = settingKey(action.id);
      const check = new qx.ui.form.CheckBox(action.label).set({
        value: this.context.moduleSettings.get(key, action.id !== 'targetInfo'),
        textColor: '#ffffff'
      });
      check.addListener('changeValue', (event) => {
        void this.context.moduleSettings.set(key, Boolean(event.getData()));
      });
      if (action.scopes.includes('own') && action.scopes.length === 1) own.add(check);
      else if (action.scopes.includes('own')) shared.add(check);
      else target.add(check);
    }
    root.add(shared);
    root.add(target, { flex: 1 });
    root.add(own, { flex: 1 });
    root.add(new qx.ui.basic.Label('Changes apply the next time an object menu opens. Native game actions are never removed.').set({ textColor: '#d6b85a', wrap: true }));
    return root;
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.record.window.open(); this.record.window.setActive?.(true); return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'context-actions', title: 'Context Actions Settings', content: this.build(),
      x: 170, y: 100, width: 500, height: 560, resizable: true, singleton: true
    });
    return this.record;
  }
}

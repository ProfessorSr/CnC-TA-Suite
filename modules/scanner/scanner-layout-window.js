(() => {
  'use strict';

  const HOST = globalThis.window ?? globalThis;
  const ROOT = (HOST.CnCTA = HOST.CnCTA || {});

  function makeResourceIcon(kind) {
    const label = new qx.ui.basic.Label(kind === 2 ? '◆' : '◆').set({
      rich: true,
      textAlign: 'center',
      alignY: 'middle',
      allowGrowX: true,
      allowGrowY: true
    });
    label.setTextColor(kind === 2 ? '#30c36b' : '#3fa9f5');
    label.setFont('bold');
    return label;
  }

  class ScannerLayoutWindow {
    constructor(controller, version = '') {
      this.controller = controller;
      this.results = [];
      this.selected = new Set();
      this.showingSaved = false;
      this.window = new qx.ui.window.Window(`Scanner Layout${version ? ` v${version}` : ''}`).set({
        width: 1180,
        height: 610,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        resizable: true,
        contentPadding: 8,
        layout: new qx.ui.layout.VBox(6)
      });
      this.window.setDecorator(new qx.ui.decoration.Decorator(2, 'solid', '#c82828'));
      const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
      this.selectAll = new qx.ui.form.CheckBox('Select All');
      this.selectAll.addListener('changeValue', event => this.setAllSelected(Boolean(event.getData())));
      this.exportButton = new qx.ui.form.Button('Export Selected').set({ enabled: false });
      this.exportButton.addListener('execute', () => void this.exportSelected());
      this.saveButton = new qx.ui.form.Button('Save Selected').set({ enabled: false });
      this.saveButton.addListener('execute', () => void this.saveSelected());
      this.savedButton = new qx.ui.form.Button('Saved Layouts');
      this.savedButton.addListener('execute', () => void this.showSaved());
      this.removeButton = new qx.ui.form.Button('Remove Selected').set({ enabled: false, visibility: 'excluded' });
      this.removeButton.addListener('execute', () => void this.removeSelected());
      actions.add(this.selectAll);
      actions.add(this.exportButton);
      actions.add(this.saveButton);
      actions.add(this.savedButton);
      actions.add(this.removeButton);
      this.status = new qx.ui.basic.Label('').set({ alignY: 'middle' });
      actions.add(this.status, { flex: 1 });
      this.window.add(actions);
      this.flow = new qx.ui.container.Composite(new qx.ui.layout.Flow(6, 6));
      this.scroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto' });
      this.scroll.add(this.flow);
      this.window.add(this.scroll, { flex: 1 });
    }

    render(results) {
      this.results = results || [];
      this.selected.clear();
      this.selectAll.setValue(false);
      this.flow.removeAll();
      for (const result of this.results) this.flow.add(this.createCard(result));
      this.updateActions();
    }

    key(result) { return `${result.x}:${result.y}`; }

    selectedResults() {
      return this.results.filter(result => this.selected.has(this.key(result)));
    }

    updateActions() {
      const count = this.selected.size;
      this.exportButton.setEnabled(count > 0);
      this.saveButton.setEnabled(count > 0 && !this.showingSaved);
      this.removeButton.setEnabled(count > 0 && this.showingSaved);
      this.status.setValue(`${count} selected · ${this.results.length} layout(s)`);
    }

    setAllSelected(value) {
      this.selected = new Set(value ? this.results.map(result => this.key(result)) : []);
      for (const card of this.flow.getChildren()) card.__scannerCheck?.setValue?.(value);
      this.updateActions();
    }

    createCard(result) {
      const box = new qx.ui.groupbox.GroupBox(`${result.type} - ${result.x}:${result.y}`).set({
        width: 158,
        height: 247,
        layout: new qx.ui.layout.VBox(3)
      });
      const check = new qx.ui.form.CheckBox('Select');
      check.addListener('changeValue', event => {
        const key = this.key(result);
        if (event.getData()) this.selected.add(key);
        else this.selected.delete(key);
        this.updateActions();
      });
      box.__scannerCheck = check;
      const grid = new qx.ui.container.Composite(new qx.ui.layout.Grid(1, 1)).set({ width: 145, height: 135 });
      for (let y = 0; y < 8; y += 1) {
        grid.getLayout().setRowHeight(y, 16);
        for (let x = 0; x < 9; x += 1) {
          grid.getLayout().setColumnWidth(x, 16);
          const cell = new qx.ui.container.Composite(new qx.ui.layout.Grow()).set({
            decorator: new qx.ui.decoration.Decorator(1, 'solid', '#777'),
            backgroundColor: '#303438'
          });
          const kind = result.layout?.[y]?.[x] || 0;
          if (kind === 1 || kind === 2) cell.add(makeResourceIcon(kind));
          grid.add(cell, { row: y, column: x });
        }
      }
      const summary = new qx.ui.basic.Label(
        `<span style="color:#30c36b">T ${result.layoutInfo.tiberium}</span> &nbsp; ` +
        `<span style="color:#3fa9f5">C ${result.layoutInfo.crystal}</span><br>` +
        `<span style="color:#ddd">4-touch ${result.layoutInfo.fourTouchSpots} · 5-touch ${result.layoutInfo.fiveTouchSpots}</span>`
      ).set({ rich: true, textAlign: 'center' });
      const open = new qx.ui.form.Button('Center on World').set({ height: 24 });
      open.addListener('execute', () => this.controller.focus(result, false));
      box.add(check);
      box.add(grid);
      box.add(summary);
      box.add(open);
      return box;
    }

    async copy(text, promptTitle) {
      if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
      else globalThis.prompt?.(promptTitle, text);
    }

    async exportSelected() {
      const results = this.selectedResults();
      if (!results.length) return;
      try {
        await this.copy(ROOT.ScannerCalculator.exportLayouts(results), 'Copy coordinates and CnCOpt mini links');
        this.status.setValue(`${results.length} layout(s) exported.`);
      } catch (error) {
        this.status.setValue(`Export failed: ${error?.message ?? error}`);
      }
    }

    async saveSelected() {
      const results = this.selectedResults();
      if (!results.length) return;
      await this.controller.saveLayouts(results);
      this.status.setValue(`${results.length} layout(s) saved.`);
    }

    async showSaved() {
      this.showingSaved = !this.showingSaved;
      this.savedButton.setLabel(this.showingSaved ? 'Scan Layouts' : 'Saved Layouts');
      this.saveButton.setVisibility(this.showingSaved ? 'excluded' : 'visible');
      this.removeButton.setVisibility(this.showingSaved ? 'visible' : 'excluded');
      this.render(this.showingSaved ? await this.controller.getSavedLayouts() : this.scanResults);
    }

    async removeSelected() {
      const results = this.selectedResults();
      if (!results.length) return;
      this.render(await this.controller.removeSavedLayouts(results));
      this.status.setValue(`${results.length} saved layout(s) removed.`);
    }

    open(results) {
      this.scanResults = results || [];
      this.showingSaved = false;
      this.savedButton.setLabel('Saved Layouts');
      this.saveButton.setVisibility('visible');
      this.removeButton.setVisibility('excluded');
      this.render(this.scanResults);
      if (!this.window.getLayoutParent()) qx.core.Init.getApplication().getRoot().add(this.window);
      this.window.open();
      this.window.center();
    }
  }

  ROOT.ScannerLayoutWindow = ScannerLayoutWindow;
})();

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
    constructor(controller) {
      this.controller = controller;
      this.window = new qx.ui.window.Window('Scanner Layout').set({
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
      this.flow = new qx.ui.container.Composite(new qx.ui.layout.Flow(6, 6));
      this.scroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto' });
      this.scroll.add(this.flow);
      this.window.add(this.scroll, { flex: 1 });
    }

    render(results) {
      this.flow.removeAll();
      for (const result of results) this.flow.add(this.createCard(result));
    }

    createCard(result) {
      const box = new qx.ui.groupbox.GroupBox(`${result.type} - ${result.x}:${result.y}`).set({
        width: 158,
        height: 205,
        layout: new qx.ui.layout.VBox(3)
      });
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
        `<span style="color:#3fa9f5">C ${result.layoutInfo.crystal}</span>`
      ).set({ rich: true, textAlign: 'center' });
      const open = new qx.ui.form.Button('Center on World').set({ height: 24 });
      open.addListener('execute', () => this.controller.focus(result, false));
      box.add(grid);
      box.add(summary);
      box.add(open);
      return box;
    }

    open(results) {
      this.render(results);
      if (!this.window.getLayoutParent()) qx.core.Init.getApplication().getRoot().add(this.window);
      this.window.open();
      this.window.center();
    }
  }

  ROOT.ScannerLayoutWindow = ScannerLayoutWindow;
})();

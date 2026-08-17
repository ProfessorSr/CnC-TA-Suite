(() => {
  'use strict';

  const HOST = globalThis.window ?? globalThis;
  const ROOT = (HOST.CnCTA = HOST.CnCTA || {});

  class ScannerWindow {
    constructor(controller) {
      this.controller = controller;
      this.layoutWindow = new ROOT.ScannerLayoutWindow(controller);
      this.options = controller.getOptionsSnapshot();
      this.buildWindow();
      this.unsubscribe = controller.subscribe(state => this.render(state));
    }

    buildWindow() {
      this.window = new qx.ui.window.Window('Scanner Overview').set({
        width: 1220,
        height: 590,
        showMinimize: true,
        showMaximize: true,
        showClose: true,
        resizable: true,
        contentPadding: 5,
        layout: new qx.ui.layout.VBox(4)
      });
      this.window.setDecorator(new qx.ui.decoration.Decorator(2, 'solid', '#c82828'));
      this.window.setBackgroundColor('rgba(30,30,30,0.87)');

      const controls = new qx.ui.container.Composite(new qx.ui.layout.Flow(5, 3));
      this.citySelect = new qx.ui.form.SelectBox().set({ width: 145, height: 25 });
      for (const city of this.options.ownCities) this.citySelect.add(new qx.ui.form.ListItem(city.name, null, city.id));
      controls.add(this.citySelect);
      controls.add(new qx.ui.basic.Label('CP Limit').set({ textColor: 'white', marginTop: 5 }));
      this.cp = new qx.ui.form.Spinner(1, 25, 99).set({ width: 60, height: 25 });
      controls.add(this.cp);
      controls.add(new qx.ui.basic.Label('min Level').set({ textColor: 'white', marginTop: 5 }));
      this.minLevel = new qx.ui.form.Spinner(1, 1, 80).set({ width: 58, height: 25 });
      controls.add(this.minLevel);
      controls.add(new qx.ui.basic.Label('max Level').set({ textColor: 'white', marginTop: 5 }));
      this.maxLevel = new qx.ui.form.Spinner(1, 80, 80).set({ width: 58, height: 25 });
      controls.add(this.maxLevel);
      controls.add(new qx.ui.basic.Label('Distance').set({ textColor: 'white', marginTop: 5 }));
      this.distance = new qx.ui.form.Spinner(1, Math.max(1, Math.round(this.options.maxAttackDistance)), 99)
        .set({ width: 58, height: 25 });
      controls.add(this.distance);

      this.typeChecks = {};
      for (const type of ['Base', 'Outpost', 'Camp', 'Player']) {
        const check = new qx.ui.form.CheckBox(type).set({ value: true, textColor: 'white', marginTop: 3 });
        this.typeChecks[type] = check;
        controls.add(check);
      }
      this.relationships = new qx.ui.form.SelectBox().set({ width: 130 });
      for (const [label, id] of [['All relations', 'all'], ['Allied', 'allied'], ['NAP', 'nap'], ['Enemy', 'enemy'], ['Neutral', 'neutral']]) {
        this.relationships.add(new qx.ui.form.ListItem(label, null, id));
      }
      controls.add(this.relationships);

      controls.add(new qx.ui.core.Spacer(5, 1), { lineBreak: true });
      this.scanButton = new qx.ui.form.Button('Scan').set({ width: 100, height: 25 });
      this.scanButton.addListener('execute', () => this.toggleScan());
      controls.add(this.scanButton);

      const progressTrack = new qx.ui.container.Composite(new qx.ui.layout.HBox(0)).set({
        width: 200,
        height: 22,
        minWidth: 200,
        maxWidth: 200,
        backgroundColor: '#30363d'
      });
      const progressFill = new qx.ui.core.Widget().set({ backgroundColor: '#4caf50' });
      const progressRemainder = new qx.ui.core.Widget();
      progressTrack.add(progressFill, { flex: 0 });
      progressTrack.add(progressRemainder, { flex: 1000 });
      let progressMaximum = 1;
      this.progress = {
        setMaximum(value) {
          progressMaximum = Math.max(1, Number(value) || 1);
        },
        setValue(value) {
          const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / progressMaximum));
          const filledWeight = Math.round(ratio * 1000);
          progressFill.setVisibility(filledWeight === 0 ? 'excluded' : 'visible');
          progressRemainder.setVisibility(filledWeight === 1000 ? 'excluded' : 'visible');
          progressFill.setLayoutProperties({ flex: filledWeight });
          progressRemainder.setLayoutProperties({ flex: 1000 - filledWeight });
        }
      };
      controls.add(progressTrack);
      this.progressLabel = new qx.ui.basic.Label('0/0').set({ textColor: '#ff2020', marginTop: 4 });
      controls.add(this.progressLabel);

      this.clearButton = new qx.ui.form.Button('clear Cache').set({ width: 105, height: 25 });
      this.clearButton.addListener('execute', () => this.controller.clear());
      controls.add(this.clearButton);
      this.exportButton = new qx.ui.form.Button('Copy Results').set({ width: 110, height: 25, enabled: false });
      this.exportButton.addListener('execute', () => this.copyResults());
      controls.add(this.exportButton);

      this.onlyCenter = new qx.ui.form.CheckBox('Only center on World').set({ value: true, textColor: 'white', marginTop: 3 });
      controls.add(this.onlyCenter);

      controls.add(new qx.ui.core.Spacer(5, 1), { lineBreak: true });
      this.layoutSelect = new qx.ui.form.SelectBox().set({ width: 170, height: 25 });
      for (const filter of ROOT.ScannerCalculator.FILTERS) this.layoutSelect.add(new qx.ui.form.ListItem(filter.label, null, filter.id));
      this.layoutSelect.addListener('changeSelection', event => {
        const selected = event.getData()?.[0];
        this.controller.setFilter(selected?.getModel() || 'all');
      });
      controls.add(this.layoutSelect);
      this.siloSelect = new qx.ui.form.SelectBox().set({ width: 180, height: 25 });
      for (const filter of ROOT.ScannerCalculator.SILO_FILTERS) this.siloSelect.add(new qx.ui.form.ListItem(filter.label, null, filter.id));
      this.siloSelect.addListener('changeSelection', event => {
        const selected = event.getData()?.[0];
        this.controller.setSiloFilter(selected?.getModel() || 'none');
      });
      controls.add(this.siloSelect);
      this.layoutsButton = new qx.ui.form.Button('Get Layouts').set({ width: 120, height: 25, enabled: false });
      this.layoutsButton.addListener('execute', () => this.layoutWindow.open(this.controller.getState().results));
      controls.add(this.layoutsButton);

      this.window.add(controls);
      this.model = new qx.ui.table.model.Simple();
      this.model.setColumns(['Type', 'Location', 'Level', 'CP', 'Tiberium', 'Crystal', 'Match']);
      this.table = new qx.ui.table.Table(this.model).set({ statusBarVisible: true });
      const columnModel = this.table.getTableColumnModel();
      columnModel.setColumnWidth(0, 110);
      columnModel.setColumnWidth(1, 85);
      columnModel.setColumnWidth(2, 55);
      columnModel.setColumnWidth(3, 45);
      columnModel.setColumnWidth(4, 85);
      columnModel.setColumnWidth(5, 85);
      columnModel.setColumnWidth(6, 180);
      this.table.addListener('cellDbltap', event => {
        const result = this.currentResults[event.getRow()];
        if (result) this.controller.focus(result, !this.onlyCenter.getValue());
      });
      this.window.add(this.table, { flex: 1 });
      this.status = new qx.ui.basic.Label('').set({ textColor: '#e6e6e6' });
      this.window.add(this.status);
    }

    selectedTypes() {
      return Object.entries(this.typeChecks).filter(([, check]) => check.getValue()).map(([type]) => type);
    }

    toggleScan() {
      const state = this.controller.getState();
      if (state.running) return this.controller.pause();
      if (state.progress?.phase === 'paused') return this.controller.resume();
      const selectedCity = this.citySelect.getSelection()[0];
      this.controller.start({
        originCityId: selectedCity?.getModel(),
        cpLimit: this.cp.getValue(),
        minLevel: this.minLevel.getValue(),
        maxLevel: this.maxLevel.getValue(),
        radius: this.distance.getValue(),
        types: this.selectedTypes(),
        relationships: (() => {
          const value = this.relationships.getSelection()[0]?.getModel() ?? 'all';
          return value === 'all' ? ['allied', 'nap', 'enemy', 'neutral'] : [value];
        })()
      });
    }

    async copyResults() {
      const header = 'Type\tName\tCoordinates\tLevel\tCP\tDistance\tTiberium\tCrystal\tLayout';
      const rows = (this.currentResults ?? []).map(result => [
        result.type,
        result.name ?? result.type,
        `${result.x}:${result.y}`,
        result.level,
        result.cp,
        Number(result.distance ?? 0).toFixed(2),
        result.layoutInfo.tiberium,
        result.layoutInfo.crystal,
        result.layoutInfo.label || ''
      ].join('\t'));
      const text = [header, ...rows].join('\n');
      try {
        if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
        else globalThis.prompt?.('Copy scanner results', text);
        this.status.setValue(`${rows.length} scanner result(s) copied.`);
      } catch (error) {
        this.status.setValue(`Unable to copy results: ${error?.message ?? error}`);
      }
    }

    render(state) {
      this.currentResults = state.results;
      const total = Number(state.progress?.total || 0);
      const current = Number(state.progress?.current || 0);
      this.progress.setMaximum(Math.max(total, 1));
      this.progress.setValue(Math.min(current, Math.max(total, 1)));
      this.progressLabel.setValue(`${current}/${total}`);
      this.scanButton.setLabel(state.running ? 'Pause' : state.progress?.phase === 'paused' ? 'Resume' : 'Scan');
      this.layoutsButton.setEnabled(!state.running && state.results.length > 0);
      this.exportButton.setEnabled(!state.running && state.results.length > 0);
      this.model.setData(state.results.map(result => [
        result.type,
        `${result.x}:${result.y}`,
        result.level,
        result.cp,
        result.layoutInfo.tiberium,
        result.layoutInfo.crystal,
        result.layoutInfo.label || '—'
      ]));
      if (state.error) {
        this.status.setValue(`Error: ${state.error}`);
      } else if (state.running && state.progress?.phase === 'discovering') {
        this.status.setValue('Discovering targets around the selected base…');
      } else if (state.running) {
        this.status.setValue(`Loading target layout ${Math.min(current + 1, total)}/${total}…`);
      } else if (state.progress?.phase === 'paused') {
        this.status.setValue(`Scan paused at ${current}/${total}. Results collected so far are preserved.`);
      } else if (state.progress?.phase === 'idle') {
        this.status.setValue('Ready to scan.');
      } else if (state.progress?.phase === 'complete' && total === 0) {
        const scan = state.progress.discovery ?? {};
        this.status.setValue(
          `No targets: ${scan.objects ?? 0} objects seen; types `
          + `${(scan.observedTypes ?? []).join(', ') || 'none'}; `
          + `${scan.unsupportedType ?? 0} unsupported, ${scan.missingId ?? 0} missing ID, `
          + `${scan.belowLevel ?? 0} below level, ${scan.aboveLevel ?? 0} above level, `
          + `${scan.aboveCp ?? 0} above CP.`
        );
      } else {
        this.status.setValue(`Scan complete: ${state.results.length} matching layouts.`);
      }
    }

    open() {
      if (!this.window.getLayoutParent()) qx.core.Init.getApplication().getRoot().add(this.window);
      this.window.open();
      this.window.center();
    }
  }

  ROOT.ScannerWindow = ScannerWindow;
})();

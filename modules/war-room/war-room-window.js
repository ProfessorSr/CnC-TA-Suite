import { ArmyAnalyzer } from './army-analyzer.js';
import { WarRoomCalculator } from './war-room-calculator.js';

// Keep the user-initiated formation executor isolated so it can be disabled
// independently without removing the read-only planner and simulations.
export const EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED = true;

function label(qx, text, options = {}) {
  return new qx.ui.basic.Label(text).set({ textColor: '#ffffff', wrap: true, ...options });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compactColumnWidth(name) {
  const label = String(name);
  if (/^(?:CP|Lvl|Level|Wins|Losses|Reports|Range|Speed)$/i.test(label)) return 58;
  if (/^(?:Health|State|Position|Result|Success)$/i.test(label)) return 72;
  if (/^(?:Tiberium|Crystal|Credits|Research|Loot|Other loot)$/i.test(label)) return 82;
  if (/^(?:Time|Coordinates|Average repair|Repair)$/i.test(label)) return 118;
  if (/^(?:Type|Role|Unit|Target|Attacking base|Best against)$/i.test(label)) return 125;
  if (/Open Reports/i.test(label)) return 96;
  if (/Information|ceiling|Combat section|Metric/i.test(label)) return 155;
  return 105;
}

function table(qx, columns) {
  const model = new qx.ui.table.model.Simple();
  model.setColumns(columns);
  const widget = new qx.ui.table.Table(model).set({ statusBarVisible: false });
  const columnModel = widget.getTableColumnModel();
  const storageKey = `cnc-ta-suite:war-room:columns:${columns.join('|')}`;
  let savedWidths = null;
  try { savedWidths = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? 'null'); } catch {}
  columns.forEach((column, index) => {
    const saved = Number(savedWidths?.[index]);
    columnModel.setColumnWidth(index, Number.isFinite(saved) && saved >= 35 ? saved : compactColumnWidth(column));
  });
  columnModel.addListener?.('widthChanged', () => {
    try {
      const widths = columns.map((_, index) => columnModel.getColumnWidth(index));
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(widths));
    } catch { /* Persistence is optional when browser storage is unavailable. */ }
  });
  return { widget, model };
}

function keyValuePage(qx, columns = ['Field', 'Value']) {
  const page = new qx.ui.container.Composite(new qx.ui.layout.VBox(6));
  const grid = table(qx, columns);
  page.add(grid.widget, { flex: 1 });
  return { page, grid };
}

function duration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function repairCostText(analysis) {
  const costs = analysis?.repairCostResources ?? {};
  return `Tib ${Math.round(costs.tiberium ?? 0).toLocaleString()} · Crystal ${Math.round(costs.crystal ?? 0).toLocaleString()}`
    + `${costs.credits ? ` · Credits ${Math.round(costs.credits).toLocaleString()}` : ''}`
    + `${costs.power ? ` · Power ${Math.round(costs.power).toLocaleString()}` : ''}`;
}

function unitCodes(units) {
  const codes = new Map();
  const claimed = new Map();
  for (const unit of units) {
    const name = String(unit.name || 'Unit');
    const compact = name.replace(/[^a-z0-9]/gi, '').toUpperCase() || 'UNIT';
    let length = Math.min(3, compact.length);
    let code = compact.slice(0, length);
    while (claimed.has(code) && claimed.get(code) !== name && length < compact.length) {
      length += 1;
      code = compact.slice(0, length);
    }
    if (claimed.has(code) && claimed.get(code) !== name) {
      let suffix = 2;
      while (claimed.has(`${code}${suffix}`)) suffix += 1;
      code = `${code}${suffix}`;
    }
    claimed.set(code, name);
    codes.set(unit, code);
  }
  return codes;
}

function codeForUnit(codes, snapshotUnits, unit) {
  if (codes.has(unit)) return codes.get(unit);
  const match = snapshotUnits.find((candidate) =>
    candidate.entityId != null && String(candidate.entityId) === String(unit.entityId)
  );
  return codes.get(match) ?? String(unit.name || 'UNIT').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4);
}

export class WarRoomWindow {
  constructor({ context, hub, simulator, stats }) {
    this.context = context;
    this.hub = hub;
    this.simulator = simulator;
    this.stats = stats;
    this.record = null;
  }

  build() {
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(6));
    root.set({ padding: 6, textColor: '#ffffff' });
    let buildDisposed = false;
    const widgetAlive = (widget) => !buildDisposed && widget && !widget.isDisposed?.();
    const safeSetValue = (widget, value) => {
      if (!widgetAlive(widget)) return false;
      try { widget.setValue(value); return true; } catch { return false; }
    };
    const safeSetEnabled = (widget, value) => {
      if (!widgetAlive(widget)) return false;
      try { widget.setEnabled(value); return true; } catch { return false; }
    };
    const windowVisible = () => !this.record?.window || Boolean(this.record.window.isVisible?.());
    let unsubscribePresetChanges = null;

    const toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    const stack = new qx.ui.container.Stack();
    const pages = new Map();
    let activeSectionId = 'search';
    const sections = [
      ['search', '🔍 Search'],
      ['planner', '⚔ Attack Planner'],
      ['simulator', '🎯 Battle Simulator'],
      ['reports', '📋 Report Summary'],
      ['army', '👥 Army Analyzer'],
      ['stats', '📈 Combat Statistics']
    ];

    for (const [id, title] of sections) {
      const button = new qx.ui.form.Button(title);
      toolbar.add(button);
      button.addListener('execute', () => {
        activeSectionId = id;
        stack.setSelection([pages.get(id).page]);
        render();
        if (id === 'stats') void loadCombatStatistics();
      });
    }
    this.showPage = (id) => {
      const page = pages.get(id)?.page;
      if (page) {
        activeSectionId = id;
        stack.setSelection([page]);
        render();
        if (id === 'stats') void loadCombatStatistics();
      }
    };
    toolbar.add(new qx.ui.core.Spacer(), { flex: 1 });
    const favorite = new qx.ui.form.Button('★ Favorite');
    const refresh = new qx.ui.form.Button('Refresh');
    toolbar.add(favorite);
    toolbar.add(refresh);
    root.add(toolbar);

    const planner = keyValuePage(qx);
    const plannerControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const plannerGoal = new qx.ui.form.SelectBox().set({ width: 230 });
    for (const [name, id] of [
      ['Destroy Construction Yard (CY)', 'cy'],
      ['Destroy Defense Facility (DF)', 'df'],
      ['Destroy Command Center (CC)', 'cc'],
      ['Maximize Defense Damage', 'defense'],
      ['Maximize Research Points (RP)', 'rp']
    ]) plannerGoal.add(new qx.ui.form.ListItem(name, null, id));
    const recommend = new qx.ui.form.Button('Simulate Best Formation');
    const searchDetail = new qx.ui.form.SelectBox().set({ width: 125 });
    for (const [name, id] of [['Quick', 'quick'], ['Detailed', 'detailed'], ['Exhaustive', 'exhaustive']]) {
      searchDetail.add(new qx.ui.form.ListItem(name, null, id));
    }
    searchDetail.setSelection([searchDetail.getChildren()[1]]);
    plannerControls.add(label(qx, 'Attack goal'));
    plannerControls.add(plannerGoal);
    plannerControls.add(label(qx, 'Search'));
    plannerControls.add(searchDetail);
    plannerControls.add(recommend);
    planner.page.addAt(plannerControls, 0);
    const presetControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const presetName = new qx.ui.form.TextField().set({
      width: 155,
      placeholder: 'Formation name'
    });
    const presetSelect = new qx.ui.form.SelectBox().set({ width: 210 });
    const savePreset = new qx.ui.form.Button('Save Formation');
    const loadPreset = new qx.ui.form.Button('Load Formation').set({ enabled: false });
    const deletePreset = new qx.ui.form.Button('Delete').set({ enabled: false });
    presetControls.add(label(qx, 'Presets'));
    presetControls.add(presetName);
    presetControls.add(savePreset);
    presetControls.add(presetSelect);
    presetControls.add(loadPreset);
    presetControls.add(deletePreset);
    planner.page.addAt(presetControls, 1);
    const plannerStatus = label(qx, 'Recommendations are visual only; move troops manually in the game.');
    const formationVisual = table(qx, ['Row', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    formationVisual.widget.set({ height: 190, minHeight: 150 });
    planner.page.add(formationVisual.widget);
    const formationLegend = label(qx, '<b>Troop legend</b><br>—', { rich: true });
    const formationLegendSection = new qx.ui.container.Composite(new qx.ui.layout.VBox()).set({
      padding: 8,
      marginTop: 6,
      backgroundColor: '#27333a',
      decorator: new qx.ui.decoration.Decorator(1, 'solid', '#667780')
    });
    formationLegendSection.add(formationLegend);
    const bestFormationResult = label(qx,
      '<b>Best Formation Result</b><br><span style="color:#52636b">Run a best-formation simulation to compare layouts.</span>', {
        rich: true,
        padding: 8,
        minHeight: 112,
        allowGrowX: true,
        allowGrowY: true,
        allowShrinkY: false,
        textColor: '#17262d',
        backgroundColor: '#d9ece1',
        decorator: new qx.ui.decoration.Decorator(1, 'solid', '#3d8b5a')
      });
    let plannerResultHtml = bestFormationResult.getValue();
    const setPlannerResult = (value) => {
      plannerResultHtml = value;
      if (activeSectionId === 'planner') safeSetValue(bestFormationResult, value);
    };
    const formationTools = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    const previewUndo = new qx.ui.form.Button('Undo').set({ enabled: false });
    const previewRedo = new qx.ui.form.Button('Redo').set({ enabled: false });
    const previewReset = new qx.ui.form.Button('Reset').set({ enabled: false });
    const simulatePreview = new qx.ui.form.Button('Simulate Preview').set({ enabled: false });
    const shiftLeft = new qx.ui.form.Button('←');
    const shiftRight = new qx.ui.form.Button('→');
    const shiftUp = new qx.ui.form.Button('↑');
    const shiftDown = new qx.ui.form.Button('↓');
    const mirrorHorizontal = new qx.ui.form.Button('Mirror H');
    const mirrorVertical = new qx.ui.form.Button('Mirror V');
    const swapRows12 = new qx.ui.form.Button('Swap 1/2');
    const swapRows23 = new qx.ui.form.Button('Swap 2/3');
    const swapRows34 = new qx.ui.form.Button('Swap 3/4');
    formationTools.add(label(qx, 'Preview'));
    for (const button of [
      previewUndo, previewRedo, previewReset, simulatePreview,
      shiftLeft, shiftRight, shiftUp, shiftDown,
      mirrorHorizontal, mirrorVertical, swapRows12, swapRows23, swapRows34
    ]) formationTools.add(button);
    planner.page.add(formationTools);
    const unitTools = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    const previewUnit = new qx.ui.form.SelectBox().set({ width: 190 });
    const previewColumn = new qx.ui.form.Spinner(1, 1, 9).set({ width: 55 });
    const previewRow = new qx.ui.form.Spinner(1, 1, 4).set({ width: 55 });
    const movePreviewUnit = new qx.ui.form.Button('Move / Swap');
    const togglePreviewUnit = new qx.ui.form.Button('Enable / Disable');
    unitTools.add(label(qx, 'Unit')); unitTools.add(previewUnit);
    unitTools.add(label(qx, 'Column')); unitTools.add(previewColumn);
    unitTools.add(label(qx, 'Row')); unitTools.add(previewRow);
    unitTools.add(movePreviewUnit); unitTools.add(togglePreviewUnit);
    planner.page.add(unitTools);
    unitTools.exclude();
    const bulkTools = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    const bulkScope = new qx.ui.form.SelectBox().set({ width: 145 });
    for (const [name, id] of [['All units', 'all'], ['Infantry', 'infantry'], ['Vehicles', 'vehicle'], ['Aircraft', 'air'], ['Selected row', 'row']]) bulkScope.add(new qx.ui.form.ListItem(name, null, id));
    const bulkRow = new qx.ui.form.Spinner(1, 1, 4).set({ width: 55 });
    const enableBulk = new qx.ui.form.Button('Enable');
    const disableBulk = new qx.ui.form.Button('Disable');
    bulkTools.add(label(qx, 'Bulk selection')); bulkTools.add(bulkScope); bulkTools.add(label(qx, 'Row')); bulkTools.add(bulkRow); bulkTools.add(enableBulk); bulkTools.add(disableBulk);
    planner.page.add(bulkTools);

    const experimentalBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(6)).set({
      padding: 8,
      backgroundColor: '#321414',
      decorator: new qx.ui.decoration.Decorator(2, 'solid', '#ff3b30')
    });
    experimentalBox.add(label(qx, 'ONE-CLICK FORMATION ARRANGER', {
      font: 'bold',
      textColor: '#ff6b63'
    }));
    experimentalBox.add(label(qx,
      'This explicit action uses the game formation movement API to arrange the displayed preview. Review the formation before confirming.'
    ));
    const applyRecommendation = new qx.ui.form.Button('Apply Recommended Formation').set({
      enabled: false,
      width: 235,
      alignX: 'left'
    });
    experimentalBox.add(applyRecommendation);
    if (EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED) planner.page.add(experimentalBox);

    const presetStorageKey = 'module:war-room:formation-presets:v1';
    let formationPresets = [];
    const presetMatchesTarget = (preset, snapshot = this.hub.snapshot()) => Boolean(
      preset?.target?.id != null
      && snapshot.target?.id != null
      && String(preset.target.id) === String(snapshot.target.id)
    );
    const selectedPreset = () => {
      const id = presetSelect.getSelection?.()?.[0]?.getModel?.();
      return formationPresets.find((preset) => String(preset.id) === String(id)) ?? null;
    };
    const renderPresets = (selectedId = null) => {
      presetSelect.removeAll();
      let selectedItem = null;
      const snapshot = this.hub.snapshot();
      const attackerId = snapshot.attacker?.id;
      for (const preset of formationPresets.filter((item) =>
        String(item.attackerId) === String(attackerId)
        && presetMatchesTarget(item, snapshot)
      )) {
        const item = new qx.ui.form.ListItem(preset.name, null, preset.id);
        presetSelect.add(item);
        if (String(preset.id) === String(selectedId)) selectedItem = item;
      }
      if (selectedItem) presetSelect.setSelection([selectedItem]);
      const available = Boolean(presetSelect.getSelection?.()?.length);
      loadPreset.setEnabled(available);
      deletePreset.setEnabled(available);
    };
    const loadFormationPresets = async (selectedId = null) => {
      formationPresets = await this.context.storage?.get?.(presetStorageKey, []) ?? [];
      renderPresets(selectedId);
    };
    unsubscribePresetChanges = this.context.events?.on?.('war-room:formation-presets-changed', (event = {}) => {
      void loadFormationPresets(event.presetId).catch((error) => {
        this.context.logger?.warn?.('War Room formation presets could not be synchronized.', error);
      });
    });

    const simulator = keyValuePage(qx, [
      'Run', 'CY left', 'DF left', 'Defender left', 'Own left',
      'Repair time', 'Tib repair', 'Crystal repair', 'Loot', 'RP', 'Duration', 'Outcome', 'Morale', 'Auto repair', 'Source'
    ]);
    simulator.grid.widget.set({ height: 125, minHeight: 100, maxHeight: 150 });
    const reports = keyValuePage(qx, [
      'Time', 'Type', 'Attacking base', 'Target', 'Coordinates', 'Result', 'CP',
      'Tiberium', 'Crystal', 'Credits', 'Research', 'Other loot', 'Repair', 'Open Reports'
    ]);
    const reportDetail = label(qx, 'Select an attack to review its summary.', { rich: true, textColor: '#d5e2e8' });
    let nativeReportStatus = 'Native reports have not been loaded yet.';
    const reportSummary = label(qx, 'No report metrics loaded.', { textColor: '#ffffff', wrap: true });
    const reportCategory = new qx.ui.form.SelectBox().set({ width: 150 });
    for (const [name, id] of [['Offense', 'offense'], ['Defense', 'defense'], ['The Forgotten', 'forgotten'], ['Others', 'others']]) {
      reportCategory.add(new qx.ui.form.ListItem(name, null, id));
    }
    const reportActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    reportActions.add(label(qx, 'Raid Report category'));
    reportActions.add(reportCategory);
    reports.page.add(reportDetail);
    reports.page.add(reportActions);
    let displayedReports = [];
    let selectedReport = null;
    const army = keyValuePage(qx, ['Unit', 'Role', 'Level', 'Health', 'State', 'Position', 'Range', 'Speed', 'Best against', 'Est. 1v1 ceiling', 'Repair crystal needed']);
    const armySummary = label(qx, 'No offensive formation loaded.', { textColor: '#ffffff', wrap: true });
    const armyBase = new qx.ui.form.SelectBox().set({ width: 220 });
    const repairArmy = new qx.ui.form.Button('Repair All Troops');
    const exportArmyCsv = new qx.ui.form.Button('Download CSV');
    const armyControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    armyControls.add(label(qx, 'Offense base'));
    armyControls.add(armyBase);
    armyControls.add(repairArmy);
    armyControls.add(exportArmyCsv);
    armyControls.add(label(qx, 'Only bases with a Command Center are listed. 1v1 ceilings are estimates; use native simulation for battle decisions.', { wrap: true }), { flex: 1 });
    army.page.addAt(armyControls, 0);
    const search = keyValuePage(qx, ['Type', 'Location', 'Level', 'CP', 'Attack']);
    let selectedSearchTarget = null;
    const targetControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const initialSnapshot = this.hub.snapshot();
    const initialOffenseLevel = Math.max(1, Math.round(Number(
      initialSnapshot.attacker?.offenseLevel || initialSnapshot.attacker?.level || 1
    )));
    const minLevel = new qx.ui.form.Spinner(1, initialOffenseLevel, 100).set({ width: 65 });
    const maxLevel = new qx.ui.form.Spinner(1, Math.min(100, initialOffenseLevel + 5), 100).set({ width: 65 });
    const maxCp = new qx.ui.form.Spinner(1, 41, 41).set({ width: 65 });
    // CP is the user-facing reach constraint. A 40-field discovery radius is
    // already broader than a legal 40-CP attack and avoids scanning millions
    // of empty world coordinates on the UI event thread.
    const searchRadius = 41;
    const targetTypes = {};
    targetControls.add(label(qx, 'Level'));
    targetControls.add(minLevel);
    targetControls.add(label(qx, 'to'));
    targetControls.add(maxLevel);
    targetControls.add(label(qx, 'Max CP'));
    targetControls.add(maxCp);
    for (const type of ['Base', 'Camp', 'Outpost', 'PVP']) {
      const check = new qx.ui.form.CheckBox(type).set({ value: true, textColor: '#ffffff' });
      targetTypes[type === 'PVP' ? 'Player' : type] = check;
      targetControls.add(check);
    }
    const allianceCheck = new qx.ui.form.CheckBox('Alliance').set({ value: false, textColor: '#ffffff' });
    const allianceSelect = new qx.ui.form.SelectBox().set({ width: 180, enabled: false });
    targetControls.add(allianceCheck);
    targetControls.add(allianceSelect);
    const targetSearch = new qx.ui.form.Button('Search Targets');
    targetControls.add(targetSearch);
    search.page.addAt(targetControls, 0);
    const searchExportControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const exportSearchCsv = new qx.ui.form.Button('Download CSV').set({ enabled: false });
    const copySearchList = new qx.ui.form.Button('Copy Target List').set({ enabled: false });
    const messageSearchList = new qx.ui.form.Button('Open Message Draft').set({ enabled: false });
    searchExportControls.add(label(qx, 'Share results'));
    searchExportControls.add(exportSearchCsv);
    searchExportControls.add(copySearchList);
    searchExportControls.add(messageSearchList);
    search.page.addAt(searchExportControls, 1);
    const targetStatus = label(qx, 'Search from the current attacker base, or open War Room from an attack screen.');
    search.page.add(targetStatus);
    const targetIntel = table(qx, ['Target Information', 'Value']);
    targetIntel.widget.set({ height: 245, minHeight: 180 });
    search.page.add(targetIntel.widget);
    const stats = keyValuePage(qx, [
      'Metric', 'Attack players', 'Attack Forgotten', 'Defend Forgotten',
      'Defend players', 'All attacks', 'All defense'
    ]);
    stats.grid.widget.set({ height: 275, minHeight: 235, maxHeight: 310 });
    const statsControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const statsBase = new qx.ui.form.SelectBox().set({ width: 190 });
    const exportHistory = new qx.ui.form.Button('Copy History');
    const exportStatsCsv = new qx.ui.form.Button('Download CSV');
    const clearHistory = new qx.ui.form.Button('Clear History');
    const statsStatus = label(qx, 'Attack efficiency analysis persists between sessions.', { wrap: true });
    statsControls.add(label(qx, 'Base'));
    statsControls.add(statsBase);
    statsControls.add(exportHistory);
    statsControls.add(exportStatsCsv);
    statsControls.add(clearHistory);
    stats.page.addAt(statsControls, 0);

    let allianceLoadSequence = 0;
    const allianceOptions = new Map();
    const loadAlliances = async () => {
      const sequence = ++allianceLoadSequence;
      const snapshot = this.hub.snapshot();
      allianceSelect.setEnabled(false);
      targetStatus.setValue('Loading current alliances from the world ranking…');
      const loaded = await this.hub.getAllianceOptions({ originCityId: snapshot.attacker?.id });
      if (sequence !== allianceLoadSequence || !allianceCheck.getValue()) return;
      const alliances = [...new Map((loaded ?? [])
        .filter((alliance) => String(alliance?.name ?? '').trim())
        .map((alliance) => [String(alliance.name).trim().toLocaleLowerCase(), {
          ...alliance, name: String(alliance.name).trim()
        }])).values()];
      allianceSelect.removeAll();
      allianceOptions.clear();
      for (const alliance of alliances) {
        const key = alliance.id != null && String(alliance.id).trim()
          ? `id:${String(alliance.id).trim()}`
          : `name:${alliance.name.toLocaleLowerCase()}`;
        allianceOptions.set(key, alliance);
        allianceSelect.add(new qx.ui.form.ListItem(alliance.name, null, key));
      }
      allianceSelect.setEnabled(allianceCheck.getValue() && alliances.length > 0);
      if (allianceCheck.getValue()) {
        targetStatus.setValue(alliances.length
          ? `${alliances.length} alliances found in the world data.`
          : 'No alliances are available in the loaded world data.');
      }
    };

    allianceCheck.addListener('changeValue', (event) => {
      const enabled = Boolean(event.getData());
      if (enabled) {
        for (const check of Object.values(targetTypes)) {
          check.setValue(false);
          check.setEnabled(false);
        }
        void loadAlliances().catch((error) => {
          if (!allianceCheck.getValue()) return;
          allianceSelect.setEnabled(false);
          targetStatus.setValue(`Alliance list failed: ${error?.message ?? error}`);
          this.context.logger?.warn?.('War Room alliance list failed.', error);
        });
      } else {
        allianceLoadSequence += 1;
        allianceSelect.setEnabled(false);
        for (const check of Object.values(targetTypes)) check.setEnabled(true);
      }
    });
    for (const check of Object.values(targetTypes)) {
      check.addListener('changeValue', (event) => {
        if (!event.getData()) return;
        allianceCheck.setValue(false);
      });
    }
    for (const [id, value] of Object.entries({ search, planner, simulator, reports, army, stats })) {
      pages.set(id, value);
      stack.add(value.page);
    }

    const simulatorActions = new qx.ui.container.Composite(new qx.ui.layout.VBox(8));
    const simulatorText = label(qx, 'Open a target in combat setup to begin live native simulation.');
    const runSimulations = new qx.ui.form.Button('Simulate & Play');
    const launch = new qx.ui.form.Button('Return to Attack Setup');
    const cachedResultsTitle = label(qx, 'Cached simulation results', { font: 'bold' });
    const cachedResults = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    const cachedResultsScroll = new qx.ui.container.Scroll().set({
      height: 330, minHeight: 230, scrollbarX: 'auto', scrollbarY: 'auto'
    });
    cachedResultsScroll.add(cachedResults);
    const miniMove = new qx.ui.container.Composite(new qx.ui.layout.HBox(4)).set({
      padding: 5, backgroundColor: '#27333a'
    });
    const simPreviewUnit = new qx.ui.form.SelectBox().set({ width: 180 });
    const miniLeft = new qx.ui.form.Button('◀').set({ toolTipText: 'Move selected troop left in preview' });
    const miniUp = new qx.ui.form.Button('▲').set({ toolTipText: 'Move selected troop up in preview' });
    const miniDown = new qx.ui.form.Button('▼').set({ toolTipText: 'Move selected troop down in preview' });
    const miniRight = new qx.ui.form.Button('▶').set({ toolTipText: 'Move selected troop right in preview' });
    const miniToggle = new qx.ui.form.Button('Hide / Show').set({ toolTipText: 'Toggle selected troop in preview' });
    const miniApply = new qx.ui.form.Button('Use Preview').set({ toolTipText: 'Arrange live troops to match the preview' });
    miniMove.add(label(qx, 'Formation')); miniMove.add(simPreviewUnit);
    for (const button of [miniLeft, miniUp, miniDown, miniRight, miniToggle, miniApply]) miniMove.add(button);
    const simulatorSettingsKey = 'module:war-room:simulator-settings:v1';
    const simulatorSettings = { skipVictory: false, suppressTooltips: false, lockAttack: false, lockRepair: false };
    const settingsRow = new qx.ui.container.Composite(new qx.ui.layout.Flow(6, 4));
    const settingChecks = {};
    for (const [key, text] of [['skipVictory', 'Skip victory popup'], ['suppressTooltips', 'Suppress setup tooltips'], ['lockAttack', 'Lock native Attack'], ['lockRepair', 'Lock native Repair']]) {
      const check = new qx.ui.form.CheckBox(text).set({ textColor: '#fff' });
      settingChecks[key] = check;
      check.addListener('changeValue', (event) => { simulatorSettings[key] = Boolean(event.getData()); void this.context.storage?.set?.(simulatorSettingsKey, simulatorSettings); });
      settingsRow.add(check);
    }
    const resetSimulatorSettings = new qx.ui.form.Button('Reset Settings');
    resetSimulatorSettings.addListener('execute', () => { for (const [key, check] of Object.entries(settingChecks)) { simulatorSettings[key] = false; check.setValue(false); } void this.context.storage?.set?.(simulatorSettingsKey, simulatorSettings); });
    settingsRow.add(resetSimulatorSettings);
    simulatorActions.add(simulatorText);
    simulatorActions.add(runSimulations);
    simulatorActions.add(launch);
    simulatorActions.add(cachedResultsTitle);
    simulatorActions.add(cachedResultsScroll, { flex: 1 });
    simulatorActions.add(settingsRow);
    simulator.page.add(simulatorActions);
    void this.context.storage?.get?.(simulatorSettingsKey, simulatorSettings).then((saved) => {
      Object.assign(simulatorSettings, saved ?? {});
      for (const [key, check] of Object.entries(settingChecks)) check.setValue(Boolean(simulatorSettings[key]));
    });

    const overview = new qx.ui.container.Composite(new qx.ui.layout.VBox(8));
    overview.set({ width: 220, minWidth: 180, maxWidth: 280, padding: 8 });
    const overviewTitle = label(qx, 'Combat Overview', { font: 'bold' });
    const overviewAttacker = label(qx, 'Attacker: —');
    const overviewTarget = label(qx, 'Target: —');
    const overviewFormation = label(qx, 'Formation: —');
    const overviewReadiness = label(qx, 'Readiness: —');
    const overviewAttacks = label(qx, 'Estimated attacks: —');
    overview.add(overviewTitle);
    overview.add(overviewAttacker);
    overview.add(overviewTarget);
    overview.add(overviewFormation);
    overview.add(overviewReadiness);
    overview.add(overviewAttacks);
    overview.add(plannerStatus);
    overview.add(bestFormationResult);
    overview.add(formationLegendSection);
    overview.add(new qx.ui.core.Spacer(), { flex: 1 });

    const overviewScroll = new qx.ui.container.Scroll().set({
      width: 238,
      minWidth: 198,
      maxWidth: 298,
      scrollbarX: 'off',
      scrollbarY: 'auto'
    });
    overviewScroll.add(overview);
    const workspace = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    workspace.add(overviewScroll);
    workspace.add(stack, { flex: 1 });
    root.add(workspace, { flex: 1 });
    const footer = label(qx, 'Select a target in the game, then refresh War Room.');
    root.add(footer);

    const render = () => {
      try {
        const snapshot = this.hub.snapshot();
        const summary = WarRoomCalculator.summarize(snapshot);
        planner.grid.model.setData([
          ['Attacker', snapshot.attacker?.name ?? 'No base'],
          ['Target', snapshot.target ? `${snapshot.target.name} Lvl ${snapshot.target.level}` : 'No target selected'],
          ['Target level', snapshot.target?.level ?? '—'],
          ['Command points', snapshot.cpCost],
          ['Estimated attacks', snapshot.target
            ? `${snapshot.attackEstimate.possibleAttacks} possible (${snapshot.attackEstimate.commandPointAttacks} by CP; ${Number.isFinite(snapshot.attackEstimate.fullyRepairableAttacks) ? `${snapshot.attackEstimate.fullyRepairableAttacks} fully repairable + 1 final hit` : 'repair time not limiting'})`
            : '—'],
          ['Formation units', summary.unitCount],
          ['Average unit level', summary.averageLevel.toFixed(1)],
          ['Level difference', summary.levelDelta.toFixed(1)],
          ['Readiness', summary.readiness]
        ]);
        displayedReports = this.hub.getCombatReports();
        const lootAmount = (report, pattern) => Object.entries(report.loot ?? {}).reduce((sum, [type, amount]) => {
          const name = report.lootLabels?.[type] ?? `Resource ${type}`;
          return pattern.test(name) ? sum + Number(amount || 0) : sum;
        }, 0);
        reports.grid.model.setData(displayedReports.map((report) => {
          const at = Number(report.at) < 1e12 ? Number(report.at) * 1000 : Number(report.at);
          const tib = lootAmount(report, /tiberium/i);
          const crystal = lootAmount(report, /crystal|chrystal/i);
          const credits = lootAmount(report, /credit|gold/i);
          const research = lootAmount(report, /research/i);
          const total = Object.values(report.loot ?? {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
          return [
            at ? new Date(at).toLocaleString() : 'Unknown', report.type, report.ownBase, report.target,
            report.targetX || report.targetY ? `${report.targetX}:${report.targetY}` : '—',
            report.won ? (report.destroyed ? 'Destroyed' : 'Victory') : (report.resultName || 'Defeat'), report.cp || '—',
            Math.round(tib), Math.round(crystal), Math.round(credits), Math.round(research),
            Math.round(Math.max(0, total - tib - crystal - credits - research)),
            duration(report.repairSeconds), '↗ Open Reports'
          ];
        }));
        const reportCp = displayedReports.reduce((sum, report) => sum + Number(report.cp || 0), 0);
        const reportLoot = displayedReports.reduce((sum, report) => sum
          + Object.values(report.loot ?? {}).reduce((total, amount) => total + Number(amount || 0), 0), 0);
        const reportRepair = displayedReports.reduce((sum, report) => sum + Number(report.repairSeconds || 0), 0);
        const reportWins = displayedReports.filter((report) => report.won).length;
        reportSummary.setValue(
          `${displayedReports.length} reports · ${reportWins} victories · ${reportCp} CP · `
          + `${Math.round(reportLoot).toLocaleString()} resources · ${reportCp ? Math.round(reportLoot / reportCp).toLocaleString() : 0} resources/CP · `
          + `${duration(reportRepair)} total repair · ${displayedReports.length ? duration(reportRepair / displayedReports.length) : '0s'} average repair`
        );
        if (selectedReport) {
          selectedReport = displayedReports.find((report) => String(report.id) === String(selectedReport.id)) ?? null;
        }
        const offenseBases = this.hub.offenseBases();
        const selectedBaseId = armyBase.getSelection?.()?.[0]?.getModel?.();
        const selectedBase = offenseBases.find((base) => String(base.id) === String(selectedBaseId)) ?? offenseBases[0];
        const armyOptionsSignature = offenseBases.map((base) => `${base.id}:${base.name}`).join('|');
        if (this.armyOptionsSignature !== armyOptionsSignature) {
          this.armyOptionsSignature = armyOptionsSignature;
          armyBase.removeAll();
          for (const base of offenseBases) armyBase.add(new qx.ui.form.ListItem(`${base.name} · CC L${base.commandCenterLevel}`, null, base.id));
          const item = armyBase.getSelectables?.(true)?.find((entry) => String(entry.getModel?.()) === String(selectedBase?.id));
          if (item) armyBase.setSelection([item]);
        }
        const armySnapshot = selectedBase ?? snapshot;
        const armyRows = ArmyAnalyzer.rows(armySnapshot);
        this.currentArmyRows = armyRows;
        army.grid.model.setData(armyRows);
        const armyMetrics = ArmyAnalyzer.summarize(armySnapshot);
        armySummary.setValue(selectedBase
          ? `${selectedBase.name} · Command Center L${selectedBase.commandCenterLevel} · ${armyMetrics.text}`
          : 'No owned base with a Command Center was found.');
        if (!this.searchResults) search.grid.model.setData([]);
        const allCombatReports = this.hub.getAllCombatReports();
        const selectedStatsBase = statsBase.getSelection?.()?.[0]?.getModel?.() ?? 'All bases';
        const availableStatsBases = ['All bases', ...new Map(offenseBases.map((base) =>
          [String(base.name).trim().toLowerCase(), String(base.name).trim()])).values()];
        const statsBaseOptionsSignature = availableStatsBases.map((name) => name.toLowerCase()).join('|');
        if (this.statsBaseOptionsSignature !== statsBaseOptionsSignature) {
          // Commit the signature before mutating the select box. Qooxdoo fires
          // changeSelection synchronously from removeAll/add/setSelection.
          this.statsBaseOptionsSignature = statsBaseOptionsSignature;
          this.updatingStatsBase = true;
          try {
            statsBase.removeAll();
            for (const base of availableStatsBases) statsBase.add(new qx.ui.form.ListItem(base, null, base));
            const selected = statsBase.getSelectables?.(true)?.find((item) => String(item.getModel?.()) === String(selectedStatsBase))
              ?? statsBase.getSelectables?.(true)?.[0];
            if (selected) statsBase.setSelection([selected]);
          } finally {
            this.updatingStatsBase = false;
          }
        }
        const effectiveStatsBase = availableStatsBases.includes(selectedStatsBase) ? selectedStatsBase : 'All bases';
        const statsRows = this.stats.overviewMatrix(allCombatReports, effectiveStatsBase);
        this.currentStatsRows = statsRows;
        stats.grid.model.setData(statsRows);
        const baseReports = effectiveStatsBase === 'All bases' ? allCombatReports
          : allCombatReports.filter((report) => report.ownBase === effectiveStatsBase);
        const combatOverviewRows = this.stats.overviewRows(baseReports);
        const allAttacks = combatOverviewRows.find((row) => row[0] === 'All attacks');
        const allDefense = combatOverviewRows.find((row) => row[0] === 'All defense');
        statsStatus.setValue(`${effectiveStatsBase} · ${this.stats.overviewSummary(baseReports)}`);
        plannerStatus.setVisibility(activeSectionId === 'planner' ? 'visible' : 'excluded');
        if (activeSectionId === 'army') {
          bestFormationResult.setValue(
            '<b>Army Information</b><br><br>'
            + `<b>Base</b><br><span style="color:#005f86">${escapeHtml(selectedBase?.name ?? 'No offense base')}</span><br><br>`
            + `<b>Command Center</b><br>L${Number(selectedBase?.commandCenterLevel ?? 0)}<br><br>`
            + `<b>Units</b><br>${armyMetrics.unitCount}<br>`
            + `<span style="color:#19733a">Ready: ${armyMetrics.ready}</span><br>`
            + `<span style="color:#b32323">Damaged: ${armyMetrics.damaged}</span><br>`
            + `<span style="color:#52636b">Hidden: ${armyMetrics.hidden}</span><br><br>`
            + `<b>Average level</b><br>${armyMetrics.averageLevel.toFixed(1)}<br><br>`
            + `<b>Average health</b><br>${armyMetrics.averageHealth.toFixed(1)}%<br><br>`
            + `<b>Readiness index</b><br>${armyMetrics.readinessIndex.toFixed(1)}<br><br>`
            + `<b>Composition</b><br>${Object.entries(armyMetrics.roles).map(([role, count]) => `${escapeHtml(role)}: ${count}`).join('<br>') || '—'}`
          );
        } else if (activeSectionId === 'stats') {
          bestFormationResult.setValue(
            '<b>Combat Statistics</b><br><br>'
            + `<b>Base filter</b><br><span style="color:#005f86">${escapeHtml(effectiveStatsBase)}</span><br><br>`
            + `<b>Completed reports</b><br>${baseReports.length}<br><br>`
            + `<b>Attacks</b><br>${allAttacks?.[1] ?? 0} reports<br>${escapeHtml(allAttacks?.[4] ?? '—')} success<br><br>`
            + `<b>Defense</b><br>${allDefense?.[1] ?? 0} reports<br>${escapeHtml(allDefense?.[4] ?? '—')} success`
          );
        } else if (activeSectionId === 'reports') {
          const categoryName = reportCategory.getSelection?.()?.[0]?.getLabel?.() ?? 'Reports';
          bestFormationResult.setValue(
            '<b>Report Summary</b><br><br>'
            + `<b>Category</b><br><span style="color:#005f86">${escapeHtml(categoryName)}</span><br><br>`
            + `<b>Reports</b><br>${displayedReports.length}<br><br>`
            + `<b>Victories</b><br>${reportWins}<br><br>`
            + `<b>Command points</b><br>${reportCp || '—'}<br><br>`
            + `<b>Resources</b><br>${Math.round(reportLoot).toLocaleString()}<br><br>`
            + `<b>Resources / CP</b><br>${reportCp ? Math.round(reportLoot / reportCp).toLocaleString() : '—'}<br><br>`
            + `<b>Total repair</b><br>${duration(reportRepair)}<br><br>`
            + `<b>Average repair</b><br>${displayedReports.length ? duration(reportRepair / displayedReports.length) : '0:00:00'}<br><br>`
            + `<b>Native report status</b><br><span style="color:#52636b">${escapeHtml(nativeReportStatus)}</span>`
          );
        } else if (activeSectionId === 'search') {
          const enabledTypes = Object.entries(targetTypes)
            .filter(([, check]) => check.getValue())
            .map(([type]) => type === 'Player' ? 'PVP' : type)
            .join(', ') || (allianceCheck.getValue() ? 'Alliance' : 'None');
          const selectedAllianceName = allianceCheck.getValue()
            ? allianceSelect.getSelection?.()?.[0]?.getLabel?.() ?? '—'
            : null;
          bestFormationResult.setValue(
            '<b>Search Information</b><br><br>'
            + `<b>Target types</b><br><span style="color:#005f86">${escapeHtml(enabledTypes)}</span><br><br>`
            + (selectedAllianceName ? `<b>Alliance</b><br>${escapeHtml(selectedAllianceName)}<br><br>` : '')
            + `<b>Level range</b><br>${minLevel.getValue()}–${maxLevel.getValue()}<br><br>`
            + `<b>Maximum CP</b><br>${maxCp.getValue()}<br><br>`
            + `<b>Results</b><br>${this.searchResults?.length ?? 0}`
            + (selectedSearchTarget
              ? '<br><br><b>Selected target</b><br>'
                + `<span style="color:#005f86">${escapeHtml(selectedSearchTarget.name || selectedSearchTarget.type)}</span><br>`
                + `Type: ${escapeHtml(selectedSearchTarget.type)}<br>`
                + `Owner: ${escapeHtml(selectedSearchTarget.owner || '—')}<br>`
                + `Alliance: ${escapeHtml(selectedSearchTarget.alliance || '—')}<br>`
                + `Level: ${Number(selectedSearchTarget.level) || 0}<br>`
                + `Coordinates: ${Number(selectedSearchTarget.x) || 0}:${Number(selectedSearchTarget.y) || 0}<br>`
                + `CP: ${Number(selectedSearchTarget.cp) || 0}<br>`
                + `Distance: ${Number(selectedSearchTarget.distance || 0).toFixed(2)}`
              : '<br><br><span style="color:#52636b">Select a result to inspect it here.</span>')
          );
        } else if (activeSectionId === 'planner') {
          bestFormationResult.setValue(plannerResultHtml);
        } else {
          bestFormationResult.setValue(
            '<b>War Room Information</b><br><br>'
            + `<span style="color:#52636b">${escapeHtml(footer.getValue())}</span>`
          );
        }
        overviewAttacker.setValue(`Attacker: ${snapshot.attacker?.name ?? 'No base'}`);
        overviewTarget.setValue(`Target: ${snapshot.target ? `${snapshot.target.name} Lvl ${snapshot.target.level}` : 'No target'}`);
        overviewFormation.setValue(`Formation: ${summary.unitCount} units`);
        overviewReadiness.setValue(`Readiness: ${summary.readiness}`);
        overviewAttacks.setValue(`Estimated attacks: ${snapshot.target ? snapshot.attackEstimate.possibleAttacks : '—'}`);
        footer.setValue(
          `${snapshot.attacker?.name ?? 'No attacker'} → ${snapshot.target ? `${snapshot.target.name} Lvl ${snapshot.target.level}` : 'No target'} | `
          + `${snapshot.cpCost} CP | ${summary.unitCount} units | ${Math.round(summary.cpEfficiency)} loot/CP`
        );
        this.currentSnapshot = snapshot;
        this.currentSummary = summary;
        if (
          snapshot.target?.id
          && !(activeSectionId === 'search' && selectedSearchTarget)
          && String(snapshot.target.id) !== String(this.intelTargetId ?? '')
        ) {
          targetStatus.setValue(`Selected from game: ${snapshot.target.name}. Loading target intelligence…`);
          targetIntel.model.setData([
            ['Target', snapshot.target.name],
            ['Level / coordinates', `${snapshot.target.level} / ${snapshot.target.x}:${snapshot.target.y}`],
            ['Owner', snapshot.target.owner],
            ['Alliance', snapshot.target.alliance || '—'],
            ['Attack cost', `${snapshot.cpCost} CP`]
          ]);
        }
      } catch (error) {
        footer.setValue(`War Room data unavailable: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room refresh failed.', error);
      }
    };

    let liveTimer = null;
    let selectedFormationCell = null;
    let liveSimulationRunning = false;
    let liveSimulationQueued = false;
    let playSimulationQueued = false;
    let optimizationRunning = false;
    let recommendationSequence = 0;
    let liveFormationSequence = 0;
    let observedTargetId = null;
    let observedFormation = null;
    const simulationCache = new Map();
    let displayedRecommendation = null;
    let previewOriginal = null;
    let previewUndoStack = [];
    let previewRedoStack = [];

    const cloneRecommendation = (recommendation) => recommendation ? {
      ...recommendation,
      grid: recommendation.grid.map((row) => row.map((unit) => unit ? { ...unit } : null))
    } : null;

    const updatePreviewControls = () => {
      const available = Boolean(displayedRecommendation);
      previewUndo.setEnabled(previewUndoStack.length > 0);
      previewRedo.setEnabled(previewRedoStack.length > 0);
      previewReset.setEnabled(available && previewOriginal != null);
      simulatePreview.setEnabled(available);
      for (const button of [
        shiftLeft, shiftRight, shiftUp, shiftDown, mirrorHorizontal, mirrorVertical,
        swapRows12, swapRows23, swapRows34, movePreviewUnit, togglePreviewUnit,
        enableBulk, disableBulk, miniLeft, miniUp, miniDown, miniRight, miniToggle, miniApply
      ]) button.setEnabled(available);
    };

    const selectedGoal = () => plannerGoal.getSelection?.()?.[0]?.getModel?.() ?? 'cy';
    const showRecommendation = (recommendation, { resetHistory = true } = {}) => {
      const snapshot = this.hub.snapshot();
      displayedRecommendation = cloneRecommendation(recommendation);
      if (resetHistory) {
        previewOriginal = cloneRecommendation(recommendation);
        previewUndoStack = [];
        previewRedoStack = [];
      }
      applyRecommendation.setEnabled(Boolean(
        EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED
        && snapshot.attacker?.id
        && snapshot.target?.id
        && recommendation?.grid?.some((row) => row.some(Boolean))
      ));
      const codes = unitCodes(snapshot.units);
      formationVisual.model.setData(recommendation.grid.map((row, rowIndex) => [
        rowIndex + 1,
        ...row.map((unit) => unit
          ? `${codeForUnit(codes, snapshot.units, unit)} L${unit.level}`
          : '—')
      ]));
      formationLegend.setValue(
        `<b>Troop legend</b><br>${[...new Set([...codes.entries()]
          .map(([unit, code]) => `${escapeHtml(code)} = ${escapeHtml(unit.name)} (L${Number(unit.level) || 0})`)
        )].join('<br>') || 'No offensive troops loaded'}`
      );
      const selectedEntity = previewUnit.getSelection?.()?.[0]?.getModel?.();
      previewUnit.removeAll();
      simPreviewUnit.removeAll();
      for (const unit of recommendation.grid.flat().filter(Boolean)) {
        const text = `${codeForUnit(codes, snapshot.units, unit)} — ${unit.name} L${unit.level}${unit.enabled === false ? ' (hidden)' : ''}`;
        const model = unit.entityId ?? unit.id;
        const item = new qx.ui.form.ListItem(text, null, model);
        const miniItem = new qx.ui.form.ListItem(text, null, model);
        previewUnit.add(item);
        simPreviewUnit.add(miniItem);
        if (String(item.getModel()) === String(selectedEntity)) {
          previewUnit.setSelection([item]);
          simPreviewUnit.setSelection([miniItem]);
        }
      }
      plannerStatus.setValue(
        `Goal: ${recommendation.objective?.name ?? 'best available target'}; `
        + `focus column ${recommendation.objectiveColumn + 1}; formation score `
        + `${Math.round(recommendation.score)} (lower is safer). Visual recommendation only.`
      );
      updatePreviewControls();
    };
    const renderRecommendation = () => {
      showRecommendation(WarRoomCalculator.recommendFormation(this.hub.snapshot(), selectedGoal()));
    };

    const syncLiveFormationPreview = (snapshot = this.hub.snapshot()) => {
      const recommendation = WarRoomCalculator.recommendFormation(snapshot, selectedGoal());
      const grid = Array.from({ length: 4 }, () => Array(9).fill(null));
      for (const unit of snapshot.units ?? []) {
        const x = Number(unit.x);
        const y = Number(unit.y);
        if (Number.isInteger(x) && Number.isInteger(y) && grid[y]?.[x] !== undefined) {
          grid[y][x] = { ...unit };
        }
      }
      showRecommendation({ ...recommendation, grid }, { resetHistory: true });
      plannerStatus.setValue(
        `Live formation synchronized from the game: ${snapshot.units.length} troop(s). `
        + 'Use the controls below to edit this reversible preview, or Simulate Best Formation to generate recommendations.'
      );
      observedFormation = formationSignature(snapshot);
    };

    const transformPreview = (transform, message) => {
      if (!displayedRecommendation) return;
      previewUndoStack.push(cloneRecommendation(displayedRecommendation));
      previewUndoStack = previewUndoStack.slice(-30);
      previewRedoStack = [];
      const next = cloneRecommendation(displayedRecommendation);
      next.grid = transform(next.grid.map((row) => [...row]));
      showRecommendation(next, { resetHistory: false });
      plannerStatus.setValue(`${message}. Preview only; Apply remains the explicit commit step.`);
    };

    const shiftGrid = (dx, dy) => (grid) => {
      const height = grid.length;
      const width = grid[0]?.length ?? 0;
      const next = Array.from({ length: height }, () => Array(width).fill(null));
      grid.forEach((row, y) => row.forEach((unit, x) => {
        if (!unit) return;
        const nx = (x + dx + width) % width;
        const ny = (y + dy + height) % height;
        next[ny][nx] = { ...unit, x: nx, y: ny };
      }));
      return next;
    };

    const mirrorGrid = (horizontal) => (grid) => {
      const height = grid.length;
      const width = grid[0]?.length ?? 0;
      const next = Array.from({ length: height }, () => Array(width).fill(null));
      grid.forEach((row, y) => row.forEach((unit, x) => {
        if (!unit) return;
        const nx = horizontal ? width - 1 - x : x;
        const ny = horizontal ? y : height - 1 - y;
        next[ny][nx] = { ...unit, x: nx, y: ny };
      }));
      return next;
    };

    const swapRows = (first, second) => (grid) => {
      [grid[first], grid[second]] = [grid[second], grid[first]];
      grid.forEach((row, y) => row.forEach((unit) => { if (unit) unit.y = y; }));
      return grid;
    };
    const selectedPreviewUnitId = (selector = previewUnit) => selector.getSelection?.()?.[0]?.getModel?.();
    const editUnit = (editor, message, selector = previewUnit) => transformPreview((grid) => {
      const unit = grid.flat().find((item) => item && String(item.entityId ?? item.id) === String(selectedPreviewUnitId(selector)));
      if (unit) editor(grid, unit);
      return grid;
    }, message);
    const moveMiniUnit = (dx, dy) => editUnit((grid, unit) => {
      const height = grid.length;
      const width = grid[0]?.length ?? 0;
      const oldX = Number(unit.x), oldY = Number(unit.y);
      const x = Math.max(0, Math.min(width - 1, oldX + dx));
      const y = Math.max(0, Math.min(height - 1, oldY + dy));
      if (x === oldX && y === oldY) return;
      const occupied = grid[y][x];
      grid[oldY][oldX] = occupied ? { ...occupied, x: oldX, y: oldY } : null;
      grid[y][x] = { ...unit, x, y };
    }, 'Moved selected troop in preview', simPreviewUnit);
    const setBulkEnabled = (enabled) => transformPreview((grid) => {
      const scope = bulkScope.getSelection?.()?.[0]?.getModel?.() ?? 'all';
      for (const unit of grid.flat().filter(Boolean)) {
        const profile = WarRoomCalculator.combatProfile(unit);
        const matches = scope === 'all' || (scope === 'row' && Number(unit.y) === bulkRow.getValue() - 1)
          || profile.domain === scope;
        if (matches) unit.enabled = enabled;
      }
      return grid;
    }, `${enabled ? 'Enabled' : 'Disabled'} selected units`);

    const confirmExperimentalMove = () => new Promise((resolve) => {
      const win = new qx.ui.window.Window('Confirm Formation Change').set({
        modal: true,
        showMinimize: false,
        showMaximize: false,
        showClose: false,
        resizable: false,
        width: 500,
        layout: new qx.ui.layout.VBox(10),
        padding: 12,
        decorator: new qx.ui.decoration.Decorator(3, 'solid', '#ff3b30')
      });
      win.add(label(qx, 'Arrange the active offensive formation?', {
        font: 'bold',
        textColor: '#ff4d45'
      }));
      win.add(label(qx,
        'The Suite will move and hide/show multiple offensive units to match the selected preview. No attack will be launched. Confirm only after reviewing the cached result.'
      ));
      const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
      actions.add(new qx.ui.core.Spacer(), { flex: 1 });
      for (const [buttonLabel, answer] of [
        ['Cancel', false],
        ['Arrange Troops', true]
      ]) {
        const button = new qx.ui.form.Button(buttonLabel);
        button.addListener('execute', () => {
          resolve(answer);
          win.close();
          win.destroy();
        });
        actions.add(button);
      }
      win.add(actions);
      qx.core.Init.getApplication().getRoot().add(win);
      win.center();
      win.open();
    });

    const gameIcon = (path, fallback) => {
      try {
        const uri = qx.util.ResourceManager.getInstance().toUri(path);
        return `<img src="${escapeHtml(uri)}" alt="${escapeHtml(fallback)}" title="${escapeHtml(fallback)}" style="width:16px;height:16px;vertical-align:middle;margin-right:4px">`;
      } catch { return escapeHtml(fallback); }
    };
    const icons = {
      cy: gameIcon('FactionUI/icons/icon_building_detail_upgrade.png', 'Construction Yard'),
      df: gameIcon('FactionUI/icons/icon_building_detail_upgrade.png', 'Defense Facility'),
      dhq: gameIcon('FactionUI/icons/icon_building_detail_upgrade.png', 'Defense HQ'),
      tiberium: gameIcon('webfrontend/ui/common/icn_res_tiberium.png', 'Tiberium'),
      crystal: gameIcon('webfrontend/ui/common/icn_res_chrystal.png', 'Crystal'),
      credits: gameIcon('webfrontend/ui/common/icn_res_dollar.png', 'Credits'),
      research: gameIcon('webfrontend/ui/common/icn_res_research_mission.png', 'Research Points'),
      repair: gameIcon('webfrontend/ui/icons/icn_repair_off_points.png', 'Repair time'),
      infantry: gameIcon('webfrontend/ui/icons/icon_res_repair_inf.png', 'Infantry'),
      vehicle: gameIcon('webfrontend/ui/icons/icon_res_repair_tnk.png', 'Vehicle'),
      aircraft: gameIcon('webfrontend/ui/icons/icon_res_repair_air.png', 'Aircraft')
    };
    const simulationDetailsHtml = (analysis) => {
      const remaining = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;
      const defender = analysis?.defenderBreakdown ?? {};
      const offense = analysis?.offenseBreakdown ?? {};
      const repairGroups = analysis?.repairTimeByGroup ?? {};
      const repairCosts = analysis?.repairCostsByGroup ?? {};
      const loot = analysis?.lootResources ?? {};
      const snapshot = this.hub.snapshot();
      const crystalType = snapshot.resourceTypes?.Crystal;
      const crystal = (group) => Math.round(Number(repairCosts[group]?.[crystalType] ?? 0)).toLocaleString();
      const attackEstimate = snapshot.attackEstimate ?? {};
      const fullyRepairable = Number(attackEstimate.fullyRepairableAttacks ?? Infinity);
      const repairAttackText = Number.isFinite(fullyRepairable)
        ? `${fullyRepairable} with full repairs (+1 not fully repairable)` : 'Not repair-time limited';
      const repairCell = (group, icon) => `<td style="width:33%;text-align:center;vertical-align:top;padding:3px">`
        + `<b>${icon}</b><br>`
        + `${icons.crystal}${crystal(group)}<br>`
        + `${icons.repair}${escapeHtml(duration(repairGroups[group]))}<br>`
        + `${remaining(offense[group]?.remainingPercent)} remaining</td>`;
      return `<b>Duration:</b> ${escapeHtml(duration(analysis?.durationSeconds))}<br>`
        + `<b>Outcome:</b> <span style="color:${/Victory/i.test(analysis?.outcome ?? '') ? '#19733a' : '#b32323'}"><b>${escapeHtml(analysis?.outcome ?? 'Unknown')}</b></span><br><br>`
        + '<span style="color:#45565e"><b>Defender</b></span><br>'
        + `<b>Target State:</b> ${remaining(analysis?.defenderRemaining)}<br>`
        + `&nbsp;&nbsp;Base State: ${remaining(defender.structures?.remainingPercent)}<br>`
        + `&nbsp;&nbsp;Defense State: ${remaining(defender.defense?.remainingPercent)}<br>`
        + `${icons.cy}${remaining(analysis?.cyRemaining)}<br>`
        + `${icons.df}${remaining(analysis?.dfRemaining)}<br>`
        + `${icons.dhq}${remaining(analysis?.defenseHqRemaining)}<br>`
        + `Structures: ${remaining(defender.structures?.remainingPercent)}<br>`
        + `Defensive Units: ${remaining(defender.defense?.remainingPercent)}<br><br>`
        + '<span style="color:#45565e"><b>Loot</b></span><br>'
        + `${icons.research}${Math.round(loot.research ?? 0).toLocaleString()}<br>`
        + `${icons.crystal}${Math.round(loot.crystal ?? 0).toLocaleString()}<br>`
        + `${icons.tiberium}${Math.round(loot.tiberium ?? 0).toLocaleString()}<br>`
        + `${icons.credits}${Math.round(loot.credits ?? 0).toLocaleString()}<br>`
        + `<b>Total: ${Math.round(analysis?.loot ?? 0).toLocaleString()}</b><br><br>`
        + '<span style="color:#45565e"><b>Own Repair</b></span>'
        + `<table style="width:100%;table-layout:fixed"><tr>${repairCell('aircraft', icons.aircraft)}${repairCell('vehicle', icons.vehicle)}${repairCell('infantry', icons.infantry)}</tr></table>`
        + `${icons.crystal}<b>Total:</b> ${Math.round(analysis?.repairCostResources?.crystal ?? 0).toLocaleString()}<br>`
        + `${icons.repair}<b>Total:</b> ${escapeHtml(duration(analysis?.repairSeconds))}<br><br>`
        + '<span style="color:#45565e"><b>Possible Attacks</b></span><br>'
        + `CP: ${Math.round(Number(attackEstimate.commandPointAttacks ?? 0))}<br>`
        + `RT: ${escapeHtml(repairAttackText)}`;
    };

    const showSimulationResult = (analysis, {
      title = 'Best Formation Result',
      name = analysis?.label ?? 'Simulation',
      oneShot = false,
      note = 'Native battle simulation. Troops were not moved.'
    } = {}) => {
      setPlannerResult(
        `<b>${escapeHtml(title)}</b><br>`
        + `<span style="color:#005f86"><b>${escapeHtml(name)}</b></span>`
        + (oneShot ? ' · <span style="color:#167a2f"><b>One-shot kill found</b></span>' : '')
        + '<br><br>'
        + simulationDetailsHtml(analysis) + '<br><br>'
        + `<span style="color:#52636b">${escapeHtml(note)}</span>`
      );
    };

    const candidateTestingHtml = (candidate) => {
      const name = String(candidate?.name ?? 'Unknown candidate');
      const move = name.match(/^Move\s+(.+)\s+to\s+(\d+):(\d+)$/i);
      if (move) {
        return '<b>Testing</b><br>'
          + `<span style="color:#005f86"><b>Action:</b> Move troop</span><br>`
          + `<b>Troop:</b> ${escapeHtml(move[1])}<br>`
          + `<b>Destination:</b> Column ${escapeHtml(move[2])}, Row ${escapeHtml(move[3])}`;
      }
      const swap = name.match(/^Swap\s+(.+)\s+\/\s+(.+)$/i);
      if (swap) {
        return '<b>Testing</b><br>'
          + '<span style="color:#005f86"><b>Action:</b> Swap troops</span><br>'
          + `<b>Troop 1:</b> ${escapeHtml(swap[1])}<br>`
          + `<b>Troop 2:</b> ${escapeHtml(swap[2])}`;
      }
      return `<b>Testing</b><br><span style="color:#005f86">${escapeHtml(name)}</span>`;
    };

    const simulateRecommendation = async () => {
      const runId = ++recommendationSequence;
      optimizationRunning = true;
      safeSetEnabled(recommend, true);
      recommend.setLabel?.('Stop Simulation');
      try {
        const snapshot = this.hub.snapshot();
        const goal = selectedGoal();
        const detail = searchDetail.getSelection?.()?.[0]?.getModel?.() ?? 'detailed';
        const candidates = WarRoomCalculator.candidateFormations(snapshot, goal, detail);
        setPlannerResult(
          '<b>Best Formation Result</b><br>'
          + `<span style="color:#005f86">Comparing ${candidates.length} candidate formations…</span>`
        );
        let best = null;
        for (let index = 0; index < candidates.length; index += 1) {
          const candidate = candidates[index];
          if (buildDisposed || runId !== recommendationSequence) return;
          setPlannerResult(
            '<b>Best Formation Result</b><br>'
            + '<span style="color:#005f86"><b>Simulation in progress</b></span><br><br>'
            + `<b>Candidate:</b> ${index + 1} of ${candidates.length}<br>`
            + `${candidateTestingHtml(candidate)}<br>`
            + (best
              ? '<br><br><span style="color:#52636b">'
                + `<b>Best so far:</b><br>${escapeHtml(best.candidate.name)}<br>`
                + `Objective remaining: ${best.result.objectivePercent.toFixed(1)}%`
                + '</span>'
              : '')
          );
          safeSetValue(plannerStatus, `Simulation in progress (${index + 1}/${candidates.length})…`);
          const cacheKey = simulationKey(snapshot, candidate.units);
          const response = simulationCache.get(cacheKey)?.response
            ?? await this.hub.simulateFormation(candidate.units);
          if (buildDisposed || runId !== recommendationSequence) return;
          simulationCache.set(cacheKey, {
            response, snapshot, at: Date.now(), name: candidate.name,
            units: candidate.units.map((unit) => ({ ...unit }))
          });
          renderSimulations();
          const result = WarRoomCalculator.scoreSimulation(response, snapshot, goal);
          if (!best || result.score < best.result.score) best = { candidate, result, response, snapshot };
          if (result.oneShot) break;
          if (index < candidates.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3100));
            if (buildDisposed || runId !== recommendationSequence) return;
          }
        }
        if (!best) throw new Error('No formation could be simulated.');
        const grid = Array.from({ length: 4 }, () => Array(9).fill(null));
        for (const unit of best.candidate.units) grid[unit.y][unit.x] = unit;
        showRecommendation({
          goal,
          objective: WarRoomCalculator.objective(snapshot, goal),
          objectiveColumn: WarRoomCalculator.objective(snapshot, goal)?.x ?? 4,
          score: best.result.score,
          grid
        });
        const analysis = WarRoomCalculator.analyzeNativeSimulation(
          best.response, best.snapshot, best.candidate.name
        );
        if (analysis.calculationDiagnostics?.source !== 'native-combat-report') {
          this.context.logger?.warn?.('War Room simulation used compatibility interpretation; native combat report was not published.', {
            source: analysis.calculationDiagnostics?.source,
            resourceTypes: best.snapshot.resourceTypes,
            nativeEntityLoot: best.response?.nativeEntityLoot,
            entityDetails: best.response?.nativeEntityDetails,
            simulationData: best.response?.d,
            simulationEvents: best.response?.e
          });
        }
        showSimulationResult(analysis, {
          name: best.candidate.name,
          oneShot: best.result.oneShot,
          note: 'Ranked by native battle simulation. Troops were not moved.'
        });
        safeSetValue(plannerStatus, `Best formation found: ${best.candidate.name}.`);
      } catch (error) {
        safeSetValue(plannerStatus, `Formation simulation failed: ${error?.message ?? error}`);
        setPlannerResult(
          '<b>Best Formation Result</b><br>'
          + `<span style="color:#a32626">Simulation failed: ${escapeHtml(error?.message ?? error)}</span>`
        );
        this.context.logger?.warn?.('War Room formation simulation failed.', error);
      } finally {
        if (runId === recommendationSequence) {
          optimizationRunning = false;
          safeSetEnabled(recommend, true);
          recommend.setLabel?.('Simulate Best Formation');
          if (!buildDisposed && liveSimulationQueued) queueLiveSimulation();
        }
      }
    };

    const cancelRecommendation = () => {
      if (!optimizationRunning) return false;
      recommendationSequence += 1;
      optimizationRunning = false;
      liveSimulationQueued = false;
      safeSetEnabled(recommend, true);
      recommend.setLabel?.('Simulate Best Formation');
      safeSetValue(plannerStatus, 'Best-formation simulation stopped.');
      setPlannerResult(
        '<b>Best Formation Result</b><br>'
        + '<span style="color:#8b4f00"><b>Simulation stopped by user.</b></span><br><br>'
        + '<span style="color:#52636b">Completed cached results remain available in Battle Simulator.</span>'
      );
      return true;
    };

    const loadCachedPreview = (entry) => {
      const result = entry?.analysis ?? WarRoomCalculator.analyzeNativeSimulation(
        entry?.response, entry?.snapshot, entry?.name ?? 'Cached'
      );
      if (!Array.isArray(entry?.units) || !entry.units.length) {
        simulatorText.setValue(`${result.label} does not contain a cached formation layout.`);
        return;
      }
      const grid = Array.from({ length: 4 }, () => Array(9).fill(null));
      for (const unit of entry.units) {
        const x = Number(unit.x), y = Number(unit.y);
        if (grid[y]?.[x] !== undefined) grid[y][x] = { ...unit };
      }
      const goal = selectedGoal();
      const objective = WarRoomCalculator.objective(this.hub.snapshot(), goal);
      showRecommendation({
        goal,
        objective,
        objectiveColumn: objective?.x ?? 4,
        score: WarRoomCalculator.scoreSimulation(entry.response, entry.snapshot, goal).score,
        grid
      });
      simulatorText.setValue(`${result.label} loaded into the formation preview. Use Preview to apply it to the active attack setup.`);
    };

    simulator.grid.widget.addListener('cellTap', (event) => {
      const row = Number(event.getRow?.() ?? event.getData?.()?.row ?? -1);
      const entry = this.displayedSimulationEntries?.[row];
      if (entry) loadCachedPreview(entry);
    });

    const renderSimulations = () => {
      if (!widgetAlive(simulator.grid.widget) || !widgetAlive(cachedResults)) return;
      const snapshot = this.hub.snapshot();
      const alternatives = [...simulationCache.values()].filter((entry) =>
        String(entry.snapshot?.target?.id) === String(snapshot.target?.id)
        && String(entry.snapshot?.target?.version ?? 0) === String(snapshot.target?.version ?? 0)
      ).map((entry) => ({ ...entry, analysis: WarRoomCalculator.analyzeNativeSimulation(entry.response, entry.snapshot, entry.name ?? 'Cached') }));
      const rankedAlternatives = [...alternatives].sort((left, right) =>
        left.analysis.defenderRemaining - right.analysis.defenderRemaining
        || left.analysis.repairSeconds - right.analysis.repairSeconds
      );
      const bestAlternative = rankedAlternatives[0];
      this.displayedSimulationEntries = rankedAlternatives;
      const rows = rankedAlternatives.map((entry) => [
        entry.analysis.label,
        entry.analysis.cyRemaining == null ? '—' : `${entry.analysis.cyRemaining.toFixed(1)}%`,
        entry.analysis.dfRemaining == null ? '—' : `${entry.analysis.dfRemaining.toFixed(1)}%`,
        `${entry.analysis.defenderRemaining.toFixed(1)}%`,
        `${entry.analysis.ownRemaining.toFixed(1)}%`,
        duration(entry.analysis.repairSeconds),
        Math.round(entry.analysis.repairCostResources.tiberium),
        Math.round(entry.analysis.repairCostResources.crystal),
        Math.round(entry.analysis.loot),
        Math.round(entry.analysis.research),
        duration(entry.analysis.durationSeconds),
        entry.analysis.outcome,
        entry.analysis.morale,
        entry.analysis.autoRepair ? 'Yes' : 'No',
        entry.source === 'live-formation' ? 'Native live formation' : 'Cached candidate'
      ]);
      simulator.grid.model.setData(rows);
      cachedResults.removeAll();
      if (!rankedAlternatives.length) {
        cachedResults.add(label(qx, 'No cached results for this target yet.', { textColor: '#344448' }));
      }
      for (const [rankIndex, entry] of rankedAlternatives.entries()) {
        const result = entry.analysis;
        const card = new qx.ui.container.Composite(new qx.ui.layout.VBox(3)).set({
          width: 158, minWidth: 158, maxWidth: 158, padding: 6,
          cursor: 'pointer', toolTipText: 'Load this cached formation into the reversible preview',
          backgroundColor: rankIndex === 0 ? '#d9ece1' : '#e3e8ea',
          decorator: new qx.ui.decoration.Decorator(1, 'solid', rankIndex === 0 ? '#3d8b5a' : '#8a969a')
        });
        const cardText = (text, color = '#344448', bold = false) => new qx.ui.basic.Label(text).set({
          textColor: color, font: bold ? 'bold' : 'default', wrap: false
        });
        card.add(cardText(`${rankIndex + 1}. ${result.label}`, '#233239', true));
        card.add(new qx.ui.basic.Label(simulationDetailsHtml(result)).set({
          rich: true, wrap: true, textColor: '#344448'
        }));
        const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(3));
        const replay = new qx.ui.form.Button('▶ Sim').set({ toolTipText: 'Play this cached simulation in the game window' });
        const use = new qx.ui.form.Button('Use').set({
          enabled: EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED && Array.isArray(entry.units) && entry.units.length > 0,
          toolTipText: 'Arrange the active attack formation to match this result'
        });
        replay.addListener('execute', () => {
          try { this.hub.playSimulation(entry.response); }
          catch (error) { simulatorText.setValue(`Unable to replay ${result.label}: ${error?.message ?? error}`); }
        });
        card.addListener('tap', () => loadCachedPreview(entry));
        use.addListener('execute', () => {
          void (async () => {
            try {
              if (!(await confirmExperimentalMove())) return;
              this.hub.applyRecommendedFormation(entry.units);
              simulatorText.setValue(`${result.label} formation applied to the active attack setup.`);
              observedFormation = formationSignature(this.hub.snapshot());
              queueLiveSimulation();
            } catch (error) {
              simulatorText.setValue(`Unable to use ${result.label}: ${error?.message ?? error}`);
            }
          })();
        });
        actions.add(replay); actions.add(use); card.add(actions);
        cachedResults.add(card);
      }
      simulatorText.setValue(this.nativeSimulation
        ? `Live result for the current formation. Structures ${this.nativeSimulation.defenderBreakdown.structures.remainingPercent.toFixed(1)}% · `
          + `Defense ${this.nativeSimulation.defenderBreakdown.defense.remainingPercent.toFixed(1)}% · `
          + `Armored ${this.nativeSimulation.defenderBreakdown.armored.remainingPercent.toFixed(1)}% · `
          + `Unarmored ${this.nativeSimulation.defenderBreakdown.unarmored.remainingPercent.toFixed(1)}% · `
          + `Infantry ${this.nativeSimulation.offenseBreakdown.infantry.remainingPercent.toFixed(1)}% · `
          + `Vehicles ${this.nativeSimulation.offenseBreakdown.vehicle.remainingPercent.toFixed(1)}% · `
          + `Aircraft ${this.nativeSimulation.offenseBreakdown.aircraft.remainingPercent.toFixed(1)}%. `
          + `Loot: T ${Math.round(this.nativeSimulation.lootResources.tiberium)} · C ${Math.round(this.nativeSimulation.lootResources.crystal)} · Credits ${Math.round(this.nativeSimulation.lootResources.credits)} · RP ${Math.round(this.nativeSimulation.lootResources.research)}. `
          + `Repair charge: Inf ${Math.round(this.nativeSimulation.repairStorage.infantry?.stored ?? 0)}/${Math.round(this.nativeSimulation.repairStorage.infantry?.capacity ?? 0)} · Veh ${Math.round(this.nativeSimulation.repairStorage.vehicle?.stored ?? 0)}/${Math.round(this.nativeSimulation.repairStorage.vehicle?.capacity ?? 0)} · Air ${Math.round(this.nativeSimulation.repairStorage.aircraft?.stored ?? 0)}/${Math.round(this.nativeSimulation.repairStorage.aircraft?.capacity ?? 0)}. `
          + `${alternatives.length} cached formation(s); best cached defender health ${bestAlternative?.analysis.defenderRemaining.toFixed(1) ?? '—'}%. `
          + 'Moving a troop queues a fresh native simulation.'
        : `Waiting to simulate ${snapshot.units.length} offensive units against the selected target.`);
    };

    const populateTargetIntel = async (target) => {
      if (!target?.id) return;
      try {
        targetStatus.setValue(`Loading intelligence for ${target.type} at ${target.x}:${target.y}…`);
        const intel = await this.hub.getTargetInformation(target);
        // Search selection is authoritative for this information request. The
        // combat snapshot may still reference a previously opened attack until
        // the user explicitly chooses Open Attack.
        if (selectedSearchTarget && String(selectedSearchTarget.id) !== String(target.id)) return;
        this.intelTargetId = intel.id;
        const levels = Object.entries(intel.forgottenLevels)
          .sort(([left], [right]) => Number(right) - Number(left))
          .map(([level, count]) => `${count} × ${level}`)
          .join(', ') || 'None';
        const lootRows = intel.loot.length
          ? intel.loot.map((resource) => [`Projected loot: ${resource.name}`, resource.amount])
          : [['Projected loot', 'Unavailable until combat data loads']];
        const compositionRows = Object.entries(intel.composition ?? {}).flatMap(([category, summary]) => {
          const detail = (summary.composition ?? []).map((item) => `${item.count} × ${item.name}`).join(', ') || 'None';
          return [[
            `${category[0].toUpperCase()}${category.slice(1)}`,
            `${summary.count} · avg lvl ${Number(summary.averageLevel || 0).toFixed(1)} · ${summary.damaged} damaged · ${detail}`
          ]];
        });
        targetIntel.model.setData([
          ['Target', `${intel.name} · ${intel.type} Lvl ${intel.level ?? target.level ?? '—'}`],
          ['Coordinates', `${intel.x}:${intel.y}`],
          ['Owner', intel.owner],
          ['Alliance', intel.alliance || ''],
          ['Attack cost', `${intel.cp} CP`],
          ['Attack from', intel.attacker],
          ['Attack possible', intel.attackPossible ? 'Yes' : 'No'],
          ['Estimated attacks', `${intel.attackEstimate?.possibleAttacks ?? 0} possible (${intel.attackEstimate?.commandPointAttacks ?? 0} by CP; ${Number.isFinite(intel.attackEstimate?.fullyRepairableAttacks) ? `${intel.attackEstimate.fullyRepairableAttacks} fully repairable + 1 final hit` : 'repair time not limiting'})`],
          ['Available command points', Math.round(intel.attackEstimate?.cpAvailable ?? 0)],
          ['Available repair time', duration(intel.attackEstimate?.repairAvailableSeconds ?? 0)],
          ['Conservative repair per attack', duration(intel.attackEstimate?.maxRepairSeconds ?? 0)],
          ['Base condition', `${Math.round(intel.baseCondition)}%`],
          ['Defense condition', `${Math.round(intel.defenseCondition)}%`],
          ['Repair time', `Inf ${Math.round(intel.repair?.infantry ?? 0)}s · Veh ${Math.round(intel.repair?.vehicle ?? 0)}s · Air ${Math.round(intel.repair?.aircraft ?? 0)}s`],
          ['Surrounding bases', intel.surroundingBases],
          ['Support', intel.support
            ? `${intel.support.name} lvl ${intel.support.level} (${intel.support.condition}%)`
            : 'None'],
          ['Forgotten bases in range', `${intel.forgottenInRange} (${intel.waves} waves)`],
          ['Forgotten levels', levels],
          ...compositionRows,
          ...lootRows
        ]);
        targetStatus.setValue(
          `${intel.name} selected. All War Room tabs now use this target.`
        );
        render();
        syncLiveFormationPreview(this.currentSnapshot ?? this.hub.snapshot());
        renderSimulations();
      } catch (error) {
        targetStatus.setValue(`Unable to load target: ${error?.message ?? error}`);
      }
    };

    let nativeReportLoad = null;
    const loadNativeReports = (force = false) => {
      if (nativeReportLoad) return nativeReportLoad;
      const category = reportCategory.getSelection?.()?.[0]?.getModel?.() ?? 'offense';
      if (!force && this.hub.reportCaches.has(category)) return Promise.resolve(this.hub.getCombatReports(category));
      reportDetail.setValue('Loading native combat reports…');
      nativeReportStatus = 'Loading native combat reports…';
      nativeReportLoad = this.hub.refreshCombatReports(100, category).then((loaded) => {
        const categoryName = reportCategory.getSelection?.()?.[0]?.getLabel?.() ?? 'selected category';
        nativeReportStatus = loaded.length
          ? `${loaded.length} native ${categoryName} report(s) loaded. Select a row for details; double-click to open its native report/replay.`
          : `No native ${categoryName} reports were returned for this account.`;
        reportDetail.setValue(nativeReportStatus);
        render();
        return loaded;
      }).catch((error) => {
        nativeReportStatus = `Unable to load native reports: ${error?.message ?? error}`;
        reportDetail.setValue(nativeReportStatus);
        this.context.logger?.warn?.('War Room native report loading failed.', error);
        return [];
      }).finally(() => { nativeReportLoad = null; });
      return nativeReportLoad;
    };

    const loadCombatStatistics = () => this.hub.refreshAllCombatReports(100).then(() => {
      const allReports = this.hub.getAllCombatReports();
      render();
      return allReports;
    }).catch((error) => {
      statsStatus.setValue(`Unable to load complete combat statistics: ${error?.message ?? error}`);
      return [];
    });

    const syncFromGameTarget = () => {
      render();
      syncLiveFormationPreview(this.currentSnapshot ?? this.hub.snapshot());
      renderSimulations();
      if (
        this.currentSnapshot?.target?.id
        && String(this.currentSnapshot.target.id) !== String(this.intelTargetId ?? '')
      ) {
        void populateTargetIntel({
          id: this.currentSnapshot.target.id,
          type: this.currentSnapshot.target.npc ? 'Base' : 'Player Base',
          level: this.currentSnapshot.target.level,
          x: this.currentSnapshot.target.x,
          y: this.currentSnapshot.target.y,
          cp: this.currentSnapshot.cpCost
        });
      }
    };

    const formationSignature = (snapshot) => snapshot.units
      .map((unit) => `${unit.entityId ?? unit.id}:${unit.x}:${unit.y}:${unit.enabled !== false ? 1 : 0}`)
      .sort()
      .join('|');
    const simulationKey = (snapshot, units = snapshot.units) => [
      snapshot.target?.id, snapshot.target?.version ?? 0, snapshot.attacker?.id,
      units.map((unit) => `${unit.entityId ?? unit.id}:${unit.x}:${unit.y}:${unit.enabled !== false ? 1 : 0}`).sort().join('|'),
      (snapshot.allianceBonuses ?? []).join(',')
    ].join('::');

    const runLiveSimulation = async () => {
      if (buildDisposed || !windowVisible()) return;
      if (liveSimulationRunning || optimizationRunning) {
        liveSimulationQueued = true;
        return;
      }
      const snapshot = this.hub.snapshot();
      if (!snapshot.target?.id || !snapshot.units.length) return;
      liveSimulationRunning = true;
      safeSetValue(simulatorText, 'Running native simulation for the current formation…');
      try {
        const cacheKey = simulationKey(snapshot);
        const cached = simulationCache.get(cacheKey);
        const response = cached?.response ?? await this.hub.simulateFormation(snapshot.units);
        if (!cached) liveFormationSequence += 1;
        const entry = cached ?? {
          response,
          snapshot,
          at: Date.now(),
          name: liveFormationSequence === 1 ? 'Live formation' : `Manual layout ${liveFormationSequence - 1}`,
          source: 'live-formation',
          units: snapshot.units.map((unit) => ({ ...unit }))
        };
        simulationCache.set(cacheKey, entry);
        for (const [key, entry] of simulationCache) {
          if (String(entry.snapshot?.target?.id) === String(snapshot.target.id)
            && String(entry.snapshot?.target?.version ?? 0) !== String(snapshot.target?.version ?? 0)) simulationCache.delete(key);
        }
        // Publish the completed native result as soon as it is cached. The
        // active formation may already be moving again, but this result still
        // belongs to the exact coordinate/enabled-state signature captured
        // above and remains useful as a replayable comparison.
        renderSimulations();
        const current = this.hub.snapshot();
        if (
          String(current.target?.id) === String(snapshot.target.id)
          && formationSignature(current) === formationSignature(snapshot)
        ) {
          this.nativeSimulation = WarRoomCalculator.analyzeNativeSimulation(response, snapshot, entry.name);
          this.nativeSimulationReplay = {
            response,
            targetId: String(snapshot.target.id),
            formation: formationSignature(snapshot)
          };
          this.stats.record(snapshot, this.nativeSimulation, formationSignature(snapshot));
          renderSimulations();
          stats.grid.model.setData(this.stats.rows());
          if (playSimulationQueued) {
            playSimulationQueued = false;
            this.hub.playSimulation(response);
          }
          if (simulatorSettings.skipVictory) {
            const registry = qx.core?.ObjectRegistry?.getRegistry?.() ?? {};
            for (const widget of Object.values(registry)) {
              const name = String(widget?.classname ?? widget?.constructor?.classname ?? '');
              if (/Victory.*(Window|Overlay)|Combat.*Victory/i.test(name) && widget?.isVisible?.()) widget.close?.();
            }
          }
        } else {
          liveSimulationQueued = true;
        }
      } catch (error) {
        safeSetValue(simulatorText, `Live simulation failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room live simulation failed.', error);
      } finally {
        liveSimulationRunning = false;
        if (!buildDisposed && windowVisible() && liveSimulationQueued) {
          liveSimulationQueued = false;
          liveTimer = setTimeout(() => { void runLiveSimulation(); }, 3100);
        }
      }
    };

    const queueLiveSimulation = () => {
      if (buildDisposed || !windowVisible()) return;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => { void runLiveSimulation(); }, 400);
    };

    root.addListenerOnce?.('dispose', () => {
      buildDisposed = true;
      recommendationSequence += 1;
      liveSimulationQueued = false;
      clearTimeout(liveTimer);
      unsubscribePresetChanges?.();
      unsubscribePresetChanges = null;
    });

    this.context.events?.on?.('game:tick', () => {
      // ObjectRegistry contains most of the live Qooxdoo UI. Walking it while
      // War Room is closed made the central 500 ms game-state callback scale
      // with the entire game interface and could block the UI for 50–100 ms.
      // These controls and live simulations are relevant only to a visible
      // War Room, so leave the dormant module at constant cost.
      if (!this.record?.window?.isVisible?.()) return;
      const registry = qx.core?.ObjectRegistry?.getRegistry?.() ?? {};
      for (const widget of Object.values(registry)) {
        const name = String(widget?.classname ?? widget?.constructor?.classname ?? '');
        const text = String(widget?.getLabel?.() ?? '');
        if (simulatorSettings.suppressTooltips && /ArmySetup|Formation|AttackPreparation/i.test(name)) widget.setToolTip?.(null);
        if (/ArmySetup|CombatSetup|AttackPreparation/i.test(name)) {
          if (/^attack$/i.test(text)) widget.setEnabled?.(!simulatorSettings.lockAttack);
          if (/^repair$/i.test(text)) widget.setEnabled?.(!simulatorSettings.lockRepair);
        }
      }
      const snapshot = this.hub.snapshot();
      const targetId = snapshot.target?.id == null ? null : String(snapshot.target.id);
      const formation = formationSignature(snapshot);
      if (targetId !== observedTargetId) {
        observedTargetId = targetId;
        observedFormation = formation;
        this.nativeSimulation = null;
        this.nativeSimulationReplay = null;
        playSimulationQueued = false;
        renderPresets();
        syncFromGameTarget();
        queueLiveSimulation();
        return;
      }
      if (formation !== observedFormation) {
        observedFormation = formation;
        render();
        syncLiveFormationPreview(this.currentSnapshot ?? snapshot);
        renderSimulations();
        queueLiveSimulation();
      }
    });

    this.refreshAll = () => {
      syncFromGameTarget();
      void loadFormationPresets(selectedPreset()?.id ?? null);
      void loadNativeReports(true);
    };
    const selectReportRow = (row, openNative = false) => {
      selectedReport = displayedReports[Number(row)];
      if (!selectedReport) return;
      const at = Number(selectedReport.at) < 1e12 ? Number(selectedReport.at) * 1000 : Number(selectedReport.at);
      const loot = Object.entries(selectedReport.loot ?? {})
        .map(([type, amount]) => `${escapeHtml(selectedReport.lootLabels?.[type] ?? `Resource ${type}`)}: ${Math.round(Number(amount || 0)).toLocaleString()}`)
        .join(' · ') || 'No loot recorded';
      reportDetail.setValue(
        `<div style="padding:7px;background:#c8d3d7;color:#17262d;border-top:3px solid #edf5f7;border-bottom:4px solid #667a83">`
        + `<b style="color:#075d7a">${escapeHtml(selectedReport.ownBase)} → ${escapeHtml(selectedReport.target)}</b><br>`
        + `${at ? escapeHtml(new Date(at).toLocaleString()) : 'Unknown time'} · ${escapeHtml(selectedReport.type)} · `
        + `<b>${selectedReport.won ? 'Victory' : 'Defeat'}</b>${selectedReport.destroyed ? ' · Target destroyed' : ''}<br>`
        + `Command points: ${selectedReport.cp} · Repair: ${duration(selectedReport.repairSeconds)}<br>${loot}</div>`
      );
      if (openNative) {
        void this.hub.openCombatReport(selectedReport).catch((error) => {
          reportDetail.setValue(`${reportDetail.getValue()}<br><span style="color:#b32323">${escapeHtml(error?.message ?? error)}</span>`);
        });
      }
    };
    reports.grid.widget.addListener('cellTap', (event) => selectReportRow(event.getRow?.(), Number(event.getColumn?.()) === 13));
    reports.grid.widget.addListener('cellDbltap', (event) => selectReportRow(event.getRow?.(), true));
    refresh.addListener('execute', () => {
      syncFromGameTarget();
      void loadNativeReports(true);
    });
    reportCategory.addListener('changeSelection', () => {
      selectedReport = null;
      this.hub.reportCache = null;
      void loadNativeReports(true);
    });
    armyBase.addListener('changeSelection', () => render());
    repairArmy.addListener('execute', () => {
      try {
        const baseId = armyBase.getSelection?.()?.[0]?.getModel?.();
        if (baseId == null) throw new Error('Choose an offense base first.');
        const result = this.hub.repairOffense(baseId);
        armySummary.setValue(result.repaired
          ? `${result.name} · all damaged offense troops were submitted for repair.`
          : `${result.name} · no offense repairs are currently needed.`);
        render();
        if (result.repaired) {
          setTimeout(() => { if (!buildDisposed) render(); }, 500);
          setTimeout(() => { if (!buildDisposed) render(); }, 1500);
        }
      } catch (error) {
        armySummary.setValue(`Offense repair failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room offense repair failed.', error);
      }
    });
    statsBase.addListener('changeSelection', () => {
      if (!this.updatingStatsBase) render();
    });
    recommend.addListener('execute', () => {
      if (optimizationRunning) cancelRecommendation();
      else void simulateRecommendation();
    });
    shiftLeft.addListener('execute', () => transformPreview(shiftGrid(-1, 0), 'Shifted formation left'));
    shiftRight.addListener('execute', () => transformPreview(shiftGrid(1, 0), 'Shifted formation right'));
    shiftUp.addListener('execute', () => transformPreview(shiftGrid(0, -1), 'Shifted formation up'));
    shiftDown.addListener('execute', () => transformPreview(shiftGrid(0, 1), 'Shifted formation down'));
    mirrorHorizontal.addListener('execute', () => transformPreview(mirrorGrid(true), 'Mirrored formation horizontally'));
    mirrorVertical.addListener('execute', () => transformPreview(mirrorGrid(false), 'Mirrored formation vertically'));
    swapRows12.addListener('execute', () => transformPreview(swapRows(0, 1), 'Swapped rows 1 and 2'));
    swapRows23.addListener('execute', () => transformPreview(swapRows(1, 2), 'Swapped rows 2 and 3'));
    swapRows34.addListener('execute', () => transformPreview(swapRows(2, 3), 'Swapped rows 3 and 4'));
    simulatePreview.addListener('execute', () => {
      void (async () => {
        simulatePreview.setEnabled(false);
        try {
          const snapshot = this.hub.snapshot();
          const units = displayedRecommendation?.grid?.flat().filter(Boolean) ?? [];
          if (!snapshot.target?.id || !units.length) {
            plannerStatus.setValue('Open a target attack screen and arrange a preview before simulating.');
            setPlannerResult(
              '<b>Preview Simulation</b><br>'
              + '<span style="color:#52636b">No attack screen is open. Select a target before simulating.</span>'
            );
            return;
          }
          plannerStatus.setValue('Simulating the manually arranged preview…');
          setPlannerResult(
            '<b>Preview Simulation Result</b><br>'
            + '<span style="color:#005f86"><b>Simulating the manually arranged preview…</b></span>'
          );
          const cacheKey = simulationKey(snapshot, units);
          const cached = simulationCache.get(cacheKey);
          const response = cached?.response ?? await this.hub.simulateFormation(units);
          simulationCache.set(cacheKey, {
            response,
            snapshot,
            at: Date.now(),
            name: 'Manual preview',
            units: units.map((unit) => ({ ...unit }))
          });
          const analysis = WarRoomCalculator.analyzeNativeSimulation(response, snapshot, 'Manual preview');
          renderSimulations();
          showSimulationResult(analysis, {
            title: 'Preview Simulation Result',
            name: 'Manual preview',
            note: 'This result uses the manually arranged preview. Open Battle Simulator for replay controls.'
          });
          plannerStatus.setValue('Manual preview simulation complete.');
        } catch (error) {
          plannerStatus.setValue(`Manual preview simulation failed: ${error?.message ?? error}`);
          setPlannerResult(
            '<b>Preview Simulation Result</b><br>'
            + `<span style="color:#a32626">Simulation failed: ${escapeHtml(error?.message ?? error)}</span>`
          );
          this.context.logger?.warn?.('War Room manual preview simulation failed.', error);
        } finally {
          simulatePreview.setEnabled(Boolean(displayedRecommendation));
        }
      })();
    });
    formationVisual.widget.addListener('cellTap', (event) => {
      const row = Number(event.getRow?.());
      const column = Number(event.getColumn?.()) - 1;
      if (!displayedRecommendation || row < 0 || row > 3 || column < 0 || column > 8) return;
      const unit = displayedRecommendation.grid?.[row]?.[column] ?? null;
      if (!selectedFormationCell) {
        if (!unit) {
          plannerStatus.setValue('Select a troop first, then select its destination square.');
          return;
        }
        selectedFormationCell = { row, column };
        plannerStatus.setValue(`${unit.name} L${unit.level} selected. Click any destination square to move or swap it.`);
        return;
      }
      const source = selectedFormationCell;
      selectedFormationCell = null;
      if (source.row === row && source.column === column) {
        plannerStatus.setValue('Troop move cancelled.');
        return;
      }
      transformPreview((grid) => {
        const moving = grid[source.row]?.[source.column];
        if (!moving) return grid;
        const occupant = grid[row][column];
        grid[source.row][source.column] = occupant
          ? { ...occupant, x: source.column, y: source.row }
          : null;
        grid[row][column] = { ...moving, x: column, y: row };
        return grid;
      }, `Moved ${displayedRecommendation.grid[source.row][source.column]?.name ?? 'troop'} to ${column + 1}:${row + 1}`);
    });
    movePreviewUnit.addListener('execute', () => editUnit((grid, unit) => {
      const oldX = Number(unit.x), oldY = Number(unit.y), x = previewColumn.getValue() - 1, y = previewRow.getValue() - 1;
      const occupied = grid[y][x];
      grid[oldY][oldX] = occupied ? { ...occupied, x: oldX, y: oldY } : null;
      grid[y][x] = { ...unit, x, y };
    }, 'Moved the selected unit in preview'));
    togglePreviewUnit.addListener('execute', () => editUnit((_grid, unit) => { unit.enabled = unit.enabled === false; }, 'Toggled the selected unit'));
    miniLeft.addListener('execute', () => moveMiniUnit(-1, 0));
    miniUp.addListener('execute', () => moveMiniUnit(0, -1));
    miniDown.addListener('execute', () => moveMiniUnit(0, 1));
    miniRight.addListener('execute', () => moveMiniUnit(1, 0));
    miniToggle.addListener('execute', () => editUnit(
      (_grid, unit) => { unit.enabled = unit.enabled === false; },
      'Toggled selected troop visibility in preview', simPreviewUnit
    ));
    miniApply.addListener('execute', () => applyRecommendation.execute?.());
    enableBulk.addListener('execute', () => setBulkEnabled(true));
    disableBulk.addListener('execute', () => setBulkEnabled(false));
    previewUndo.addListener('execute', () => {
      if (!previewUndoStack.length || !displayedRecommendation) return;
      previewRedoStack.push(cloneRecommendation(displayedRecommendation));
      showRecommendation(previewUndoStack.pop(), { resetHistory: false });
      plannerStatus.setValue('Undid the last preview edit.');
    });
    previewRedo.addListener('execute', () => {
      if (!previewRedoStack.length || !displayedRecommendation) return;
      previewUndoStack.push(cloneRecommendation(displayedRecommendation));
      showRecommendation(previewRedoStack.pop(), { resetHistory: false });
      plannerStatus.setValue('Redid the preview edit.');
    });
    previewReset.addListener('execute', () => {
      if (!previewOriginal) return;
      previewUndoStack.push(cloneRecommendation(displayedRecommendation));
      previewRedoStack = [];
      showRecommendation(previewOriginal, { resetHistory: false });
      plannerStatus.setValue('Reset the preview to its generated formation.');
    });
    applyRecommendation.addListener('execute', () => {
      void (async () => {
        try {
          if (!EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED) {
            throw new Error('Experimental troop movement is disabled in this build.');
          }
          const units = displayedRecommendation?.grid?.flat().filter(Boolean) ?? [];
          if (!units.length) throw new Error('Generate a recommendation first.');
          if (!(await confirmExperimentalMove())) {
            plannerStatus.setValue('Experimental formation move cancelled.');
            return;
          }
          applyRecommendation.setEnabled(false);
          this.hub.applyRecommendedFormation(units);
          plannerStatus.setValue('Recommended formation applied to the active attack setup.');
          observedFormation = formationSignature(this.hub.snapshot());
          queueLiveSimulation();
        } catch (error) {
          plannerStatus.setValue(`Unable to apply recommendation: ${error?.message ?? error}`);
          this.context.logger?.warn?.('War Room experimental formation move failed.', error);
        } finally {
          const snapshot = this.hub.snapshot();
          applyRecommendation.setEnabled(Boolean(
            EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED
            && displayedRecommendation
            && snapshot.attacker?.id
            && snapshot.target?.id
          ));
        }
      })();
    });
    presetSelect.addListener('changeSelection', () => {
      const available = Boolean(selectedPreset());
      loadPreset.setEnabled(available);
      deletePreset.setEnabled(available);
    });
    savePreset.addListener('execute', () => {
      void (async () => {
        try {
          if (!this.context.storage?.set) throw new Error('Suite storage is unavailable.');
          const captured = this.hub.captureFormation();
          const name = presetName.getValue?.()?.trim()
            || `Formation ${formationPresets.filter((preset) =>
              String(preset.attackerId) === String(captured.attackerId)
              && String(preset.target?.id) === String(captured.target?.id)
            ).length + 1}`;
          const existing = formationPresets.find((preset) =>
            String(preset.attackerId) === String(captured.attackerId)
            && String(preset.target?.id) === String(captured.target?.id)
            && preset.name.toLowerCase() === name.toLowerCase()
          );
          const preset = {
            id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            attackerId: captured.attackerId,
            attackerName: captured.attackerName,
            target: captured.target,
            updatedAt: Date.now(),
            units: captured.units
          };
          formationPresets = existing
            ? formationPresets.map((item) => item.id === existing.id ? preset : item)
            : [...formationPresets, preset];
          await this.context.storage.set(presetStorageKey, formationPresets);
          renderPresets(preset.id);
          presetName.setValue('');
          this.context.eventBus?.emit?.('war-room:formation-presets-changed', {
            presetId: preset.id,
            attackerId: captured.attackerId,
            targetId: captured.target?.id
          });
          plannerStatus.setValue(`${name} saved for ${captured.attackerName} against ${captured.target?.name ?? 'this target'}.`);
        } catch (error) {
          plannerStatus.setValue(`Unable to save formation: ${error?.message ?? error}`);
        }
      })();
    });
    loadPreset.addListener('execute', () => {
      try {
        const preset = selectedPreset();
        if (!preset) throw new Error('Choose a saved formation first.');
        this.hub.applyFormation(preset);
        plannerStatus.setValue(`${preset.name} loaded into the active attack formation.`);
        queueLiveSimulation();
      } catch (error) {
        plannerStatus.setValue(`Unable to load formation: ${error?.message ?? error}`);
      }
    });
    deletePreset.addListener('execute', () => {
      void (async () => {
        try {
          const preset = selectedPreset();
          if (!preset) throw new Error('Choose a saved formation first.');
          formationPresets = formationPresets.filter((item) => item.id !== preset.id);
          await this.context.storage.set(presetStorageKey, formationPresets);
          this.context.eventBus?.emit?.('war-room:formation-presets-changed', {
            presetId: null,
            attackerId: preset.attackerId,
            targetId: preset.target?.id
          });
          renderPresets();
          plannerStatus.setValue(`${preset.name} deleted.`);
        } catch (error) {
          plannerStatus.setValue(`Unable to delete formation: ${error?.message ?? error}`);
        }
      })();
    });
    plannerGoal.addListener('changeSelection', renderRecommendation);
    const playCurrentFormation = () => {
      try {
        const snapshot = this.hub.snapshot();
        const signature = formationSignature(snapshot);
        if (
          this.nativeSimulationReplay
          && this.nativeSimulationReplay.targetId === String(snapshot.target?.id)
          && this.nativeSimulationReplay.formation === signature
        ) {
          this.hub.playSimulation(this.nativeSimulationReplay.response);
          return;
        }
        playSimulationQueued = true;
        queueLiveSimulation();
        simulatorText.setValue('Simulating the current formation before playback…');
      } catch (error) {
        simulatorText.setValue(`Unable to play simulation: ${error?.message ?? error}`);
      }
    };
    this.playCurrentFormation = playCurrentFormation;
    runSimulations.addListener('execute', playCurrentFormation);
    favorite.addListener('execute', () => {
      const active = this.stats.toggleFavorite(this.currentSnapshot?.target);
      favorite.setLabel(active ? '★ Favorited' : '☆ Favorite');
    });
    exportHistory.addListener('execute', () => {
      void (async () => {
        try {
          const text = this.stats.exportText();
          if (globalThis.navigator?.clipboard?.writeText) {
            await globalThis.navigator.clipboard.writeText(text);
          } else {
            globalThis.prompt?.('Copy War Room history', text);
          }
          statsStatus.setValue(`${this.stats.history.length} battle result(s) copied.`);
        } catch (error) {
          statsStatus.setValue(`Unable to copy history: ${error?.message ?? error}`);
        }
      })();
    });
    clearHistory.addListener('execute', () => {
      this.stats.clearHistory();
      stats.grid.model.setData([]);
      statsStatus.setValue('Battle history cleared. Favorite targets were retained.');
    });
    launch.addListener('execute', () => {
      try {
        this.simulator.launch();
      } catch (error) {
        footer.setValue(error?.message ?? String(error));
      }
    });
    const searchRows = () => this.searchResults ?? [];
    const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const downloadCsv = (filename, headers, rows) => {
      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = globalThis.document?.createElement?.('a');
      if (!anchor) throw new Error('Browser downloads are unavailable.');
      anchor.href = url;
      anchor.download = filename;
      globalThis.document?.body?.appendChild?.(anchor);
      anchor.click();
      anchor.remove?.();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    exportArmyCsv.addListener('execute', () => {
      try {
        const rows = this.currentArmyRows ?? [];
        if (!rows.length) throw new Error('Choose a base with an offensive army first.');
        const base = armyBase.getSelection?.()?.[0]?.getLabel?.() ?? 'army';
        downloadCsv(
          `cnc-ta-army-${String(base).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Unit', 'Role', 'Level', 'Health', 'State', 'Position', 'Range', 'Speed', 'Best against', 'Est. 1v1 ceiling', 'Repair crystal needed'],
          rows
        );
        armySummary.setValue(`${base} · ${rows.length} troop record(s) exported.`);
        render();
      } catch (error) {
        armySummary.setValue(`Army export failed: ${error?.message ?? error}`);
        render();
      }
    });
    exportStatsCsv.addListener('execute', () => {
      try {
        const rows = this.currentStatsRows ?? [];
        if (!rows.length) throw new Error('Load combat statistics first.');
        const base = statsBase.getSelection?.()?.[0]?.getLabel?.() ?? 'all-bases';
        downloadCsv(
          `cnc-ta-combat-statistics-${String(base).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Metric', 'Attack players', 'Attack Forgotten', 'Defend Forgotten', 'Defend players', 'All attacks', 'All defense'],
          rows
        );
        statsStatus.setValue(`${base} combat statistics exported.`);
        render();
      } catch (error) {
        statsStatus.setValue(`Combat statistics export failed: ${error?.message ?? error}`);
        render();
      }
    });
    const searchCsv = () => [
      ['Type', 'Base', 'Owner', 'Alliance', 'Level', 'X', 'Y', 'Coordinates', 'Distance'],
      ...searchRows().map((target) => [
        target.type, target.name, target.owner, target.alliance, target.level,
        target.x, target.y, `${target.x}:${target.y}`,
        Number(target.distance ?? 0).toFixed(2)
      ])
    ].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const searchShareText = () => {
      const alliance = allianceCheck.getValue()
        ? allianceSelect.getSelection?.()?.[0]?.getLabel?.()
        : '';
      const heading = alliance ? `[b]${alliance} target bases[/b]` : '[b]War Room target list[/b]';
      return [heading, ...searchRows().map((target) => {
        const owner = target.owner ? `${target.owner} — ` : '';
        const name = target.name && target.name !== 'Player Base' ? `${target.name} — ` : '';
        return `${owner}${name}${target.type} L${target.level} [coords]${target.x}:${target.y}[/coords]`;
      })].join('\n');
    };
    const setSearchExportEnabled = (enabled) => {
      for (const button of [exportSearchCsv, copySearchList, messageSearchList]) button.setEnabled(Boolean(enabled));
    };
    exportSearchCsv.addListener('execute', () => {
      try {
        if (!searchRows().length) throw new Error('Run a search before exporting.');
        const blob = new Blob([searchCsv()], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = globalThis.document?.createElement?.('a');
        if (!anchor) throw new Error('Browser downloads are unavailable.');
        const label = allianceCheck.getValue()
          ? allianceSelect.getSelection?.()?.[0]?.getLabel?.() ?? 'alliance'
          : 'targets';
        anchor.href = url;
        anchor.download = `cnc-ta-${String(label).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
        globalThis.document?.body?.appendChild?.(anchor);
        anchor.click();
        anchor.remove?.();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        targetStatus.setValue(`${searchRows().length} search result(s) exported as CSV.`);
      } catch (error) {
        targetStatus.setValue(`CSV export failed: ${error?.message ?? error}`);
      }
    });
    copySearchList.addListener('execute', () => {
      void (async () => {
        try {
          if (!searchRows().length) throw new Error('Run a search before copying.');
          const text = searchShareText();
          if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
          else globalThis.prompt?.('Copy target list', text);
          targetStatus.setValue(`${searchRows().length} target(s) copied for sharing.`);
        } catch (error) {
          targetStatus.setValue(`Copy failed: ${error?.message ?? error}`);
        }
      })();
    });
    messageSearchList.addListener('execute', () => {
      void (async () => {
        try {
          if (!searchRows().length) throw new Error('Run a search before creating a message.');
          const communications = this.context.modules?.get?.('communications');
          if (!communications) throw new Error('The Communications module is not installed.');
          await this.context.modules.open('communications');
          communications.append?.(searchShareText());
          communications.editor?.focus?.();
          targetStatus.setValue('Target list opened in Communications. Review and copy it into game mail or chat.');
        } catch (error) {
          targetStatus.setValue(`Message draft failed: ${error?.message ?? error}`);
        }
      })();
    });
    targetSearch.addListener('execute', () => {
      try {
        setSearchExportEnabled(false);
        const snapshot = this.hub.snapshot();
        const types = Object.entries(targetTypes)
          .filter(([, check]) => check.getValue())
          .map(([type]) => type);
        const allianceKey = allianceCheck.getValue()
          ? allianceSelect.getSelection?.()?.[0]?.getModel?.()
          : null;
        const selectedAlliance = allianceKey ? allianceOptions.get(String(allianceKey)) : null;
        if (allianceCheck.getValue() && !selectedAlliance) {
          throw new Error('Choose an alliance first.');
        }
        this.searchResults = this.hub.searchTargets({
          originCityId: snapshot.attacker?.id,
          minLevel: minLevel.getValue(),
          maxLevel: maxLevel.getValue(),
          cpLimit: maxCp.getValue(),
          radius: searchRadius,
          types,
          allianceId: selectedAlliance?.id ?? null,
          allianceName: selectedAlliance?.name ?? null
        });
        search.grid.model.setData(this.searchResults.map((target) => [
          `${target.type} Lvl ${target.level}`,
          `${target.x}:${target.y}`,
          target.level,
          target.cp,
          '▶ Open Attack'
        ]));
        targetStatus.setValue(
          `${this.searchResults.length} targets found. Click a row to inspect it; use Open Attack to enter combat setup.`
        );
        selectedSearchTarget = null;
        render();
        setSearchExportEnabled(this.searchResults.length > 0);
      } catch (error) {
        targetStatus.setValue(`Target search failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room target search failed.', error);
      }
    });
    search.grid.widget.addListener('cellTap', (event) => {
      const target = this.searchResults?.[event.getRow?.()];
      if (!target) return;
      selectedSearchTarget = target;
      this.intelTargetId = target.id;
      render();
      const openAttack = Number(event.getColumn?.()) === 4;
      try {
        if (openAttack) {
          this.hub.openTargetAttack(target);
          targetStatus.setValue(
            `Opening ${target.type} at ${target.x}:${target.y}. Its attack screen will become the War Room target.`
          );
        } else {
          targetStatus.setValue(`Selected ${target.type} at ${target.x}:${target.y}. Loading attack information…`);
          void (async () => {
            try {
              await this.hub.selectSearchTarget(target);
              await populateTargetIntel(target);
            } catch (error) {
              targetStatus.setValue(`Unable to select target: ${error?.message ?? error}`);
            }
          })();
        }
      } catch (error) {
        targetStatus.setValue(`Unable to open target: ${error?.message ?? error}`);
      }
    });

    stack.setSelection([search.page]);
    void loadFormationPresets().catch((error) => {
      this.context.logger?.warn?.('War Room formation presets failed to load.', error);
    });
    syncFromGameTarget();
    void loadNativeReports();
    return root;
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.refreshAll?.();
      this.record.window.open();
      this.record.window.setActive?.(true);
      return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'war-room',
      title: 'War Room v0.5',
      content: this.build(),
      x: 120,
      y: 70,
      width: 832,
      height: 650,
      sizeRevision: 'war-room-0.1-compact-width',
      resizable: true,
      singleton: true
    });
    return this.record;
  }
}

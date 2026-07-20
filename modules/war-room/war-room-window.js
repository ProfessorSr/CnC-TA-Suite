import { ArmyAnalyzer } from './army-analyzer.js';
import { ReportSummary } from './report-summary.js';
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

function table(qx, columns) {
  const model = new qx.ui.table.model.Simple();
  model.setColumns(columns);
  const widget = new qx.ui.table.Table(model).set({ statusBarVisible: false });
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

    const toolbar = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
    const stack = new qx.ui.container.Stack();
    const pages = new Map();
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
      button.addListener('execute', () => stack.setSelection([pages.get(id).page]));
    }
    this.showPage = (id) => {
      const page = pages.get(id)?.page;
      if (page) stack.setSelection([page]);
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
    planner.page.add(plannerStatus);
    const formationVisual = table(qx, ['Row', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    formationVisual.widget.set({ height: 190, minHeight: 150 });
    planner.page.add(formationVisual.widget);
    const formationLegend = label(qx, '<b>Troop legend</b><br>—', { rich: true });
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
      previewUndo, previewRedo, previewReset, simulatePreview, shiftLeft, shiftRight, shiftUp, shiftDown,
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
    const selectedPreset = () => {
      const id = presetSelect.getSelection?.()?.[0]?.getModel?.();
      return formationPresets.find((preset) => String(preset.id) === String(id)) ?? null;
    };
    const renderPresets = (selectedId = null) => {
      presetSelect.removeAll();
      let selectedItem = null;
      const attackerId = this.hub.snapshot().attacker?.id;
      for (const preset of formationPresets.filter((item) =>
        String(item.attackerId) === String(attackerId)
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
    const loadFormationPresets = async () => {
      formationPresets = await this.context.storage?.get?.(presetStorageKey, []) ?? [];
      renderPresets();
    };

    const simulator = keyValuePage(qx, [
      'Run', 'CY left', 'DF left', 'Defender left', 'Own left',
      'Repair', 'Loot', 'RP', 'Duration', 'Outcome', 'Morale', 'Auto repair', 'Source'
    ]);
    simulator.grid.widget.set({ height: 125, minHeight: 100, maxHeight: 150 });
    const reports = keyValuePage(qx, ['Metric', 'Value']);
    const army = keyValuePage(qx, ['Unit', 'Level', 'Health', 'Position', 'Group']);
    const search = keyValuePage(qx, ['Type', 'Location', 'Level', 'CP', 'Distance']);
    const targetControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const minLevel = new qx.ui.form.Spinner(1, 1, 100).set({ width: 65 });
    const maxLevel = new qx.ui.form.Spinner(1, 100, 100).set({ width: 65 });
    const maxCp = new qx.ui.form.Spinner(1, 25, 99).set({ width: 65 });
    const maxDistance = new qx.ui.form.Spinner(1, 10, 99).set({ width: 65 });
    maxDistance.setValue(Math.max(1, Math.round(this.hub.getSearchOptions().maxAttackDistance || 10)));
    const targetTypes = {};
    targetControls.add(label(qx, 'Level'));
    targetControls.add(minLevel);
    targetControls.add(label(qx, 'to'));
    targetControls.add(maxLevel);
    targetControls.add(label(qx, 'Max CP'));
    targetControls.add(maxCp);
    targetControls.add(label(qx, 'Distance'));
    targetControls.add(maxDistance);
    for (const type of ['Base', 'Camp', 'Outpost']) {
      const check = new qx.ui.form.CheckBox(type).set({ value: true, textColor: '#ffffff' });
      targetTypes[type] = check;
      targetControls.add(check);
    }
    const allianceCheck = new qx.ui.form.CheckBox('Alliance').set({ value: false, textColor: '#ffffff' });
    const allianceSelect = new qx.ui.form.SelectBox().set({ width: 180, enabled: false });
    targetControls.add(allianceCheck);
    targetControls.add(allianceSelect);
    const targetSearch = new qx.ui.form.Button('Search Targets');
    targetControls.add(targetSearch);
    search.page.addAt(targetControls, 0);
    const targetStatus = label(qx, 'Search from the current attacker base, or open War Room from an attack screen.');
    search.page.add(targetStatus);
    const targetIntel = table(qx, ['Target Information', 'Value']);
    targetIntel.widget.set({ height: 245, minHeight: 180 });
    search.page.add(targetIntel.widget);
    const stats = keyValuePage(qx, ['Time', 'Target', 'CP', 'Loot', 'Status']);
    const statsControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const exportHistory = new qx.ui.form.Button('Copy History');
    const clearHistory = new qx.ui.form.Button('Clear History');
    const statsStatus = label(qx, 'Battle results and favorite targets persist between sessions.');
    statsControls.add(exportHistory);
    statsControls.add(clearHistory);
    statsControls.add(statsStatus, { flex: 1 });
    stats.page.addAt(statsControls, 0);

    const loadAlliances = () => {
      const snapshot = this.hub.snapshot();
      const alliances = this.hub.getAllianceOptions({ originCityId: snapshot.attacker?.id });
      allianceSelect.removeAll();
      for (const alliance of alliances) {
        allianceSelect.add(new qx.ui.form.ListItem(alliance.name, null, alliance.name));
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
        loadAlliances();
      } else {
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
    simulatorActions.add(miniMove);
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
    overview.add(formationLegend);
    overview.add(new qx.ui.core.Spacer(), { flex: 1 });

    const workspace = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    workspace.add(overview);
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
            ? `${snapshot.attackEstimate.possibleAttacks} (${snapshot.attackEstimate.commandPointAttacks} by CP; ${Number.isFinite(snapshot.attackEstimate.repairTimeAttacks) ? `${snapshot.attackEstimate.repairTimeAttacks} by repair time` : 'repair time not limiting'})`
            : '—'],
          ['Formation units', summary.unitCount],
          ['Average unit level', summary.averageLevel.toFixed(1)],
          ['Level difference', summary.levelDelta.toFixed(1)],
          ['Readiness', summary.readiness]
        ]);
        reports.grid.model.setData(ReportSummary.rows(snapshot));
        army.grid.model.setData(ArmyAnalyzer.rows(snapshot));
        if (!this.searchResults) search.grid.model.setData([]);
        stats.grid.model.setData(this.stats.rows());
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
        if (snapshot.target?.id && String(snapshot.target.id) !== String(this.intelTargetId ?? '')) {
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

    const simulateRecommendation = async () => {
      recommend.setEnabled(false);
      optimizationRunning = true;
      try {
        const snapshot = this.hub.snapshot();
        const goal = selectedGoal();
        const detail = searchDetail.getSelection?.()?.[0]?.getModel?.() ?? 'detailed';
        const candidates = WarRoomCalculator.candidateFormations(snapshot, goal, detail);
        let best = null;
        for (let index = 0; index < candidates.length; index += 1) {
          const candidate = candidates[index];
          plannerStatus.setValue(
            `Simulating ${index + 1}/${candidates.length}: ${candidate.name}…`
          );
          const cacheKey = simulationKey(snapshot, candidate.units);
          const response = simulationCache.get(cacheKey)?.response
            ?? await this.hub.simulateFormation(candidate.units);
          simulationCache.set(cacheKey, {
            response, snapshot, at: Date.now(), name: candidate.name,
            units: candidate.units.map((unit) => ({ ...unit }))
          });
          const result = WarRoomCalculator.scoreSimulation(response, snapshot, goal);
          if (!best || result.score < best.result.score) best = { candidate, result };
          if (result.oneShot) break;
          if (index < candidates.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3100));
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
        plannerStatus.setValue(
          `${best.candidate.name}: ${best.result.oneShot ? 'one-shot kill found; ' : ''}`
          + `${best.result.objectivePercent.toFixed(1)}% objective health remaining; `
          + `${best.result.defenderPercent.toFixed(1)}% total defender health remaining; `
          + `${best.result.blockerPercent.toFixed(1)}% blocking-column health remaining. `
          + 'Ranked by native battle simulation; troops were not moved.'
        );
      } catch (error) {
        plannerStatus.setValue(`Formation simulation failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room formation simulation failed.', error);
      } finally {
        optimizationRunning = false;
        recommend.setEnabled(true);
        if (liveSimulationQueued) queueLiveSimulation();
      }
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
        Math.round(entry.analysis.loot),
        Math.round(entry.analysis.research),
        duration(entry.analysis.durationSeconds),
        entry.analysis.outcome,
        entry.analysis.morale,
        entry.analysis.autoRepair ? 'Yes' : 'No',
        entry.name ? 'Cached candidate' : 'Native live simulation'
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
        card.add(cardText(`Duration  ${duration(result.durationSeconds)}`));
        card.add(cardText(`Outcome  ${result.outcome}`, result.outcome === 'Victory' ? '#19733a' : '#b32323', true));
        card.add(cardText('Defender', '#45565e', true));
        card.add(cardText(`Structures  ${result.defenderBreakdown.structures.remainingPercent.toFixed(1)}%`));
        card.add(cardText(`Defense  ${result.defenderBreakdown.defense.remainingPercent.toFixed(1)}%`));
        card.add(cardText(`Armored  ${result.defenderBreakdown.armored.remainingPercent.toFixed(1)}%`));
        card.add(cardText(`CY / DF / CC  ${result.cyRemaining?.toFixed(0) ?? '—'} / ${result.dfRemaining?.toFixed(0) ?? '—'} / ${result.ccRemaining?.toFixed(0) ?? '—'}%`));
        card.add(cardText('Own repair', '#45565e', true));
        card.add(cardText(`Total  ${duration(result.repairSeconds)}`, result.repairSeconds ? '#b36b00' : '#19733a'));
        card.add(cardText(`Inf / Veh / Air  ${result.offenseBreakdown.infantry.remainingPercent.toFixed(0)} / ${result.offenseBreakdown.vehicle.remainingPercent.toFixed(0)} / ${result.offenseBreakdown.aircraft.remainingPercent.toFixed(0)}%`));
        card.add(cardText('Loot', '#45565e', true));
        card.add(cardText(`Tib  ${Math.round(result.lootResources.tiberium).toLocaleString()}`, '#19733a'));
        card.add(cardText(`Crystal  ${Math.round(result.lootResources.crystal).toLocaleString()}`, '#15729b'));
        card.add(cardText(`Credits  ${Math.round(result.lootResources.credits).toLocaleString()}`, '#9a7600'));
        card.add(cardText(`RP  ${Math.round(result.lootResources.research).toLocaleString()}`, '#6b4ca5'));
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
        const activeTargetId = this.hub.snapshot().target?.id;
        if (activeTargetId != null && String(activeTargetId) !== String(target.id)) {
          syncFromGameTarget();
          return;
        }
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
          ['Target', `${intel.name} (${intel.type} Lvl ${intel.level ?? target.level ?? '—'})`],
          ['Level / coordinates', `${intel.level} / ${intel.x}:${intel.y}`],
          ['Owner', intel.owner],
          ['Alliance', intel.alliance || '—'],
          ['Attack cost', `${intel.cp} CP`],
          ['Attack from', intel.attacker],
          ['Attack possible', intel.attackPossible ? 'Yes' : 'No'],
          ['Estimated attacks', `${intel.attackEstimate?.possibleAttacks ?? 0} (${intel.attackEstimate?.commandPointAttacks ?? 0} by CP; ${Number.isFinite(intel.attackEstimate?.repairTimeAttacks) ? `${intel.attackEstimate.repairTimeAttacks} by repair time` : 'repair time not limiting'})`],
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
        renderRecommendation();
        renderSimulations();
      } catch (error) {
        targetStatus.setValue(`Unable to load target: ${error?.message ?? error}`);
      }
    };

    const syncFromGameTarget = () => {
      render();
      renderRecommendation();
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
      if (liveSimulationRunning || optimizationRunning) {
        liveSimulationQueued = true;
        return;
      }
      const snapshot = this.hub.snapshot();
      if (!snapshot.target?.id || !snapshot.units.length) return;
      liveSimulationRunning = true;
      simulatorText.setValue('Running native simulation for the current formation…');
      try {
        const cacheKey = simulationKey(snapshot);
        const response = simulationCache.get(cacheKey)?.response ?? await this.hub.simulateFormation(snapshot.units);
        simulationCache.set(cacheKey, {
          response, snapshot, at: Date.now(), name: 'Live',
          units: snapshot.units.map((unit) => ({ ...unit }))
        });
        for (const [key, entry] of simulationCache) {
          if (String(entry.snapshot?.target?.id) === String(snapshot.target.id)
            && String(entry.snapshot?.target?.version ?? 0) !== String(snapshot.target?.version ?? 0)) simulationCache.delete(key);
        }
        const current = this.hub.snapshot();
        if (
          String(current.target?.id) === String(snapshot.target.id)
          && formationSignature(current) === formationSignature(snapshot)
        ) {
          this.nativeSimulation = WarRoomCalculator.analyzeNativeSimulation(response, snapshot, 'Live');
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
        simulatorText.setValue(`Live simulation failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room live simulation failed.', error);
      } finally {
        liveSimulationRunning = false;
        if (liveSimulationQueued) {
          liveSimulationQueued = false;
          liveTimer = setTimeout(() => { void runLiveSimulation(); }, 3100);
        }
      }
    };

    const queueLiveSimulation = () => {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => { void runLiveSimulation(); }, 400);
    };

    this.context.events?.on?.('game:tick', () => {
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
      if (!this.record?.window?.isVisible?.()) return;
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
        queueLiveSimulation();
      }
    });

    this.refreshAll = syncFromGameTarget;
    refresh.addListener('execute', syncFromGameTarget);
    recommend.addListener('execute', () => { void simulateRecommendation(); });
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
            throw new Error('Open a target attack screen and arrange a preview first.');
          }
          plannerStatus.setValue('Simulating the manually arranged preview…');
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
          plannerStatus.setValue(
            `Manual preview: ${analysis.outcome}; defender ${analysis.defenderRemaining.toFixed(1)}% remaining; `
            + `own army ${analysis.ownRemaining.toFixed(1)}% remaining; repair ${duration(analysis.repairSeconds)}. `
            + 'Open Battle Simulator for the complete result and replay controls.'
          );
        } catch (error) {
          plannerStatus.setValue(`Manual preview simulation failed: ${error?.message ?? error}`);
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
            ).length + 1}`;
          const existing = formationPresets.find((preset) =>
            String(preset.attackerId) === String(captured.attackerId)
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
          plannerStatus.setValue(`${name} saved for ${captured.attackerName}.`);
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
          renderPresets();
          plannerStatus.setValue(`${preset.name} deleted.`);
        } catch (error) {
          plannerStatus.setValue(`Unable to delete formation: ${error?.message ?? error}`);
        }
      })();
    });
    plannerGoal.addListener('changeSelection', renderRecommendation);
    runSimulations.addListener('execute', () => {
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
    });
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
    targetSearch.addListener('execute', () => {
      try {
        const snapshot = this.hub.snapshot();
        const types = Object.entries(targetTypes)
          .filter(([, check]) => check.getValue())
          .map(([type]) => type);
        const allianceName = allianceCheck.getValue()
          ? allianceSelect.getSelection?.()?.[0]?.getModel?.()
          : null;
        if (allianceCheck.getValue() && !allianceName) {
          throw new Error('Choose an alliance first.');
        }
        this.searchResults = this.hub.searchTargets({
          originCityId: snapshot.attacker?.id,
          minLevel: minLevel.getValue(),
          maxLevel: maxLevel.getValue(),
          cpLimit: maxCp.getValue(),
          radius: maxDistance.getValue(),
          types,
          allianceName
        });
        search.grid.model.setData(this.searchResults.map((target) => [
          `${target.type} Lvl ${target.level}`,
          `${target.x}:${target.y}`,
          target.level,
          target.cp,
          target.distance.toFixed(2)
        ]));
        targetStatus.setValue(
          `${this.searchResults.length} targets found. Click a row to open its attack setup.`
        );
      } catch (error) {
        targetStatus.setValue(`Target search failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room target search failed.', error);
      }
    });
    search.grid.widget.addListener('cellTap', (event) => {
      const target = this.searchResults?.[event.getRow?.()];
      if (!target) return;
      try {
        this.hub.openTargetAttack(target);
        targetStatus.setValue(
          `Opening ${target.type} at ${target.x}:${target.y}. Its attack screen will become the War Room target.`
        );
      } catch (error) {
        targetStatus.setValue(`Unable to open target: ${error?.message ?? error}`);
      }
    });

    stack.setSelection([search.page]);
    void loadFormationPresets().catch((error) => {
      this.context.logger?.warn?.('War Room formation presets failed to load.', error);
    });
    syncFromGameTarget();
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
      title: 'War Room v1.0',
      content: this.build(),
      x: 120,
      y: 70,
      width: 1040,
      height: 650,
      resizable: true,
      singleton: true
    });
    return this.record;
  }
}

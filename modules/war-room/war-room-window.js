import { ArmyAnalyzer } from './army-analyzer.js';
import { WarRoomCalculator } from './war-room-calculator.js';
import {
  allowsTroopHiding,
  greedyCandidate,
  manualFormationEdits,
  orderForCyReveal,
  orderWeakestFirst,
  scoreMaximumResearch,
  stageCells,
  totalGreedySimulations
} from './exhaustive-formation-optimizer.js';
import {
  DEFAULT_WAR_ROOM_COMPANION_SETTINGS,
  WAR_ROOM_COMPANION_SETTINGS_KEY,
  normalizeWarRoomCompanionSettings
} from './companion-settings.js';
import {
  formationTargetMatches,
  loadFormationPresets as readFormationPresets,
  saveFormationPresets
} from './formation-preset-store.js';

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

function compactNumber(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return Math.round(number).toLocaleString();
}

function intelSection(title, content, accent) {
  return `<div style="margin-top:7px;border-top:1px solid ${accent};padding-top:5px">`
    + `<div style="color:${accent};font-size:12px;font-weight:bold;text-transform:uppercase">${escapeHtml(title)}</div>`
    + content + '</div>';
}

function targetIntelCard(intel) {
  const estimate = intel.attackEstimate ?? {};
  const repairLimit = Number.isFinite(estimate.fullyRepairableAttacks)
    ? `${estimate.fullyRepairableAttacks} fully repairable + 1 final hit`
    : 'Repair storage is not limiting';
  const loot = (intel.loot ?? []).filter((resource) =>
    Number(resource.amount) > 0
    && !/^RepairChargeBase$/i.test(String(resource.name ?? '').replace(/\s/g, ''))
  );
  const lootContent = loot.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:3px">${loot.map((resource) =>
      `<span style="padding:3px 6px;background:#edf5f7;border:1px solid #91a5ad;border-radius:3px">`
      + `<b>${escapeHtml(/^ResearchPoints$/i.test(String(resource.name ?? '').replace(/\s/g, '')) ? 'RP' : resource.name)}</b> ${compactNumber(resource.amount)}</span>`).join('')}</div>`
    : '<div style="color:#53656d">Rewards are unavailable until the target finishes loading.</div>';
  const composition = Object.entries(intel.composition ?? {}).map(([category, summary]) =>
    `${escapeHtml(category)} <b>${Number(summary.count ?? 0)}</b>`).join(' · ');
  const level = Number(intel.level);
  const levelText = Number.isFinite(level) ? level.toFixed(1).replace(/\.0$/, '') : '—';
  const hasBaseCondition = intel.baseCondition != null && Number.isFinite(Number(intel.baseCondition));
  const hasDefenseCondition = intel.defenseCondition != null && Number.isFinite(Number(intel.defenseCondition));
  const conditionParts = [
    hasBaseCondition ? `Base <b>${Math.round(Number(intel.baseCondition))}%</b>` : null,
    hasDefenseCondition ? `Defense <b>${Math.round(Number(intel.defenseCondition))}%</b>` : null,
    intel.support
      ? `${escapeHtml(intel.support.name)} Lvl ${intel.support.level} (${intel.support.condition}%)`
      : null
  ].filter(Boolean);
  return '<div style="padding:7px 10px;background:#c8d3d7;color:#17262d;border:1px solid #91a5ad;'
    + 'border-top:3px solid #edf5f7;border-bottom:4px solid #667a83;border-radius:7px">'
    + `<div style="font-size:15px;font-weight:bold">${escapeHtml(intel.name ?? 'Target')} <span style="color:#53656d">Lvl ${escapeHtml(levelText)}</span></div>`
    + `<div style="color:#334850">${escapeHtml(intel.type ?? 'Target')} at <b>${escapeHtml(intel.x)}:${escapeHtml(intel.y)}</b>`
    + ` · ${escapeHtml(intel.owner ?? 'Forgotten')}${intel.alliance ? ` · ${escapeHtml(intel.alliance)}` : ''}</div>`
    + intelSection('Attack capacity',
      `<div><b style="color:#176f35;font-size:16px">${estimate.possibleAttacks ?? 0}</b> estimated attacks from <b>${escapeHtml(intel.attacker ?? 'Current base')}</b></div>`
      + `<div>CP: <b>${estimate.commandPointAttacks ?? 0}</b> attacks · ${compactNumber(estimate.cpAvailable)} available · <b>${compactNumber(intel.cp)}</b> per attack</div>`
      + `<div>Repair: ${escapeHtml(repairLimit)} · ${duration(estimate.repairAvailableSeconds)} stored · ${duration(estimate.maxRepairSeconds)} max/run</div>`, '#176f35')
    + intelSection('Resources & rewards', lootContent, '#006b91')
    + (conditionParts.length || composition ? intelSection('Target condition',
      `${conditionParts.length ? `<div>${conditionParts.join(' · ')}</div>` : ''}`
      + `${composition ? `<div style="color:#53656d">${composition}</div>` : ''}`, '#53656d') : '')
    + '</div>';
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
    this.content = null;
    this.companionWindows = null;
  }

  build() {
    if (this.content && !this.content.isDisposed?.()) return this.content;
    const qx = globalThis.qx;
    const moduleVersion = this.context?.module?.version ?? '0.17.2';
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
    const windowVisible = () => Boolean(
      this.record?.window?.isVisible?.()
      || compactPlannerWindow?.isVisible?.()
      || comparisonWindow?.isVisible?.()
      || historyWindow?.isVisible?.()
    );
    let unsubscribePresetChanges = null;
    let unsubscribeGameTick = null;
    let compactPlannerWindow = null;
    let compactPlannerResult = null;
    let comparisonWindow = null;
    let comparisonResults = null;
    let historyWindow = null;
    let historyResults = null;
    let comparisonReduced = false;
    let comparisonHistoryButton = null;
    let comparisonRenderSignature = '';
    let nativeHistoryControl = null;
    let nativeSimulationPanelElement = null;
    let nativeSimulationContentElement = null;
    let companionSettings = { ...DEFAULT_WAR_ROOM_COMPANION_SETTINGS };
    let attackCompanionsRequested = false;

    const toolbar = new qx.ui.container.Composite(new qx.ui.layout.VBox(4)).set({
      width: 240,
      minWidth: 140,
      paddingRight: 6
    });
    const stack = new qx.ui.container.Stack();
    const pages = new Map();
    let activeSectionId = 'simulator';
    let selectSectionControls = () => {};
    const sections = [
      ['search', '🔍 Search'],
      ['simulator', '🎯 Attack Simulator'],
      ['army', '👥 Army Analyzer'],
      ['stats', '📈 Combat Statistics'],
      ['settings', '⚙ Settings']
    ];

    for (const [id, title] of sections) {
      const button = new qx.ui.form.Button(title).set({
        allowGrowX: true
      });
      toolbar.add(button);
      button.addListener('execute', () => {
        activeSectionId = id;
        stack.setSelection([pages.get(id).page]);
        selectSectionControls(id);
        render();
        if (id === 'stats') void loadCombatStatistics();
      });
    }
    this.showPage = (id) => {
      const page = pages.get(id)?.page;
      if (page) {
        activeSectionId = id;
        stack.setSelection([page]);
        selectSectionControls(id);
        render();
        if (id === 'stats') void loadCombatStatistics();
      }
    };
    toolbar.add(new qx.ui.core.Widget().set({
      height: 1,
      minHeight: 1,
      maxHeight: 1,
      marginTop: 6,
      marginBottom: 6,
      backgroundColor: '#667780'
    }));
    const sectionControlsHost = new qx.ui.container.Scroll().set({
      scrollbarX: 'auto', scrollbarY: 'auto', minHeight: 0
    });
    toolbar.add(sectionControlsHost, { flex: 1 });
    const refresh = new qx.ui.form.Button('Refresh');
    toolbar.add(refresh);

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
    const searchMode = new qx.ui.form.SelectBox().set({ width: 190 });
    searchMode.add(new qx.ui.form.ListItem('Formation search', null, 'formation'));
    searchMode.add(new qx.ui.form.ListItem('Greedy troop-by-troop RP', null, 'greedy'));
    const recommend = new qx.ui.form.Button('Simulate Best Formation');
    const pauseRecommendation = new qx.ui.form.Button('Pause').set({ enabled: false });
    const searchTime = new qx.ui.form.Spinner(1, 30, 600).set({
      singleStep: 1, pageStep: 10, width: 88,
      toolTipText: 'Number of simulations; each simulation represents about 3 seconds'
    });
    const searchTimeLabel = label(qx, '1:30', { width: 42 });
    plannerControls.add(label(qx, 'Attack goal'));
    plannerControls.add(plannerGoal);
    plannerControls.add(searchMode);
    plannerControls.add(label(qx, 'Sims'));
    plannerControls.add(searchTime);
    plannerControls.add(searchTimeLabel);
    plannerControls.add(recommend);
    plannerControls.add(pauseRecommendation);
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
      if (activeSectionId === 'planner' || activeSectionId === 'simulator') {
        safeSetValue(bestFormationResult, value);
      }
    };

    // Compact companion for the optimizer controls. It deliberately omits the
    // troop grid: the live game attack view remains the visual formation.
    const compactLayout = new qx.ui.layout.VBox(6);
    compactPlannerWindow = new qx.ui.window.Window(`Formation Optimizer v${moduleVersion}`).set({
      layout: compactLayout,
      padding: 7,
      width: 440,
      minWidth: 390,
      height: 310,
      minHeight: 245,
      showMinimize: false,
      showMaximize: false,
      allowMinimize: false,
      allowMaximize: false,
      resizable: true,
      movable: true,
      useMoveFrame: true,
      alwaysOnTop: false
    });
    const compactGoal = new qx.ui.form.SelectBox().set({ width: 225 });
    for (const [name, id] of [
      ['Destroy Construction Yard (CY)', 'cy'],
      ['Destroy Defense Facility (DF)', 'df'],
      ['Destroy Command Center (CC)', 'cc'],
      ['Maximize Defense Damage', 'defense'],
      ['Maximize Research Points (RP)', 'rp']
    ]) compactGoal.add(new qx.ui.form.ListItem(name, null, id));
    const compactSearchMode = new qx.ui.form.SelectBox().set({ width: 145 });
    compactSearchMode.add(new qx.ui.form.ListItem('Formation', null, 'formation'));
    compactSearchMode.add(new qx.ui.form.ListItem('Greedy Sim', null, 'greedy'));
    const compactSearchTime = new qx.ui.form.Spinner(1, 30, 600).set({
      singleStep: 1, pageStep: 10, width: 78,
      toolTipText: 'Number of simulations; each simulation represents about 3 seconds'
    });
    const compactSearchTimeLabel = label(qx, '1:30', { width: 38 });
    const compactRecommend = new qx.ui.form.Button('Simulate');
    const compactPauseRecommendation = new qx.ui.form.Button('Pause').set({ enabled: false });
    const compactTop = new qx.ui.container.Composite(new qx.ui.layout.Flow(5, 4));
    compactTop.add(label(qx, 'Goal'));
    compactTop.add(compactGoal, { flex: 1 });
    compactTop.add(compactSearchMode);
    compactTop.add(compactSearchTime);
    compactTop.add(compactSearchTimeLabel);
    compactTop.add(compactRecommend);
    compactTop.add(compactPauseRecommendation);
    compactPlannerWindow.add(compactTop);

    const compactPresetName = new qx.ui.form.TextField().set({ width: 120, placeholder: 'Formation name' });
    const compactPresetSelect = new qx.ui.form.SelectBox().set({ width: 140 });
    const compactSavePreset = new qx.ui.form.Button('Save');
    const compactLoadPreset = new qx.ui.form.Button('Load').set({ enabled: false });
    const compactDeletePreset = new qx.ui.form.Button('Delete').set({ enabled: false });
    const compactPresets = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    compactPresets.add(label(qx, 'Presets'));
    compactPresets.add(compactPresetName);
    compactPresets.add(compactSavePreset);
    compactPresets.add(compactPresetSelect, { flex: 1 });
    compactPresets.add(compactLoadPreset);
    compactPresets.add(compactDeletePreset);
    compactPlannerWindow.add(compactPresets);

    compactPlannerResult = label(qx,
      '<b>Formation Optimizer</b><br><span style="color:#52636b">Choose a goal and run a simulation to watch its progress.</span>', {
      rich: true,
      padding: 8,
      allowGrowX: true,
      allowGrowY: true,
      textColor: '#17262d',
      backgroundColor: '#d9ece1'
    });
    const compactResultScroll = new qx.ui.container.Scroll().set({
      scrollbarX: 'off', scrollbarY: 'auto', minHeight: 125
    });
    compactResultScroll.add(compactPlannerResult);
    compactPlannerWindow.add(compactResultScroll, { flex: 1 });
    const compactLiveActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    const compactReplayLive = new qx.ui.form.Button('▶ Sim').set({ enabled: false });
    const compactUseLive = new qx.ui.form.Button('Use').set({ enabled: false });
    compactLiveActions.add(compactReplayLive);
    compactLiveActions.add(compactUseLive);
    compactPlannerWindow.add(compactLiveActions);
    const compactApplyFormation = new qx.ui.form.Button('Apply Formation').set({
      enabled: false,
      toolTipText: 'Move the active attack formation to the displayed optimized layout'
    });
    const applicationRoot = qx.core.Init.getApplication().getDesktop?.()
      ?? qx.core.Init.getApplication().getRoot?.();
    applicationRoot?.add?.(compactPlannerWindow, { left: 12, top: 150 });
    compactPlannerWindow.exclude();

    comparisonWindow = new qx.ui.window.Window(`History v${moduleVersion}`).set({
      layout: new qx.ui.layout.Canvas(),
      appearance: 'window-chat',
      padding: 0,
      width: 390,
      minWidth: 320,
      height: 620,
      minHeight: 320,
      showMinimize: false,
      showMaximize: false,
      showClose: true,
      allowMinimize: false,
      allowMaximize: false,
      resizable: true,
      movable: true,
      useMoveFrame: true,
      alwaysOnTop: false
    });
    try {
      comparisonWindow.setDecorator?.('window-chat-pane');
      comparisonWindow.setBackgroundColor?.('#050707');
      const captionbar = comparisonWindow.getChildControl?.('captionbar');
      const captionTitle = comparisonWindow.getChildControl?.('title');
      const contentPane = comparisonWindow.getChildControl?.('pane');
      captionbar?.set?.({
        decorator: null, minHeight: 21, height: 21, padding: 0, zIndex: 20
      });
      captionTitle?.set?.({
        decorator: 'chat-window-movebar-inactive',
        width: 128, minWidth: 128, maxWidth: 128,
        height: 21, minHeight: 21, maxHeight: 21,
        marginLeft: 2, marginTop: 4,
        textAlign: 'center', cursor: 'default'
      });
      contentPane?.set?.({
        padding: 0,
        decorator: null,
        backgroundColor: null
      });
      const historyIcon = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/2a8928214c62d8207ba502a600cfa368.png';
      const lockIcon = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/ebb128a345118cb0256f1e92bd0e1bc0.png';
      comparisonHistoryButton = new qx.ui.form.Button('Top 10').set({
        width: 58, minWidth: 58, maxWidth: 58,
        height: 21, minHeight: 21, maxHeight: 21,
        marginLeft: 3, marginTop: 4,
        appearance: 'button-friendlist-scroll',
        toolTipText: 'Open the ten best cached simulations'
      });
      const lockButton = new qx.ui.form.Button(null, lockIcon).set({
        width: 21, minWidth: 21, maxWidth: 21,
        height: 21, minHeight: 21, maxHeight: 21,
        marginLeft: 4, marginRight: 3, marginTop: 4,
        appearance: 'button-friendlist-scroll', show: 'icon',
        toolTipText: 'Lock this panel in place'
      });
      captionbar?.add?.(comparisonHistoryButton, { row: 0, column: 4 });
      captionbar?.add?.(lockButton, { row: 0, column: 5 });
      comparisonWindow.addListenerOnce('appear', () => {
        const captionElement = captionbar?.getContentElement?.().getDomElement?.();
        if (captionElement) captionElement.style.overflow = 'visible';
      });
      let panelLocked = false;
      lockButton.addListener('execute', () => {
        panelLocked = !panelLocked;
        comparisonWindow.setMovable(!panelLocked);
        lockButton.setOpacity(panelLocked ? 0.65 : 1);
        lockButton.setToolTipText(panelLocked ? 'Unlock this panel' : 'Lock this panel in place');
      });
    } catch {
      // The standard game window decoration remains usable on older themes.
    }
    comparisonResults = new qx.ui.container.Composite(new qx.ui.layout.HBox(6)).set({
      padding: 0, backgroundColor: null
    });
    const comparisonScroll = new qx.ui.container.Scroll().set({
      scrollbarX: 'auto', scrollbarY: 'auto', padding: 0
    });
    comparisonScroll.add(comparisonResults);
    comparisonWindow.add(comparisonScroll, { left: 5, right: 5, top: 26, bottom: 5 });
    applicationRoot?.add?.(comparisonWindow, { left: 12, top: 80 });
    comparisonWindow.addListenerOnce('appear', () => {
      comparisonWindow.getContentElement?.().getDomElement?.()
        ?.setAttribute?.('data-cnc-ta-war-room-history-window', 'true');
    });
    comparisonWindow.exclude();
    const openHistory = () => {
      comparisonReduced = true;
      comparisonRenderSignature = '';
      comparisonWindow.set({ width: 390, height: 620 });
      renderSimulations();
      comparisonWindow.open();
    };

    historyWindow = new qx.ui.window.Window(`Top 10 v${moduleVersion}`).set({
      layout: new qx.ui.layout.Canvas(),
      appearance: 'window-chat',
      padding: 0,
      width: 735,
      minWidth: 360,
      height: 837,
      minHeight: 837,
      maxHeight: 837,
      showMinimize: false,
      showMaximize: false,
      showClose: true,
      allowMinimize: false,
      allowMaximize: false,
      resizable: true,
      movable: true,
      useMoveFrame: true,
      alwaysOnTop: false
    });
    try {
      historyWindow.setDecorator?.('window-chat-pane');
      historyWindow.setBackgroundColor?.('#050707');
      historyWindow.getChildControl?.('pane')?.set?.({
        padding: 0, decorator: null, backgroundColor: null
      });
    } catch {}
    historyResults = new qx.ui.container.Composite(new qx.ui.layout.HBox(6)).set({
      minHeight: 800, padding: 0, backgroundColor: null
    });
    const historyScroll = new qx.ui.container.Scroll().set({
      scrollbarX: 'auto', scrollbarY: 'auto', padding: 0
    });
    historyScroll.add(historyResults);
    historyWindow.add(historyScroll, { left: 5, right: 5, top: 26, bottom: 5 });
    applicationRoot?.add?.(historyWindow, { left: 12, top: 80 });
    historyWindow.exclude();
    comparisonHistoryButton?.addListener('execute', () => {
      comparisonRenderSignature = '';
      renderSimulations();
      const bounds = comparisonWindow.getContentElement?.().getDomElement?.()?.getBoundingClientRect?.();
      if (bounds) {
        historyWindow.setLayoutProperties?.({
          left: Math.round(bounds.right + 2),
          top: Math.round(bounds.top)
        });
      }
      historyWindow.open();
    });

    const installNativeHistoryControl = () => {
      if (nativeHistoryControl?.isConnected) return;
      const nativeTop = [...(globalThis.document?.querySelectorAll?.('.qx-pane-sim-top') ?? [])]
        .find((element) => !comparisonResults?.getContentElement?.().getDomElement?.()?.contains?.(element));
      if (!nativeTop) return;
      nativeSimulationContentElement = nativeTop;
      if (
        nativeTop.offsetParent == null
        || globalThis.getComputedStyle?.(nativeTop)?.display === 'none'
      ) return;
      let panel = nativeTop.parentElement;
      for (let depth = 0; panel?.parentElement && depth < 6; depth += 1) {
        const bounds = panel.getBoundingClientRect?.();
        if (bounds?.height >= 820 && bounds?.width >= 175 && bounds?.width <= 240) break;
        panel = panel.parentElement;
      }
      if (!panel || panel.querySelector?.('[data-cnc-ta-war-room-history]')) return;
      nativeSimulationPanelElement = panel;
      const control = globalThis.document.createElement('button');
      control.type = 'button';
      control.dataset.cncTaWarRoomHistory = 'true';
      control.textContent = 'History';
      control.title = 'Show every cached simulation for this target';
      control.style.cssText = 'position:absolute;left:3px;top:4px;width:128px;height:21px;z-index:1000;'
        + 'padding:0;border:0;color:#d8eef5;font:bold 12px "Lucida Grande";cursor:pointer;'
        + 'background:linear-gradient(#12647c,#063747);border-radius:3px;';
      control.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bounds = panel.getBoundingClientRect?.();
        if (bounds) {
          comparisonWindow.setLayoutProperties?.({
            left: Math.round(bounds.right + 2),
            top: Math.round(bounds.top)
          });
        }
        openHistory();
      });
      panel.style.position = panel.style.position || 'relative';
      panel.appendChild(control);
      nativeHistoryControl = control;
    };
    let syncingCompactControls = false;
    const syncSelection = (source, target) => {
      if (syncingCompactControls) return;
      const model = source.getSelection?.()?.[0]?.getModel?.();
      const match = target.getChildren?.().find((item) => String(item.getModel?.()) === String(model));
      if (!match) return;
      syncingCompactControls = true;
      target.setSelection([match]);
      syncingCompactControls = false;
    };
    plannerGoal.addListener('changeSelection', () => syncSelection(plannerGoal, compactGoal));
    compactGoal.addListener('changeSelection', () => syncSelection(compactGoal, plannerGoal));
    const updateSearchModeLabel = () => {
      const greedy = searchMode.getSelection?.()?.[0]?.getModel?.() === 'greedy';
      recommend.setLabel(greedy ? 'Start Greedy Sim' : 'Simulate Best Formation');
      compactRecommend.setLabel(greedy ? 'Greedy Sim' : 'Simulate');
      plannerGoal.setEnabled(!greedy);
      compactGoal.setEnabled(!greedy);
      searchTime.setEnabled(!greedy);
      compactSearchTime.setEnabled(!greedy);
      searchTimeLabel.setEnabled(!greedy);
      compactSearchTimeLabel.setEnabled(!greedy);
    };
    searchMode.addListener('changeSelection', () => {
      syncSelection(searchMode, compactSearchMode);
      updateSearchModeLabel();
    });
    compactSearchMode.addListener('changeSelection', () => {
      syncSelection(compactSearchMode, searchMode);
      updateSearchModeLabel();
    });
    let syncingSearchTime = false;
    const formatSearchTime = (seconds) => {
      const value = Math.max(0, Math.round(Number(seconds) || 0));
      return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    };
    const syncSearchTime = (source, target) => {
      if (syncingSearchTime) return;
      syncingSearchTime = true;
      const value = Number(source.getValue?.() ?? 30);
      target.setValue?.(value);
      searchTimeLabel.setValue(formatSearchTime(value * 3));
      compactSearchTimeLabel.setValue(formatSearchTime(value * 3));
      syncingSearchTime = false;
    };
    searchTime.addListener('changeValue', () => syncSearchTime(searchTime, compactSearchTime));
    compactSearchTime.addListener('changeValue', () => syncSearchTime(compactSearchTime, searchTime));
    presetSelect.addListener('changeSelection', () => syncSelection(presetSelect, compactPresetSelect));
    compactPresetSelect.addListener('changeSelection', () => syncSelection(compactPresetSelect, presetSelect));
    presetName.addListener('changeValue', () => {
      if (!syncingCompactControls) compactPresetName.setValue(presetName.getValue());
    });
    compactPresetName.addListener('changeValue', () => {
      if (!syncingCompactControls) presetName.setValue(compactPresetName.getValue());
    });
    compactRecommend.addListener('execute', () => {
      if (optimizationRunning) cancelRecommendation();
      else if (compactSearchMode.getSelection?.()?.[0]?.getModel?.() === 'greedy') void simulateGreedyTroopByTroop();
      else void simulateRecommendation();
    });
    compactPauseRecommendation.addListener('execute', () => toggleRecommendationPause());
    compactApplyFormation.addListener('execute', () => {
      try {
        const units = displayedRecommendation?.grid?.flat().filter(Boolean) ?? [];
        if (!units.length) throw new Error('Simulate or load a formation first.');
        let snapshot = this.hub.snapshot();
        if (!snapshot.attacker?.id || !snapshot.target?.id) {
          throw new Error('Open a target attack screen first.');
        }
        compactApplyFormation.setEnabled(false);
        this.hub.applyRecommendedFormation(units);
        observedFormation = formationSignature(this.hub.snapshot());
        simulationCache.delete(simulationKey(this.hub.snapshot()));
        setPlannerResult(
          '<b>Formation Applied</b><br>'
          + '<span style="color:#237a38"><b>The optimized troop layout was moved into the active attack formation.</b></span>'
        );
        safeSetValue(compactPlannerResult,
          '<b>Formation Applied</b><br>'
          + '<span style="color:#237a38"><b>The optimized troop layout was moved into the active attack formation.</b></span>'
        );
        queueLiveSimulation();
      } catch (error) {
        setPlannerResult(
          '<b>Unable to Apply Formation</b><br>'
          + `<span style="color:#a32626">${escapeHtml(error?.message ?? error)}</span>`
        );
        safeSetValue(compactPlannerResult,
          '<b>Unable to Apply Formation</b><br>'
          + `<span style="color:#a32626">${escapeHtml(error?.message ?? error)}</span>`
        );
      } finally {
        compactApplyFormation.setEnabled(Boolean(displayedRecommendation));
      }
    });
    compactLoadPreset.addListener('execute', () => loadPreset.execute());
    compactDeletePreset.addListener('execute', () => deletePreset.execute());
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

    let formationPresets = [];
    const presetMatchesTarget = (preset, snapshot = this.hub.snapshot()) =>
      formationTargetMatches(preset?.target, snapshot.target);
    const selectedPreset = () => {
      const id = presetSelect.getSelection?.()?.[0]?.getModel?.();
      return formationPresets.find((preset) => String(preset.id) === String(id)) ?? null;
    };
    const renderPresets = (selectedId = null) => {
      if (!widgetAlive(presetSelect) || !widgetAlive(compactPresetSelect)) return;
      presetSelect.removeAll?.();
      compactPresetSelect.removeAll?.();
      let selectedItem = null;
      let compactSelectedItem = null;
      const snapshot = this.hub.snapshot();
      const attackerId = snapshot.attacker?.id;
      for (const preset of formationPresets.filter((item) =>
        String(item.attackerId) === String(attackerId)
        && presetMatchesTarget(item, snapshot)
      )) {
        const item = new qx.ui.form.ListItem(preset.name, null, preset.id);
        const compactItem = new qx.ui.form.ListItem(preset.name, null, preset.id);
        if (!widgetAlive(presetSelect) || !widgetAlive(compactPresetSelect)) return;
        presetSelect.add?.(item);
        compactPresetSelect.add?.(compactItem);
        if (String(preset.id) === String(selectedId)) {
          selectedItem = item;
          compactSelectedItem = compactItem;
        }
      }
      if (selectedItem) presetSelect.setSelection([selectedItem]);
      if (compactSelectedItem) compactPresetSelect.setSelection([compactSelectedItem]);
      const available = Boolean(presetSelect.getSelection?.()?.length);
      safeSetEnabled(loadPreset, available);
      safeSetEnabled(deletePreset, available);
      safeSetEnabled(compactLoadPreset, available);
      safeSetEnabled(compactDeletePreset, available);
    };
    const loadFormationPresets = async (selectedId = null) => {
      const loaded = await readFormationPresets(this.context.storage);
      if (buildDisposed) return;
      formationPresets = loaded;
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
    simulator.grid.widget.set({ height: 80, minHeight: 60, maxHeight: 150 });
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
    search.grid.widget.exclude();
    const updateSearchResultHeight = (count) => {
      const rows = Math.max(0, Math.floor(Number(count) || 0));
      if (!rows) {
        search.grid.widget.exclude();
        return;
      }
      const height = 30 + rows * 24;
      search.grid.widget.set({ height, minHeight: height, maxHeight: height });
      search.grid.widget.show();
    };
    let selectedSearchTarget = null;
    const targetControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const initialSnapshot = this.hub.snapshot();
    const initialOffenseLevel = Math.max(1, Math.round(Number(
      initialSnapshot.attacker?.offenseLevel || initialSnapshot.attacker?.level || 1
    )));
    const minLevel = new qx.ui.form.Spinner(1, initialOffenseLevel, 100).set({ width: 65 });
    const maxLevel = new qx.ui.form.Spinner(1, Math.min(100, initialOffenseLevel + 5), 100).set({ width: 65 });
    const maxCp = new qx.ui.form.Spinner(1, 41, 999).set({ width: 70 });
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
    const targetIntel = label(qx, targetIntelCard({ name: 'No target selected', x: '—', y: '—' }), {
      rich: true, textColor: '#17262d', padding: 2
    });
    const targetIntelScroll = new qx.ui.container.Scroll().set({ height: 245, minHeight: 180 });
    targetIntelScroll.add(targetIntel);
    search.page.add(targetIntelScroll);
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

    const settings = { page: new qx.ui.container.Composite(new qx.ui.layout.VBox(10)) };
    settings.page.set({ padding: 10 });
    settings.page.add(label(qx, 'Companion Windows', {
      font: 'bold',
      textColor: '#9edcff'
    }));
    settings.page.add(label(qx,
      'These compact windows supplement the full War Room. Each can be shown or hidden independently without changing the main War Room pages.',
      { wrap: true, textColor: '#d5e2e8' }
    ));
    const companionBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(8)).set({
      padding: 10,
      backgroundColor: '#27333a',
      decorator: new qx.ui.decoration.Decorator(1, 'solid', '#667780')
    });
    const formationControlsSetting = new qx.ui.form.CheckBox('Formation Controls').set({
      textColor: '#ffffff',
      toolTipText: 'Show the movable formation-control palette while a target attack setup is open.'
    });
    const compactPlannerSetting = new qx.ui.form.CheckBox('Formation Optimizer').set({
      textColor: '#ffffff',
      toolTipText: 'Show the compact best-formation and saved-preset window beside the attack view.'
    });
    companionBox.add(formationControlsSetting);
    companionBox.add(label(qx,
      'Movable troop controls for simulation, formation movement, troop visibility, reset, and saved formations.',
      { textColor: '#b8c8cf', paddingLeft: 22 }
    ));
    companionBox.add(compactPlannerSetting);
    companionBox.add(label(qx,
      'Attack goal, simulation count, saved formations, and a scrollable live optimizer activity view without the troop grid.',
      { textColor: '#b8c8cf', paddingLeft: 22 }
    ));
    settings.page.add(companionBox);
    const settingsStatus = label(qx, '', { textColor: '#8fdda8' });
    settings.page.add(settingsStatus);
    settings.page.add(new qx.ui.core.Spacer(), { flex: 1 });
    let loadingCompanionSettings = true;
    const persistCompanionSettings = () => {
      if (loadingCompanionSettings) return;
      companionSettings = normalizeWarRoomCompanionSettings({
        formationControls: formationControlsSetting.getValue(),
        compactSimulationOutcome: false,
        compactAttackPlanner: compactPlannerSetting.getValue()
      });
      void this.context.storage?.set?.(WAR_ROOM_COMPANION_SETTINGS_KEY, companionSettings);
      this.context.eventBus?.emit?.('war-room:companion-settings-changed', companionSettings);
      if (!companionSettings.compactAttackPlanner) compactPlannerWindow.exclude();
      comparisonWindow.exclude();
      historyWindow.exclude();
      if (attackCompanionsRequested) {
        compactPlannerWindow.exclude();
      }
      settingsStatus.setValue('Companion-window settings saved.');
    };
    formationControlsSetting.addListener('changeValue', persistCompanionSettings);
    compactPlannerSetting.addListener('changeValue', persistCompanionSettings);
    void this.context.storage?.get?.(
      WAR_ROOM_COMPANION_SETTINGS_KEY,
      DEFAULT_WAR_ROOM_COMPANION_SETTINGS
    ).then((saved) => {
      companionSettings = normalizeWarRoomCompanionSettings(saved);
      formationControlsSetting.setValue(companionSettings.formationControls);
      compactPlannerSetting.setValue(companionSettings.compactAttackPlanner);
      loadingCompanionSettings = false;
      if (attackCompanionsRequested) {
        compactPlannerWindow.exclude();
        comparisonWindow.exclude();
        historyWindow.exclude();
      }
      settingsStatus.setValue('Settings apply whenever an attack setup is open.');
    });

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
    // The optimizer controls and results now live on the simulator page. The
    // large editable troop grid and troop-movement/apply sections stay out of
    // the War Room; formation changes belong in the game attack screen.
    simulator.page.addAt(plannerControls, 0);
    simulator.page.addAt(presetControls, 1);
    const runSimulations = new qx.ui.form.Button('Simulate & Play');
    const sideControls = new qx.ui.container.Stack();
    const sideControlPanels = new Map();
    const addSidePanel = (id, title, widgets) => {
      const panel = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({
        paddingTop: 8,
        paddingBottom: 8
      });
      panel.add(label(qx, title, { font: 'bold', textColor: '#9edcff' }));
      for (const widget of widgets) {
        widget.getLayoutParent?.()?.remove?.(widget);
        if (widget instanceof qx.ui.container.Composite) {
          widget.setLayout?.(new qx.ui.layout.VBox(4));
        }
        panel.add(widget);
      }
      sideControlPanels.set(id, panel);
      sideControls.add(panel);
    };
    addSidePanel('search', 'Search Controls', [targetControls, searchExportControls]);
    addSidePanel('simulator', 'Simulator Controls', [plannerControls, presetControls, runSimulations]);
    addSidePanel('reports', 'Report Controls', [reportActions]);
    addSidePanel('army', 'Army Controls', [armyControls]);
    addSidePanel('stats', 'Statistics Controls', [statsControls]);
    addSidePanel('settings', 'Settings Controls', [companionBox]);
    sectionControlsHost.add(sideControls);
    selectSectionControls = (id) => {
      const panel = sideControlPanels.get(id);
      if (panel) sideControls.setSelection([panel]);
    };
    selectSectionControls(activeSectionId);
    for (const widget of [formationVisual.widget, formationLegendSection, formationTools, unitTools, bulkTools, experimentalBox]) {
      widget.exclude?.();
    }
    for (const [id, value] of Object.entries({ search, simulator, reports, army, stats, settings })) {
      pages.set(id, value);
      stack.add(value.page);
    }

    const simulatorActions = new qx.ui.container.Composite(new qx.ui.layout.VBox(8));
    const simulatorText = label(qx, 'Open a target in combat setup to begin live native simulation.');
    const cachedResultsTitle = label(qx, 'Live formation and best result', { font: 'bold' });
    const cachedResultsLayout = new qx.ui.layout.Grid(6, 0);
    cachedResultsLayout.setColumnWidth(0, 158);
    cachedResultsLayout.setColumnWidth(1, 158);
    const cachedResults = new qx.ui.container.Composite(cachedResultsLayout);
    const liveFormationCard = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({
      width: 158, minWidth: 158, maxWidth: 158
    });
    const bestSoFarCard = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({
      width: 158, minWidth: 158, maxWidth: 158
    });
    const showHistory = new qx.ui.form.Button('History ▸').set({
      width: 92,
      height: 24,
      minHeight: 24,
      maxHeight: 24,
      allowGrowY: false,
      alignY: 'top',
      toolTipText: 'Open recent cached simulation results'
    });
    showHistory.addListener('execute', () => {
      const bounds = showHistory.getContentElement?.().getDomElement?.()?.getBoundingClientRect?.();
      if (bounds) comparisonWindow.setLayoutProperties?.({
        left: Math.round(bounds.right + 4),
        top: Math.max(30, Math.round(bounds.top - 24))
      });
      openHistory();
    });
    cachedResults.add(liveFormationCard, { row: 0, column: 0 });
    cachedResults.add(bestSoFarCard, { row: 0, column: 1 });
    cachedResults.add(showHistory, { row: 0, column: 2 });
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
    simulatorActions.add(cachedResultsTitle);
    simulatorActions.add(cachedResults);
    sideControlPanels.get('simulator')?.add(settingsRow);
    // keyValuePage initially inserts its table first. Move it below the
    // history/live-formation row so detailed results span the full page width.
    simulator.page.remove(simulator.grid.widget);
    simulatorActions.add(label(qx, 'Simulation result table', { font: 'bold' }));
    simulatorActions.add(simulator.grid.widget);
    simulator.page.add(simulatorActions);
    void this.context.storage?.get?.(simulatorSettingsKey, simulatorSettings).then((saved) => {
      Object.assign(simulatorSettings, saved ?? {});
      for (const [key, check] of Object.entries(settingChecks)) check.setValue(Boolean(simulatorSettings[key]));
    });

    const overview = new qx.ui.container.Composite(new qx.ui.layout.VBox(8));
    overview.set({ width: 252, minWidth: 220, maxWidth: 310, padding: 8 });
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
    simulator.page.addAt(plannerStatus, 2);
    const workspace = new qx.ui.container.Composite(new qx.ui.layout.HBox(0));
    const pageScroll = new qx.ui.container.Scroll().set({
      scrollbarX: 'auto',
      scrollbarY: 'auto',
      minWidth: 0,
      minHeight: 0
    });
    pageScroll.add(stack);
    workspace.add(toolbar);
    workspace.add(pageScroll, { flex: 1 });
    root.add(workspace, { flex: 1 });
    const footer = label(qx, 'Select a target in the game, then refresh War Room.');
    root.add(footer);

    const render = () => {
      if (buildDisposed || !widgetAlive(planner.grid.widget)) return;
      try {
        let snapshot = this.hub.snapshot();
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
        if (!this.searchResults) {
          search.grid.model.setData([]);
          updateSearchResultHeight(0);
        }
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
        } else if (activeSectionId === 'planner' || activeSectionId === 'simulator') {
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
          const resourceNames = Object.fromEntries(Object.entries(snapshot.resourceTypes ?? {})
            .filter(([, type]) => typeof type === 'number')
            .map(([name, type]) => [String(type), name === 'Gold' ? 'Credits' : name]));
          const loadedLoot = Object.entries(snapshot.loot ?? {})
            .filter(([, amount]) => Number(amount) > 0)
            .map(([type, amount]) => ({
              type: Number(type),
              name: resourceNames[String(type)] ?? `Resource ${type}`,
              amount: Number(amount)
            }));
          const averageCondition = (entities) => entities.length
            ? entities.reduce((sum, entity) => sum + Number(entity.health ?? 0), 0) / entities.length
            : null;
          targetIntel.setValue(targetIntelCard({
            ...snapshot.target,
            cp: snapshot.cpCost,
            attacker: snapshot.attacker?.name,
            attackEstimate: snapshot.attackEstimate,
            loot: loadedLoot,
            baseCondition: averageCondition(snapshot.buildings ?? []),
            defenseCondition: averageCondition(snapshot.defenseUnits ?? [])
          }));
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
    let liveSimulationRetryFormation = null;
    let liveSimulationRetryCount = 0;
    let playSimulationQueued = false;
    let optimizationRunning = false;
    let optimizationPaused = false;
    let recommendationSequence = 0;
    let liveFormationSequence = 0;
    let observedTargetId = null;
    let observedAttackerId = null;
    let observedFormation = null;
    const simulationCache = new Map();
    const cacheSimulation = (key, entry) => {
      simulationCache.set(key, { goal: entry.goal ?? selectedGoal(), ...entry });
    };
    const hasCachedSimulationFor = (snapshot) => {
      const targetId = String(snapshot?.target?.id ?? '');
      if (!targetId) return false;
      const attackerId = String(snapshot?.attacker?.id ?? '');
      const matchesTarget = (entry) => {
        if (String(entry?.target?.id ?? entry?.snapshot?.target?.id ?? '') !== targetId) return false;
        const cachedAttackerId = String(entry?.attacker?.id ?? entry?.snapshot?.attacker?.id ?? '');
        return !attackerId || !cachedAttackerId || cachedAttackerId === attackerId;
      };
      return [...simulationCache.values()].some(matchesTarget)
        || (this.stats?.history ?? []).some(matchesTarget);
    };
    this.selectOpeningSearchMode = () => {
      const snapshot = this.hub.snapshot();
      const model = hasCachedSimulationFor(snapshot) ? 'formation' : 'greedy';
      const selectModel = (control) => {
        const item = control.getChildren?.().find((candidate) => candidate.getModel?.() === model);
        if (item) control.setSelection([item]);
      };
      selectModel(searchMode);
      selectModel(compactSearchMode);
      updateSearchModeLabel();
    };
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
      if (buildDisposed || !widgetAlive(formationVisual.widget) || !recommendation?.grid) return;
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
      compactApplyFormation.setEnabled(Boolean(
        snapshot.attacker?.id
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
      // These objectives do not have stable public resource aliases across
      // worlds. Text glyphs avoid malformed /FactionUI URLs and their repeated
      // 405 requests while retaining compact visual identifiers.
      cy: '<span title="Construction Yard" style="color:#d99b2b">CY</span>',
      df: '<span title="Defense Facility" style="color:#d65f5f">DF</span>',
      dhq: '<span title="Defense HQ" style="color:#65a9dd">HQ</span>',
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
      const section = (title) => `<div style="font-weight:700;color:#273b44;margin-top:11px;margin-bottom:3px">${title}</div>`;
      const repairCell = (group, icon) => `<td style="width:33%;text-align:center;vertical-align:top;padding:3px">`
        + `<b>${icon}</b><br>`
        + `${icons.crystal}${crystal(group)}<br>`
        + `${icons.repair}${escapeHtml(duration(repairGroups[group]))}<br>`
        + `${remaining(offense[group]?.remainingPercent)} remaining</td>`;
      return `<div style="line-height:1.35"><b>Duration:</b> ${escapeHtml(duration(analysis?.durationSeconds))}<br>`
        + `<b>Outcome:</b> <span style="color:${/Victory/i.test(analysis?.outcome ?? '') ? '#19733a' : '#b32323'}"><b>${escapeHtml(analysis?.outcome ?? 'Unknown')}</b></span><br><br>`
        + (Number(analysis?.morale ?? 0) > 0
          ? `<b>Morale deficit:</b> <span style="color:#c46a14"><b>-${Number(analysis.morale).toFixed(0)}%</b></span> (${Number(analysis.moraleEffectiveness).toFixed(0)}% effectiveness)<br><br>`
          : '')
        + section('Defender')
        + `<b>Target State:</b> ${remaining(analysis?.defenderRemaining)}<br>`
        + `&nbsp;&nbsp;Structures: ${remaining(defender.structures?.remainingPercent)}<br>`
        + `&nbsp;&nbsp;Defensive Units: ${remaining(defender.defense?.remainingPercent)}<br>`
        + `${icons.cy}${remaining(analysis?.cyRemaining)}<br>`
        + `${icons.df}${remaining(analysis?.dfRemaining)}<br>`
        + `${icons.dhq}${remaining(analysis?.defenseHqRemaining)}<br>`
        + section('Loot')
        + `${icons.research}${Math.round(loot.research ?? 0).toLocaleString()}<br>`
        + `${icons.crystal}${Math.round(loot.crystal ?? 0).toLocaleString()}<br>`
        + `${icons.tiberium}${Math.round(loot.tiberium ?? 0).toLocaleString()}<br>`
        + `${icons.credits}${Math.round(loot.credits ?? 0).toLocaleString()}<br>`
        + `<b>Total: ${Math.round(analysis?.loot ?? 0).toLocaleString()}</b>`
        + section('Own Repair')
        + `<table style="width:100%;table-layout:fixed"><tr>${repairCell('aircraft', icons.aircraft)}${repairCell('vehicle', icons.vehicle)}${repairCell('infantry', icons.infantry)}</tr></table>`
        + `${icons.crystal}<b>Total:</b> ${Math.round(analysis?.repairCostResources?.crystal ?? 0).toLocaleString()}<br>`
        + `${icons.repair}<b>Total:</b> ${escapeHtml(duration(analysis?.repairSeconds))}`
        + section('Possible Attacks')
        + `CP: ${Math.round(Number(attackEstimate.commandPointAttacks ?? 0))}<br>`
        + `RT: ${escapeHtml(repairAttackText)}</div>`;
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

    const setCompactProcess = (value) => safeSetValue(compactPlannerResult, value);

    const simulateRecommendation = async () => {
      const runId = ++recommendationSequence;
      optimizationRunning = true;
      optimizationPaused = false;
      safeSetEnabled(recommend, true);
      safeSetEnabled(pauseRecommendation, true);
      safeSetEnabled(compactPauseRecommendation, true);
      pauseRecommendation.setLabel?.('Pause');
      compactPauseRecommendation.setLabel?.('Pause');
      recommend.setLabel?.('Stop Simulation');
      compactRecommend.setLabel?.('Stop');
      try {
        const snapshot = this.hub.snapshot();
        const goal = selectedGoal();
        const detail = Math.max(1, Math.floor(Number(searchTime.getValue?.() ?? 30)));
        const candidates = WarRoomCalculator.candidateFormations(snapshot, goal, detail);
        // A best-formation search is one self-contained comparison session.
        // Discard earlier/manual results, then retain every distinct candidate
        // from this run regardless of the requested simulation count.
        simulationCache.clear();
        this.displayedSimulationEntries = [];
        this.nativeSimulation = null;
        this.nativeSimulationReplay = null;
        liveFormationSequence = 0;
        renderSimulations();
        const updateSimulationCounter = (completed) => {
          const done = Math.max(0, Math.min(candidates.length, Number(completed) || 0));
          const remaining = candidates.length - done;
          recommend.setLabel?.(`Stop · ${remaining} left`);
          compactRecommend.setLabel?.(`Stop · ${remaining} left`);
          safeSetValue(plannerStatus,
            `${done}/${candidates.length} simulations complete · ${remaining} remaining`);
        };
        updateSimulationCounter(0);
        setPlannerResult(
          '<b>Best Formation Result</b><br>'
          + `<span style="color:#005f86">Comparing ${candidates.length} candidate formations…</span>`
        );
        let best = null;
        for (let index = 0; index < candidates.length; index += 1) {
          const candidate = candidates[index];
          if (buildDisposed || runId !== recommendationSequence) return;
          await waitForRecommendationResume(runId);
          if (buildDisposed || runId !== recommendationSequence) return;
          updateSimulationCounter(index);
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
          this.hub.applyRecommendedFormation(candidate.units);
          // Regular formation search is also a visual workflow. Publish each
          // candidate to the native grid and allow the game's battle setup to
          // settle before requesting the corresponding result.
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (buildDisposed || runId !== recommendationSequence) return;
          compactLiveEntry = null;
          compactReplayLive.setEnabled(false);
          compactUseLive.setEnabled(false);
          setCompactProcess(
            '<b>Current candidate</b><br>'
            + `<span style="color:#52636b">Simulating candidate ${index + 1} of ${candidates.length}…</span>`
          );
          await waitForRecommendationResume(runId);
          if (buildDisposed || runId !== recommendationSequence) return;
          const refreshedSnapshot = this.hub.snapshot();
          // Movement notifications can lag behind the optimizer loop. The
          // candidate itself is the authoritative formation submitted to the
          // native simulator, so use its exact coordinates for cache identity
          // instead of allowing stale snapshots to overwrite one cache slot.
          const liveSnapshot = {
            ...refreshedSnapshot,
            units: candidate.units.map((unit) => ({ ...unit }))
          };
          const cacheKey = simulationKey(liveSnapshot);
          let response = simulationCache.get(cacheKey)?.response ?? null;
          if (!response) {
            try {
              // Simulate the in-memory candidate directly. Repainting the
              // native formation for every test is unnecessary and becomes
              // prohibitively expensive across several browser instances.
              response = await this.hub.simulateFormation(candidate.units);
            } catch (error) {
              if (buildDisposed || runId !== recommendationSequence) return;
              safeSetValue(plannerStatus,
                `Candidate ${index + 1}/${candidates.length} was rejected by the game; continuing…`);
              if (index < candidates.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 3100));
              }
              continue;
            }
          }
          if (buildDisposed || runId !== recommendationSequence) return;
          const nativeAnalysis = WarRoomCalculator.analyzeNativeSimulation(
            response, liveSnapshot, candidate.name
          );
          const scored = WarRoomCalculator.scoreSimulation(response, liveSnapshot, goal);
          const targetDestroyed = /victory/i.test(String(nativeAnalysis.outcome ?? ''))
            && !/defeat/i.test(String(nativeAnalysis.outcome ?? ''));
          const result = {
            ...scored,
            oneShot: targetDestroyed || scored.oneShot,
            score: targetDestroyed ? -1_000_000_000_000_000 + scored.score : scored.score
          };
          cacheSimulation(cacheKey, {
            response, snapshot: liveSnapshot, at: Date.now(), name: candidate.name,
            source: 'optimizer', goal,
            units: liveSnapshot.units.map((unit) => ({ ...unit })), analysis: nativeAnalysis,
            rankScore: result.score
          });
          renderSimulations({ history: false });
          if (!best || result.score < best.result.score) {
            best = { candidate, result, response, snapshot: liveSnapshot };
          }
          updateSimulationCounter(index + 1);
          const candidateResult = simulationDetailsHtml(nativeAnalysis);
          setPlannerResult(
            '<b>Best Formation Result</b><br>'
            + '<span style="color:#005f86"><b>Simulation in progress</b></span><br><br>'
            + `<b>Candidate:</b> ${index + 1} of ${candidates.length}<br>`
            + `${candidateTestingHtml(candidate)}<br><br>`
            + `<b>Candidate result</b><br>${candidateResult}`
            + (best
              ? '<br><br><span style="color:#52636b">'
                + `<b>Best so far:</b><br>${escapeHtml(best.candidate.name)}`
                + '</span>'
              : '')
          );
          if (index < candidates.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3100));
            if (buildDisposed || runId !== recommendationSequence) return;
            await waitForRecommendationResume(runId);
            if (buildDisposed || runId !== recommendationSequence) return;
          }
        }
        if (!best) throw new Error('No formation could be simulated.');
        const originalActiveCount = best.candidate.units.length;
        let minimalUnits = best.candidate.units.map((unit) => ({ ...unit }));
        let minimalResult = best.result;
        let minimalResponse = best.response;
        let minimalSnapshot = best.snapshot;
        // Hiding troops is useful only after the selected formation has fully
        // destroyed the Construction Yard. If CY survives at all, retain the
        // complete formation and do not spend simulations minimizing force.
        const bestAnalysis = WarRoomCalculator.analyzeNativeSimulation(
          best.response, best.snapshot, best.candidate.name
        );
        const canHideTroops = allowsTroopHiding(bestAnalysis);
        const cyColumn = WarRoomCalculator.objective(best.snapshot, 'cy')?.x ?? 4;
        const revealOrder = canHideTroops
          ? orderForCyReveal(minimalUnits, cyColumn)
          : [];
        let activeCount = canHideTroops ? 0 : originalActiveCount;
        let revealSucceeded = false;
        if (canHideTroops) minimalUnits = minimalUnits.map((unit) => ({ ...unit, enabled: false }));
        for (let index = 0; index < revealOrder.length; index += 1) {
          if (buildDisposed || runId !== recommendationSequence) return;
          await waitForRecommendationResume(runId);
          const reveal = revealOrder[index];
          const revealId = String(reveal.entityId ?? reveal.id ?? reveal.mdbId);
          const trialUnits = minimalUnits.map((unit) => ({
            ...unit,
            enabled: String(unit.entityId ?? unit.id ?? unit.mdbId) === revealId ? true : unit.enabled === true
          }));
          activeCount = trialUnits.filter((unit) => unit.enabled !== false).length;
          safeSetValue(plannerStatus,
            `Minimum force · revealing ${reveal.name ?? 'troop'} · ${activeCount}/${originalActiveCount} active`);
          setPlannerResult(
            '<b>Minimum-force pass</b><br>'
            + `<span style="color:#005f86">Revealing ${escapeHtml(reveal.name ?? 'troop')} in its current position</span><br>`
            + `${activeCount} of ${originalActiveCount} troops active`
          );
          // Keep the reveal cumulative even if one native simulation request
          // fails; the next troop is added to every troop already revealed.
          minimalUnits = trialUnits;
          this.hub.applyRecommendedFormation(trialUnits);
          await new Promise((resolve) => setTimeout(resolve, 500));
          let response;
          try {
            response = await this.hub.simulateFormation(trialUnits);
          } catch {
            if (index < revealOrder.length - 1) await new Promise((resolve) => setTimeout(resolve, 3100));
            continue;
          }
          const trialSnapshot = { ...this.hub.snapshot(), units: trialUnits.map((unit) => ({ ...unit })) };
          const trialResult = WarRoomCalculator.scoreSimulation(response, trialSnapshot, goal);
          const trialAnalysis = WarRoomCalculator.analyzeNativeSimulation(
            response, trialSnapshot, `Reveal ${reveal.name ?? 'troop'}`
          );
          if (allowsTroopHiding(trialAnalysis)) {
            minimalResult = trialResult;
            minimalResponse = response;
            minimalSnapshot = trialSnapshot;
            revealSucceeded = true;
            break;
          }
          if (index < revealOrder.length - 1) await new Promise((resolve) => setTimeout(resolve, 3100));
        }
        if (canHideTroops && !revealSucceeded) {
          minimalUnits = best.candidate.units.map((unit) => ({ ...unit, enabled: true }));
          minimalResult = best.result;
          minimalResponse = best.response;
          minimalSnapshot = best.snapshot;
          activeCount = originalActiveCount;
        }
        const removed = Math.max(0, originalActiveCount - activeCount);
        best = {
          candidate: {
            ...best.candidate,
            name: removed > 0 ? `${best.candidate.name} · minimum force` : best.candidate.name,
            units: minimalUnits
          },
          result: { ...minimalResult, oneShot: minimalResult.oneShot || minimalResult.objectivePercent <= 0.05 },
          response: minimalResponse,
          snapshot: minimalSnapshot
        };
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
        showSimulationResult(analysis, {
          name: best.candidate.name,
          oneShot: best.result.oneShot,
          note: canHideTroops
            ? `Ranked by native battle simulation. Minimum-force pass hid ${removed} unnecessary troop${removed === 1 ? '' : 's'}; ${originalActiveCount - removed} remain active.`
            : 'Ranked by native battle simulation. CY remained above 0%, so no troops were hidden.'
        });
        this.hub.applyRecommendedFormation(best.candidate.units);
        observedFormation = formationSignature(this.hub.snapshot());
        this.context.eventBus?.emit?.('war-room:show-native-simulation');
        globalThis.ClientLib?.API?.Battleground?.GetInstance?.()?.SimulateBattle?.();
        safeSetValue(plannerStatus, canHideTroops
          ? `Best formation found with minimum force: ${originalActiveCount - removed} of ${originalActiveCount} troops active.`
          : `Best formation found with all ${originalActiveCount} troops active; CY remained above 0%.`);
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
          optimizationPaused = false;
          safeSetEnabled(recommend, true);
          safeSetEnabled(pauseRecommendation, false);
          safeSetEnabled(compactPauseRecommendation, false);
          pauseRecommendation.setLabel?.('Pause');
          compactPauseRecommendation.setLabel?.('Pause');
          updateSearchModeLabel();
          renderSimulations();
          if (!buildDisposed && liveSimulationQueued) queueLiveSimulation();
        }
      }
    };

    const simulateGreedyTroopByTroop = async () => {
      const runId = ++recommendationSequence;
      optimizationRunning = true;
      optimizationPaused = false;
      safeSetEnabled(recommend, true);
      safeSetEnabled(compactRecommend, true);
      safeSetEnabled(pauseRecommendation, true);
      safeSetEnabled(compactPauseRecommendation, true);
      recommend.setLabel?.('Stop Greedy Sim');
      compactRecommend.setLabel?.('Stop');
      pauseRecommendation.setLabel?.('Pause');
      compactPauseRecommendation.setLabel?.('Pause');
      const identity = (unit) => String(unit.entityId ?? unit.id ?? unit.mdbId);
      try {
        let snapshot = this.hub.snapshot();
        if (!snapshot.target?.id || !snapshot.attacker?.id || !snapshot.units?.length) {
          throw new Error('Open a target attack screen with an offensive formation first.');
        }
        const ordered = orderWeakestFirst(snapshot.units);
        const total = totalGreedySimulations(ordered.length);
        const locked = new Map();
        const manuallyLocked = new Set();
        let appliedUnits = snapshot.units.map((unit) => ({ ...unit }));
        const reconcilePausedFormation = () => {
          const live = this.hub.snapshot();
          const edits = manualFormationEdits(appliedUnits, live.units);
          for (const [unitId, edit] of edits) {
            locked.set(unitId, edit);
            manuallyLocked.add(unitId);
          }
          if (!edits.size) return;
          const liveById = new Map((live.units ?? []).map((unit) => [identity(unit), unit]));
          snapshot = {
            ...snapshot,
            units: snapshot.units.map((unit) => ({
              ...unit,
              ...(liveById.get(identity(unit)) ?? {})
            }))
          };
          appliedUnits = snapshot.units.map((unit) => ({ ...unit }));
          safeSetValue(plannerStatus,
            `Greedy Sim retained ${edits.size} manually edited troop${edits.size === 1 ? '' : 's'} and resumed.`);
        };
        let completed = 0;
        let finalBest = null;
        simulationCache.clear();
        this.displayedSimulationEntries = [];
        this.nativeSimulation = null;
        this.nativeSimulationReplay = null;
        liveFormationSequence = 0;
        renderSimulations();
        for (let troopIndex = 0; troopIndex < ordered.length; troopIndex += 1) {
          const troop = ordered[troopIndex];
          if (manuallyLocked.has(identity(troop))) continue;
          let stageBest = null;
          const cells = stageCells(locked);
          for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
            if (completed >= total) break;
            if (buildDisposed || runId !== recommendationSequence) return;
            await waitForRecommendationResume(runId, reconcilePausedFormation);
            if (buildDisposed || runId !== recommendationSequence) return;
            if (manuallyLocked.has(identity(troop))) break;
            const cell = cells[cellIndex];
            const units = greedyCandidate({
              units: snapshot.units, orderedUnits: ordered, locked, activeUnit: troop, cell
            });
            const name = `Greedy ${troop.name} at ${cell.x + 1}:${cell.y + 1}`;
            const remainingCount = total - completed;
            recommend.setLabel?.(`Stop · ${remainingCount} left`);
            compactRecommend.setLabel?.(`Stop · ${remainingCount} left`);
            safeSetValue(plannerStatus,
              `Greedy Sim ${completed}/${total}: troop ${troopIndex + 1}/${ordered.length}, `
              + `${troop.name}, column ${cell.x + 1}, row ${cell.y + 1}.`);
            setPlannerResult(
              '<b>Greedy Sim</b><br>'
              + `<span style="color:#005f86">${escapeHtml(name)}</span><br><br>`
              + `${completed}/${total} simulations complete`
              + (stageBest ? `<br>Best RP for this troop: ${Math.round(stageBest.score.research).toLocaleString()}` : '')
            );
            appliedUnits = units.map((unit) => ({ ...unit }));
            this.hub.applyRecommendedFormation(units);
            // The visible native grid is an intentional part of this mode:
            // users can pause after any candidate, inspect troop pulling and
            // replay its completed result. Allow its battle setup to settle.
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (buildDisposed || runId !== recommendationSequence) return;
            let response;
            try {
              response = await this.hub.simulateFormation(units);
            } catch (error) {
              safeSetValue(plannerStatus, `${name} was rejected by the game; continuing…`);
              completed += 1;
              if (completed < total) await new Promise((resolve) => setTimeout(resolve, 3100));
              continue;
            }
            const liveSnapshot = { ...this.hub.snapshot(), units: units.map((unit) => ({ ...unit })) };
            const analysis = WarRoomCalculator.analyzeNativeSimulation(response, liveSnapshot, name);
            const scored = scoreMaximumResearch(analysis);
            const entry = {
              response, snapshot: liveSnapshot, at: Date.now(), name,
              source: 'optimizer', goal: 'rp', units: liveSnapshot.units, analysis,
              rankScore: scored.score
            };
            cacheSimulation(simulationKey(liveSnapshot), entry);
            if (!stageBest || scored.score < stageBest.score.score) {
              stageBest = { cell, units: liveSnapshot.units, response, analysis, score: scored, entry };
            }
            completed += 1;
            renderSimulations({ history: false });
            await waitForRecommendationResume(runId, reconcilePausedFormation);
            if (manuallyLocked.has(identity(troop))) break;
            if (completed < total) await new Promise((resolve) => setTimeout(resolve, 3100));
          }
          if (manuallyLocked.has(identity(troop))) continue;
          if (!stageBest) throw new Error(`Every position was rejected for ${troop.name}.`);
          locked.set(identity(troop), stageBest.cell);
          finalBest = stageBest;
          appliedUnits = stageBest.units.map((unit) => ({ ...unit }));
          this.hub.applyRecommendedFormation(stageBest.units);
          if (completed >= total) break;
        }
        // Preserve manual edits made during a pause. If the last retained edit
        // changed the formation after the most recent candidate result, run
        // one final native simulation so the displayed analysis matches it.
        const finalUnits = appliedUnits.map((unit) => ({ ...unit }));
        if (!finalUnits.length) throw new Error('No greedy formation completed.');
        if (!finalBest || formationSignature({ units: finalBest.units }) !== formationSignature({ units: finalUnits })) {
          const response = await this.hub.simulateFormation(finalUnits);
          const finalSnapshot = { ...this.hub.snapshot(), units: finalUnits };
          const analysis = WarRoomCalculator.analyzeNativeSimulation(
            response, finalSnapshot, 'Greedy Sim retained formation'
          );
          const score = scoreMaximumResearch(analysis);
          finalBest = {
            units: finalUnits, response, analysis, score,
            entry: { name: 'Greedy Sim retained formation' }
          };
        }
        this.hub.applyRecommendedFormation(finalUnits);
        const recommendation = WarRoomCalculator.recommendFormation(
          { ...snapshot, units: finalUnits }, 'rp'
        );
        const grid = Array.from({ length: 4 }, () => Array(9).fill(null));
        for (const unit of finalUnits) grid[unit.y][unit.x] = { ...unit };
        showRecommendation({ ...recommendation, grid });
        observedFormation = formationSignature({ units: finalUnits });
        showSimulationResult(finalBest.analysis, {
          title: 'Greedy Sim Result',
          name: finalBest.entry.name,
          note: `${locked.size} troop(s) locked after ${completed} native simulations. The best completed formation is active.`
        });
        renderSimulations();
        safeSetValue(plannerStatus,
          `Greedy Sim complete: ${locked.size} troop(s) locked after ${completed} simulations.`);
      } catch (error) {
        if (runId === recommendationSequence) {
          const message = `Greedy Sim failed: ${error?.message ?? error}`;
          safeSetValue(plannerStatus, message);
          setPlannerResult(`<b>Greedy Sim</b><br><span style="color:#a32626">${escapeHtml(message)}</span>`);
          this.context.logger?.warn?.('War Room Greedy Sim failed.', error);
        }
      } finally {
        if (runId === recommendationSequence) {
          optimizationRunning = false;
          optimizationPaused = false;
          safeSetEnabled(recommend, true);
          safeSetEnabled(compactRecommend, true);
          safeSetEnabled(pauseRecommendation, false);
          safeSetEnabled(compactPauseRecommendation, false);
          updateSearchModeLabel();
          pauseRecommendation.setLabel?.('Pause');
          compactPauseRecommendation.setLabel?.('Pause');
          if (!buildDisposed && liveSimulationQueued) queueLiveSimulation();
        }
      }
    };

    const waitForRecommendationResume = async (runId, onResume = null) => {
      let waited = false;
      while (optimizationPaused && runId === recommendationSequence && !buildDisposed) {
        waited = true;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (waited && runId === recommendationSequence && !buildDisposed) await onResume?.();
    };

    const toggleRecommendationPause = () => {
      if (!optimizationRunning) return false;
      optimizationPaused = !optimizationPaused;
      const caption = optimizationPaused ? 'Resume' : 'Pause';
      pauseRecommendation.setLabel?.(caption);
      compactPauseRecommendation.setLabel?.(caption);
      safeSetValue(plannerStatus, optimizationPaused
        ? 'Formation simulation paused after the current candidate. Manual formation edits will be retained on resume.'
        : 'Formation simulation resumed.');
      return optimizationPaused;
    };

    const cancelRecommendation = () => {
      if (!optimizationRunning) return false;
      recommendationSequence += 1;
      optimizationRunning = false;
      optimizationPaused = false;
      liveSimulationQueued = false;
      safeSetEnabled(recommend, true);
      safeSetEnabled(compactRecommend, true);
      updateSearchModeLabel();
      safeSetEnabled(pauseRecommendation, false);
      safeSetEnabled(compactPauseRecommendation, false);
      pauseRecommendation.setLabel?.('Pause');
      compactPauseRecommendation.setLabel?.('Pause');
      safeSetValue(plannerStatus, 'Formation simulation stopped.');
      setPlannerResult(
        '<b>Best Formation Result</b><br>'
        + '<span style="color:#8b4f00"><b>Simulation stopped by user.</b></span><br><br>'
        + '<span style="color:#52636b">Completed cached results remain available in Battle Simulator.</span>'
      );
      renderSimulations();
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
      try {
        this.hub.applyRecommendedFormation(entry.units);
        observedFormation = formationSignature(this.hub.snapshot());
        globalThis.ClientLib?.API?.Battleground?.GetInstance?.()?.SimulateBattle?.();
        simulatorText.setValue(`${result.label} applied to the active attack formation.`);
      } catch (error) {
        simulatorText.setValue(`Unable to use ${result.label}: ${error?.message ?? error}`);
      }
    };

    let cachedFormationApplySequence = 0;
    const applyCachedFormationToNativePanel = async (entry) => {
      if (!Array.isArray(entry?.units) || !entry.units.length) {
        throw new Error('This cached result does not contain a formation layout.');
      }
      const applyId = ++cachedFormationApplySequence;
      const expected = formationSignature({ units: entry.units });
      this.hub.applyRecommendedFormation(entry.units);
      let appliedSnapshot = this.hub.snapshot();
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (applyId !== cachedFormationApplySequence) return false;
        if (formationSignature(appliedSnapshot) === expected) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
        appliedSnapshot = this.hub.snapshot();
      }
      if (formationSignature(appliedSnapshot) !== expected) {
        throw new Error('The live formation did not settle into the cached layout.');
      }
      observedFormation = expected;
      globalThis.ClientLib?.API?.Battleground?.GetInstance?.()?.SimulateBattle?.();
      return true;
    };

    simulator.grid.widget.addListener('cellTap', (event) => {
      const row = Number(event.getRow?.() ?? event.getData?.()?.row ?? -1);
      const entry = this.displayedSimulationEntries?.[row];
      if (entry) loadCachedPreview(entry);
    });

    let compactLiveEntry = null;
    compactReplayLive.addListener('execute', () => {
      if (!compactLiveEntry?.response) return;
      try { this.hub.playSimulation(compactLiveEntry.response); }
      catch (error) { this.context.notifications?.show?.(`Unable to play simulation: ${error?.message ?? error}`, { level: 'error' }); }
    });
    compactUseLive.addListener('execute', () => {
      if (!Array.isArray(compactLiveEntry?.units) || !compactLiveEntry.units.length) return;
      try {
        this.hub.applyRecommendedFormation(compactLiveEntry.units);
        observedFormation = formationSignature(this.hub.snapshot());
        queueLiveSimulation();
      } catch (error) {
        this.context.notifications?.show?.(`Unable to use formation: ${error?.message ?? error}`, { level: 'error' });
      }
    });

    const renderSimulations = ({ history = true } = {}) => {
      if (!widgetAlive(simulator.grid.widget) || !widgetAlive(cachedResults)) return;
      const snapshot = this.hub.snapshot();
      const alternatives = [...simulationCache.values()].filter((entry) =>
        String(entry.snapshot?.target?.id) === String(snapshot.target?.id)
      ).map((entry) => ({ ...entry, analysis: entry.analysis
        ?? WarRoomCalculator.analyzeNativeSimulation(entry.response, entry.snapshot, entry.name ?? 'Cached') }));
      const rankedAlternatives = [...alternatives].sort((left, right) =>
        left.analysis.defenderRemaining - right.analysis.defenderRemaining
        || left.analysis.repairSeconds - right.analysis.repairSeconds
      );
      const bestAlternative = rankedAlternatives[0];
      this.displayedSimulationEntries = rankedAlternatives;
      const rows = rankedAlternatives.slice(0, 100).map((entry) => [
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
      if (history) simulator.grid.model.setData(rows);
      liveFormationCard.removeAll();
      bestSoFarCard.removeAll();
      liveFormationCard.add(label(qx, 'Live Formation', { font: 'bold' }));
      bestSoFarCard.add(label(qx, 'Best So Far', { font: 'bold' }));
      const createCachedResultCard = (entry, rankIndex) => {
        const result = entry.analysis;
        const card = new qx.ui.container.Composite(new qx.ui.layout.VBox(3)).set({
          width: 158, minWidth: 158, maxWidth: 158, padding: 6,
          cursor: 'pointer', toolTipText: 'Apply this cached formation to the active attack setup',
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
        replay.addListener('execute', (event) => {
          event.stopPropagation?.();
          try {
            this.hub.playSimulation(entry.response);
          } catch (error) {
            const message = `Unable to play ${result.label}: ${error?.message ?? error}`;
            simulatorText.setValue(message);
            this.context.notifications?.show?.(message, { level: 'error' });
          }
        });
        card.addListener('tap', () => loadCachedPreview(entry));
        use.addListener('execute', (event) => {
          event.stopPropagation?.();
          try {
            this.hub.applyRecommendedFormation(entry.units);
            simulatorText.setValue(`${result.label} formation applied to the active attack setup.`);
            const appliedSnapshot = this.hub.snapshot();
            observedFormation = formationSignature(appliedSnapshot);
            simulationCache.delete(simulationKey(appliedSnapshot));
            queueLiveSimulation();
          } catch (error) {
            simulatorText.setValue(`Unable to use ${result.label}: ${error?.message ?? error}`);
          }
        });
        actions.add(replay); actions.add(use); card.add(actions);
        return card;
      };
      const liveCacheEntry = simulationCache.get(simulationKey(snapshot));
      const exactCurrentEntry = alternatives.find((entry) => entry.response === liveCacheEntry?.response) ?? null;
      const currentEntry = exactCurrentEntry ?? alternatives.at(-1) ?? null;
      if (exactCurrentEntry) {
        compactLiveEntry = exactCurrentEntry;
        setCompactProcess(
          '<b>1. Live formation</b><br>'
          + simulationDetailsHtml(exactCurrentEntry.analysis)
        );
        compactReplayLive.setEnabled(Boolean(exactCurrentEntry.response));
        compactUseLive.setEnabled(Boolean(
          EXPERIMENTAL_ONE_CLICK_FORMATION_ENABLED
          && Array.isArray(exactCurrentEntry.units) && exactCurrentEntry.units.length
        ));
      } else {
        compactLiveEntry = null;
        compactReplayLive.setEnabled(false);
        compactUseLive.setEnabled(false);
        setCompactProcess(
          '<b>Current live formation</b><br>'
          + '<span style="color:#52636b">Running a native simulation for the active formation…</span>'
        );
      }
      const bestSoFarEntry = [...alternatives].sort((left, right) => {
        const leftScore = Number.isFinite(Number(left.rankScore))
          ? Number(left.rankScore)
          : WarRoomCalculator.scoreSimulation(
            left.response, left.snapshot, left.goal ?? selectedGoal()
          ).score;
        const rightScore = Number.isFinite(Number(right.rankScore))
          ? Number(right.rankScore)
          : WarRoomCalculator.scoreSimulation(
            right.response, right.snapshot, right.goal ?? selectedGoal()
          ).score;
        return leftScore - rightScore
          || Number(right.analysis?.research || 0) - Number(left.analysis?.research || 0)
          || Number(right.at || 0) - Number(left.at || 0);
      })[0] ?? null;
      if (currentEntry) {
        liveFormationCard.add(createCachedResultCard(currentEntry, rankedAlternatives.indexOf(currentEntry)));
      } else {
        liveFormationCard.add(label(qx, 'Waiting for the live formation result.', { textColor: '#344448' }));
      }
      if (bestSoFarEntry) {
        bestSoFarCard.add(createCachedResultCard(bestSoFarEntry, rankedAlternatives.indexOf(bestSoFarEntry)));
      } else {
        bestSoFarCard.add(label(qx, 'Waiting for completed simulations.', { textColor: '#344448' }));
      }
      if (!history) {
        simulatorText.setValue(this.nativeSimulation
          ? `Live result updated. ${alternatives.length} formation result(s) retained for ranking.`
          : `${alternatives.length} formation result(s) retained for ranking.`);
        return;
      }
      const recentAlternatives = [...alternatives].sort((left, right) => Number(right.at) - Number(left.at));
      const comparisonEntries = comparisonReduced
        ? recentAlternatives.slice(0, 10)
        : currentEntry ? [currentEntry] : [];
      const topTenEntries = rankedAlternatives.slice(0, 10);
      const nextComparisonSignature = JSON.stringify({
        reduced: comparisonReduced,
        target: snapshot.target?.id ?? null,
        entries: comparisonEntries.map((entry) => [
          entry.name, entry.analysis.outcome,
          entry.analysis.defenderRemaining, entry.analysis.ownRemaining,
          entry.analysis.loot, entry.analysis.repairSeconds
        ])
      });
      if (nextComparisonSignature === comparisonRenderSignature) {
        simulatorText.setValue(this.nativeSimulation
          ? `Live result for the current formation. ${alternatives.length} cached formation(s).`
          : 'Waiting for a native simulation result.');
        return;
      }
      comparisonRenderSignature = nextComparisonSignature;
      comparisonResults?.removeAll?.();
      historyResults?.removeAll?.();
      if (!comparisonEntries.length) {
        comparisonResults?.add?.(label(qx, 'Waiting for the first native simulation…', {
          textColor: '#344448', padding: 10
        }));
        historyResults?.add?.(label(qx, 'Waiting for the first native simulation…', {
          textColor: '#344448', padding: 10
        }));
      }
      const percent = (value) => Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : '—';
      let creditsResourceImage = '';
      try {
        creditsResourceImage = qx.util.ResourceManager.getInstance()
          .toUri('webfrontend/ui/common/icn_res_dollar.png');
      } catch { /* The text fallback remains available on older clients. */ }
      const resourceImages = [
        'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/43de27430e1fe65304ec436ac7c2367f.png',
        'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/35f27ef8016a87b77f5cf60c95049815.png',
        'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/4fc74d74170e9409ae79ea87527f52af.png',
        creditsResourceImage
      ];
      const repairImage = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/0bc8bbd48af9d5915c20d81b9d4a179e.png';
      const armyImages = [
        'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/34aae3015689f9f1c2bf92069efa0943.png',
        'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/01cdc3827dbc9ecc58636f754e97db6e.png',
        'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/ad5c737dda0063b52f7e17ac276fd3c0.png'
      ];
      const nativeImage = (src, size, title, height = size) => src
        ? `<img src="${escapeHtml(src)}" width="${size}" height="${height}" title="${escapeHtml(title)}" style="vertical-align:middle;margin-right:5px">`
        : `<span title="${escapeHtml(title)}" style="display:inline-block;width:${size}px;text-align:center;margin-right:5px"><b>${escapeHtml(title)}</b></span>`;
      const createGameStyleHistoryCard = (entry, index) => {
        const result = entry.analysis;
        const estimate = entry.snapshot?.attackEstimate ?? {};
        const fullyRepairable = Number(estimate.fullyRepairableAttacks);
        const simulatedTime = new Date(Number(entry.at) || Date.now()).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const resultCard = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({
          width: 180, minWidth: 180, maxWidth: 180,
          height: 800, minHeight: 800, maxHeight: 800,
          padding: 0,
          backgroundColor: '#050707',
          textColor: '#39434a',
          cursor: 'pointer',
          toolTipText: 'Load this result into the War Room formation preview'
        });
        const top = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
          height: 79, minHeight: 79, maxHeight: 79
        });
        top.add(new qx.ui.core.Widget().set({ decorator: 'pane-sim-top' }), {
          left: 0, top: 0, right: 0, bottom: 0
        });
        const topContent = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({
          padding: [12, 6, 2], backgroundColor: null
        });
        topContent.add(new qx.ui.basic.Label(`<div style="text-align:center;color:#434a54">`
          + '<b style="font-size:14px">Simulated outcome:</b><br>'
          + `Today ${escapeHtml(simulatedTime)}<br><span style="font-size:17px;color:#434a54"><b>${escapeHtml(result.outcome)}</b></span></div>`)
          .set({ rich: true, wrap: true, textColor: '#434a54' }));
        top.add(topContent, { left: 0, top: 0, right: 0, bottom: 0 });
        const mid = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
          height: 566, minHeight: 566, maxHeight: 566
        });
        mid.add(new qx.ui.core.Widget().set({ decorator: 'pane-sim-mid' }), {
          left: 0, top: 0, right: 0, bottom: 0
        });
        const midContent = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({
          padding: 5, backgroundColor: null
        });
        const divider = '<div style="height:1px;margin:5px 16px;background:#aeb5b2"></div>';
        const resourceRow = (image, value, title) => `<div style="height:20px;margin-left:12px;font-size:12px;font-weight:bold;line-height:20px">${nativeImage(image, 20, title)}${Math.round(value ?? 0).toLocaleString()}</div>`;
        const html = `<div style="color:#434a54;font-family:'Lucida Grande';font-size:13px;line-height:1.4">`
          + '<div style="height:20px;font-size:14px;font-weight:bold">Resource summary</div>'
          + resourceRow(resourceImages[0], result.lootResources?.research, 'Research')
          + resourceRow(resourceImages[1], result.lootResources?.tiberium, 'Tiberium')
          + resourceRow(resourceImages[2], result.lootResources?.crystal, 'Crystal')
          + (Number(result.lootResources?.credits ?? 0) ? resourceRow(resourceImages[3], result.lootResources.credits, 'Credits') : '')
          + divider
          + `<div style="height:20px;font-size:14px;font-weight:bold">Target state: ${escapeHtml(percent(result.defenderRemaining))}</div>`
          + `<div style="height:18px;margin-left:12px">Base state: ${percent(result.defenderBreakdown?.structures?.remainingPercent)}</div>`
          + `<div style="height:18px;margin-left:12px">Defense state: ${percent(result.defenderBreakdown?.defense?.remainingPercent)}</div>`
          + `<div style="margin:7px 12px;font-size:13px;line-height:22px">`
          + `<div><b>CY</b><span style="float:right">${percent(result.cyRemaining)}</span></div>`
          + `<div><b>DF</b><span style="float:right">${percent(result.dfRemaining)}</span></div>`
          + `<div><b>DH</b><span style="float:right">${percent(result.defenseHqRemaining)}</span></div>`
          + '</div>'
          + divider
          + `<div style="height:20px;font-size:14px;font-weight:bold">Army state: ${percent(result.ownRemaining)}</div>`
          + '<table cellspacing="0" cellpadding="0" style="width:170px;text-align:center;font-size:13px;font-weight:bold"><tr>'
          + `<td style="width:56px">${nativeImage(armyImages[0], 26, 'Inf')}<br>${percent(result.offenseBreakdown?.infantry?.remainingPercent)}</td>`
          + `<td style="width:56px">${nativeImage(armyImages[1], 26, 'Veh')}<br>${percent(result.offenseBreakdown?.vehicle?.remainingPercent)}</td>`
          + `<td style="width:56px">${nativeImage(armyImages[2], 26, 'Air')}<br>${percent(result.offenseBreakdown?.aircraft?.remainingPercent)}</td></tr></table>`
          + divider
          + '<div style="height:20px;font-size:14px;font-weight:bold">Repair costs</div>'
          + `<div style="height:20px;margin-left:12px;font-size:12px;font-weight:bold;line-height:20px">${nativeImage(repairImage, 20, 'Repair')}<span style="color:#ff6060">${escapeHtml(duration(result.repairSeconds))}</span></div>`
          + resourceRow(resourceImages[2], result.repairCostResources?.crystal, 'Crystal')
          + '</div>';
        const midLabel = new qx.ui.basic.Label(html).set({
          rich: true, wrap: true, textColor: '#434a54', width: 170, minWidth: 170
        });
        midContent.add(midLabel, { flex: 1 });
        mid.add(midContent, { left: 0, top: 0, right: 0, bottom: 0 });
        const bottom = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
          height: 155, minHeight: 155, maxHeight: 155
        });
        bottom.add(new qx.ui.core.Widget().set({ decorator: 'pane-sim-bottom' }), {
          left: 0, top: 0, right: 0, bottom: 0
        });
        const bottomContent = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({
          padding: [0, 7, 16], backgroundColor: null
        });
        bottomContent.add(new qx.ui.basic.Label(`<div style="width:166px;color:#434a54;font-family:'Lucida Grande';font-size:13px;text-align:center;line-height:1.4">`
          + `<b style="font-size:14px">Possible attacks</b><br>with current CP:<br>`
          + `<span style="font-size:17px"><b>${Math.round(Number(estimate.commandPointAttacks ?? 0))}</b></span><br>`
          + `with full repairs:<br><span style="font-size:17px"><b>${escapeHtml(Number.isFinite(Number(estimate.possibleAttacks)) ? estimate.possibleAttacks : (Number.isFinite(fullyRepairable) ? fullyRepairable + 1 : '—'))}</b></span></div>`)
          .set({
            rich: true, wrap: true, textColor: '#434a54', textAlign: 'center',
            width: 166, minWidth: 166, maxWidth: 166, allowGrowX: true
          }));
        const resultActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
        const replayResult = new qx.ui.form.Button('Watch Replay');
        const useResult = index > 0
          ? new qx.ui.form.Button('Use').set({ enabled: Array.isArray(entry.units) && entry.units.length > 0 })
          : null;
        replayResult.addListener('execute', () => this.hub.playSimulation(entry.response));
        useResult?.addListener('execute', (event) => {
          event.stopPropagation?.();
          void applyCachedFormationToNativePanel(entry).catch((error) => {
            simulatorText.setValue(`Unable to use ${result.label}: ${error?.message ?? error}`);
          });
        });
        resultActions.add(replayResult, { flex: 1 });
        if (useResult) resultActions.add(useResult);
        bottomContent.add(resultActions);
        bottom.add(bottomContent, { left: 0, top: 0, right: 0, bottom: 0 });
        resultCard.add(top);
        resultCard.add(mid);
        resultCard.add(bottom);
        resultCard.addListener('tap', () => {
          if (!comparisonReduced) {
            loadCachedPreview(entry);
            return;
          }
          void applyCachedFormationToNativePanel(entry).catch((error) => {
            simulatorText.setValue(`Unable to use ${result.label}: ${error?.message ?? error}`);
          });
        });
        return resultCard;
      };
      for (const [index, entry] of comparisonEntries.entries()) {
        comparisonResults?.add?.(createGameStyleHistoryCard(entry, index));
      }
      for (const [index, entry] of topTenEntries.entries()) {
        historyResults?.add?.(createGameStyleHistoryCard(entry, index));
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
        targetIntel.setValue(targetIntelCard(intel));
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
      const snapshot = this.currentSnapshot ?? this.hub.snapshot();
      syncLiveFormationPreview(snapshot);
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
      snapshot.target?.id, snapshot.attacker?.id,
      units.map((unit) => `${unit.entityId ?? unit.id}:${unit.x}:${unit.y}:${unit.enabled !== false ? 1 : 0}`).sort().join('|'),
      (snapshot.allianceBonuses ?? []).join(',')
    ].join('::');

    const runLiveSimulation = async () => {
      if (buildDisposed) return;
      if (liveSimulationRunning || optimizationRunning) {
        liveSimulationQueued = true;
        return;
      }
      const snapshot = this.hub.snapshot();
      if (!this.hub.isAttackSetupOpen(snapshot) || !snapshot.target?.id || !snapshot.units.length) return;
      liveSimulationRunning = true;
      safeSetValue(simulatorText, 'Running native simulation for the current formation…');
      try {
        const cacheKey = simulationKey(snapshot);
        // The native panel can repaint even when its completion/report events
        // are not returned to War Room. Use the command response that Manual
        // Preview uses so every stable live-grid move produces a cache entry.
        const response = await this.hub.simulateFormation(snapshot.units);
        // Refresh the game's own Simulated outcome panel for the same settled
        // live formation. History keeps the command response above; the
        // native panel remains useful even when History is closed.
        globalThis.ClientLib?.API?.Battleground?.GetInstance?.()?.SimulateBattle?.();
        liveFormationSequence += 1;
        const entry = {
          response,
          snapshot,
          at: Number(response?.nativeCombatReport?.summary?.timestamp ?? 0) || Date.now(),
          name: liveFormationSequence === 1 ? 'Live formation' : `Manual layout ${liveFormationSequence - 1}`,
          source: 'live-formation',
          units: snapshot.units.map((unit) => ({ ...unit }))
        };
        cacheSimulation(cacheKey, entry);
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
          observedFormation = formationSignature(current);
          this.nativeSimulation = WarRoomCalculator.analyzeNativeSimulation(response, snapshot, entry.name);
          this.nativeSimulationReplay = {
            response,
            targetId: String(snapshot.target.id),
            formation: formationSignature(snapshot)
          };
          this.stats.record(snapshot, this.nativeSimulation, formationSignature(snapshot));
          showSimulationResult(this.nativeSimulation, {
            title: 'Live Formation Result',
            name: entry.name,
            oneShot: this.nativeSimulation.oneShot,
            note: 'Fresh native simulation of the formation currently applied in the game.'
          });
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
        const message = String(error?.message ?? error);
        if (/returned no battle simulation data/i.test(message)) {
          safeSetValue(simulatorText,
            'No simulation result was produced. Check the active target and troop formation.');
          const failedFormation = formationSignature(snapshot);
          if (liveSimulationRetryFormation !== failedFormation) {
            liveSimulationRetryFormation = failedFormation;
            liveSimulationRetryCount = 0;
          }
          if (liveSimulationRetryCount < 2) {
            liveSimulationRetryCount += 1;
            liveSimulationQueued = true;
          }
        } else {
          safeSetValue(simulatorText, `Live simulation failed: ${message}`);
          this.context.logger?.warn?.('War Room live simulation failed.', error);
        }
      } finally {
        liveSimulationRunning = false;
        if (!buildDisposed && liveSimulationQueued && this.hub.isAttackSetupOpen(this.hub.snapshot())) {
          liveSimulationQueued = false;
          liveTimer = setTimeout(() => { void runLiveSimulation(); }, 750);
        }
      }
    };

    const queueLiveSimulation = () => {
      if (buildDisposed || !this.hub.isAttackSetupOpen(this.hub.snapshot())) return;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => { void runLiveSimulation(); }, 400);
    };
    this.captureCurrentFormation = runLiveSimulation;

    root.addListenerOnce?.('dispose', () => {
      buildDisposed = true;
      recommendationSequence += 1;
      liveSimulationQueued = false;
      clearTimeout(liveTimer);
      unsubscribePresetChanges?.();
      unsubscribePresetChanges = null;
      unsubscribeGameTick?.();
      unsubscribeGameTick = null;
      compactPlannerWindow?.destroy?.();
      comparisonWindow?.destroy?.();
      historyWindow?.destroy?.();
      nativeHistoryControl?.remove?.();
      nativeHistoryControl = null;
      this.content = null;
      this.companionWindows = null;
    });

    let lastSafetyRegistryScanAt = 0;
    unsubscribeGameTick = this.context.events?.on?.('game:tick', () => {
      // ObjectRegistry contains most of the live Qooxdoo UI. Walking it while
      // War Room is closed made the central 500 ms game-state callback scale
      // with the entire game interface and could block the UI for 50–100 ms.
      // These controls and live simulations are relevant only to a visible
      // War Room, so leave the dormant module at constant cost.
      if (buildDisposed || !widgetAlive(root)) return;
      const snapshot = this.hub.snapshot();
      if (!windowVisible() && !this.hub.isAttackSetupOpen(snapshot)) return;
      const now = Date.now();
      if (windowVisible() && now - lastSafetyRegistryScanAt >= 2000) {
        lastSafetyRegistryScanAt = now;
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
      }
      installNativeHistoryControl();
      if (
        nativeSimulationContentElement
        && (
          !nativeSimulationContentElement.isConnected
          || nativeSimulationContentElement.offsetParent == null
          || globalThis.getComputedStyle?.(nativeSimulationContentElement)?.display === 'none'
        )
      ) {
        nativeHistoryControl?.remove?.();
        nativeHistoryControl = null;
        nativeSimulationPanelElement = null;
        nativeSimulationContentElement = null;
      }
      const targetId = snapshot.target?.id == null ? null : String(snapshot.target.id);
      const attackerId = snapshot.attacker?.id == null ? null : String(snapshot.attacker.id);
      const formation = formationSignature(snapshot);
      if (attackerId !== observedAttackerId || targetId !== observedTargetId) {
        observedAttackerId = attackerId;
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
        liveSimulationRetryFormation = formation;
        liveSimulationRetryCount = 0;
        // Do not rebuild every table from the 500 ms game tick. Qooxdoo can
        // momentarily detach inactive table panes while attack setup changes;
        // updating their models in that interval throws from _getPaneScrollerArr.
        // The live preview and simulation list are the only formation-sensitive
        // views and can be refreshed safely in isolation.
        // Use the fresh game snapshot. this.currentSnapshot is the last full
        // War Room render and can lag behind live formation-grid movement.
        syncLiveFormationPreview(snapshot);
        renderSimulations();
        if (!liveSimulationRunning) queueLiveSimulation();
      }
    });

    this.refreshAll = () => {
      syncFromGameTarget();
      observedAttackerId = String(this.hub.snapshot().attacker?.id ?? '');
      observedFormation = formationSignature(this.hub.snapshot());
      queueLiveSimulation();
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
      const refreshedSnapshot = this.hub.snapshot();
      observedAttackerId = String(refreshedSnapshot.attacker?.id ?? '');
      observedTargetId = String(refreshedSnapshot.target?.id ?? '');
      observedFormation = formationSignature(refreshedSnapshot);
      this.nativeSimulation = null;
      this.nativeSimulationReplay = null;
      queueLiveSimulation();
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
      else if (searchMode.getSelection?.()?.[0]?.getModel?.() === 'greedy') void simulateGreedyTroopByTroop();
      else void simulateRecommendation();
    });
    pauseRecommendation.addListener('execute', () => toggleRecommendationPause());
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
          const previewMatchesGame = formationSignature({ units }) === formationSignature(snapshot);
          const response = cached?.response?.nativeEntityLoot && cached?.response?.nativeOffenseRepair
            ? cached.response : await this.hub.simulateFormation(units);
          cacheSimulation(cacheKey, {
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
            note: `This result uses the TABS SimulateBattle command pipeline${previewMatchesGame ? ' for the active formation' : ''}. Open Battle Simulator for replay controls.`
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
          const appliedSnapshot = this.hub.snapshot();
          observedFormation = formationSignature(appliedSnapshot);
          simulationCache.delete(simulationKey(appliedSnapshot));
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
    const saveCurrentFormationPreset = async () => {
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
      formationPresets = await saveFormationPresets(this.context.storage, formationPresets);
      renderPresets(preset.id);
      presetName.setValue('');
      this.context.eventBus?.emit?.('war-room:formation-presets-changed', {
        presetId: preset.id,
        attackerId: captured.attackerId,
        targetId: captured.target?.id
      });
      plannerStatus.setValue(
        `${name} saved for ${captured.attackerName} against ${captured.target?.name ?? 'this target'}.`
      );
    };
    const saveFromEitherPlanner = () => {
      void saveCurrentFormationPreset().catch((error) => {
        plannerStatus.setValue(`Unable to save formation: ${error?.message ?? error}`);
        safeSetValue(compactPlannerResult,
          '<b>Unable to save formation</b><br>'
          + `<span style="color:#a32626">${escapeHtml(error?.message ?? error)}</span>`);
      });
    };
    savePreset.addListener('execute', saveFromEitherPlanner);
    compactSavePreset.addListener('execute', saveFromEitherPlanner);
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
          formationPresets = await saveFormationPresets(this.context.storage, formationPresets);
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
      statsStatus.setValue('Battle history cleared.');
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
    targetSearch.addListener('execute', () => { void (async () => {
      try {
        targetSearch.setEnabled(false);
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
        this.searchResults = await this.hub.searchTargets({
          originCityId: snapshot.attacker?.id,
          minLevel: minLevel.getValue(),
          maxLevel: maxLevel.getValue(),
          cpLimit: maxCp.getValue(),
          radius: Math.max(41, maxCp.getValue()),
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
        updateSearchResultHeight(this.searchResults.length);
        targetStatus.setValue(
          `${this.searchResults.length} targets found. Click a row to inspect it; use Open Attack to enter combat setup.`
        );
        selectedSearchTarget = null;
        render();
        setSearchExportEnabled(this.searchResults.length > 0);
      } catch (error) {
        targetStatus.setValue(`Target search failed: ${error?.message ?? error}`);
        this.context.logger?.warn?.('War Room target search failed.', error);
      } finally { targetSearch.setEnabled(true); }
    })(); });
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

    stack.setSelection([pages.get('simulator').page]);
    selectSectionControls('simulator');
    void loadFormationPresets().catch((error) => {
      this.context.logger?.warn?.('War Room formation presets failed to load.', error);
    });
    syncFromGameTarget();
    {
      const initialSnapshot = this.hub.snapshot();
      observedAttackerId = String(initialSnapshot.attacker?.id ?? '');
      observedTargetId = String(initialSnapshot.target?.id ?? '');
      observedFormation = formationSignature(initialSnapshot);
    }
    this.selectOpeningSearchMode();
    queueLiveSimulation();
    void loadNativeReports();
    this.companionWindows = { planner: compactPlannerWindow };
    this.setAttackCompanionsVisible = (visible) => {
      attackCompanionsRequested = Boolean(visible);
      if (!visible) {
        compactPlannerWindow.exclude();
        comparisonWindow.exclude();
        historyWindow.exclude();
        return;
      }
      compactPlannerWindow.exclude();
    };
    this.toggleCompanion = (name) => {
      const window = this.companionWindows?.[name];
      if (!window) return;
      if (window.isVisible?.()) window.exclude();
      else window.open();
    };
    this.content = root;
    return root;
  }

  initializeCompanions() {
    this.build();
    return this.companionWindows;
  }

  destroy() {
    this.content?.destroy?.();
    this.content = null;
    this.companionWindows = null;
  }

  dockLeftOfAttackView() {
    const window = this.record?.window;
    if (!window || window.isDisposed?.()) return null;
    const application = globalThis.qx?.core?.Init?.getApplication?.();
    const root = application?.getDesktop?.() ?? application?.getRoot?.();
    const view = application?.getPlayArea?.();
    const rootBounds = root?.getBounds?.() ?? { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
    const rootLocation = root?.getContentLocation?.() ?? { left: 0, top: 0 };
    const viewLocation = view?.getContentLocation?.();
    if (!viewLocation) return null;
    const bounds = window.getBounds?.() ?? {};
    const width = Number(bounds.width ?? window.getWidth?.() ?? 900);
    const height = Number(bounds.height ?? window.getHeight?.() ?? 650);
    const viewLeft = Number(viewLocation.left || 0) - Number(rootLocation.left || 0);
    const viewTop = Number(viewLocation.top || 0) - Number(rootLocation.top || 0);
    const left = Math.max(8, Math.min(rootBounds.width - width - 8, viewLeft - width - 6));
    const top = Math.max(8, Math.min(rootBounds.height - height - 8, viewTop));
    window.moveTo?.(left, top);
    return { left, top };
  }

  async open() {
    await this.stats?.load?.();
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.refreshAll?.();
      this.selectOpeningSearchMode?.();
      this.record.window.open();
      this.record.window.setActive?.(true);
      return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'war-room',
      title: 'War Room',
      content: this.build(),
      x: 120,
      y: 70,
      width: 900,
      height: 650,
      sizeRevision: 'war-room-0.5-left-navigation-resizable',
      resizable: true,
      singleton: true
    });
    return this.record;
  }
}

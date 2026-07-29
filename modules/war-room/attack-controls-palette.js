const BUTTON_SIZE = 31;
const ICON_SIZE = 23;
const PANEL_COLUMNS = 3;
const PANEL_ROWS = 7;
const PANEL_WIDTH = 135;
const PANEL_HEIGHT = 307;
const POSITION_KEY = 'module:war-room:attack-palette-position:v1';
const PRESET_KEY = 'module:war-room:formation-presets:v1';

const nativeIcon = (name) => `FactionUI/icons/${name}.png`;
const suiteIcon = (name) => new URL(`../../assets/icons/${name}.svg`, import.meta.url).href;

const ACTIONS = Object.freeze([
  ['war-room', 'Open War Room', suiteIcon('war-room')],
  ['up', 'Move all live troops up', nativeIcon('icon_step_up_button')],
  ['toggle-one', 'Toggle one troop: enable, then click troops until disabled', nativeIcon('icon_disable_unit')],
  ['left', 'Move all live troops left', nativeIcon('icon_step_left_button')],
  ['toggle-all', 'Hide or unhide all troops', nativeIcon('icon_arsnl_show_all')],
  ['right', 'Move all live troops right', nativeIcon('icon_step_right_button')],
  ['mirror-horizontal', 'Mirror the live formation horizontally', suiteIcon('formation-mirror-horizontal')],
  ['down', 'Move all live troops down', nativeIcon('icon_step_down_button')],
  ['mirror-vertical', 'Mirror the live formation vertically', suiteIcon('formation-mirror-vertical')],
  ['toggle-infantry', 'Hide or unhide infantry', nativeIcon('icon_arsnl_off_squad')],
  ['toggle-aircraft', 'Hide or unhide aircraft', nativeIcon('icon_arsnl_off_plane')],
  ['toggle-vehicles', 'Hide or unhide vehicles', nativeIcon('icon_arsnl_off_vehicle')],
  ['reset', 'Reset the live formation to its attack-screen starting layout', nativeIcon('icon_refresh_funds')],
  ['save', 'Save the current live formation', nativeIcon('icon_load_save')],
  ['swap-1-2', 'Swap live troop rows 1 and 2', suiteIcon('formation-swap-12')],
  ['swap-2-3', 'Swap live troop rows 2 and 3', suiteIcon('formation-swap-23')],
  ['swap-3-4', 'Swap live troop rows 3 and 4', suiteIcon('formation-swap-34')],
  ['planner', 'Open or close the compact Formation Optimizer', suiteIcon('layout')]
]);

export class AttackControlsPalette {
  constructor({ context, hub, onSimulate = null, onOpenPlanner = null, onOpenResults = null }) {
    this.context = context;
    this.hub = hub;
    this.onSimulate = onSimulate;
    this.onOpenPlanner = onOpenPlanner;
    this.onOpenResults = onOpenResults;
    this.widget = null;
    this.visible = null;
    this.baseline = null;
    this.baselineKey = null;
    this.singleToggleMode = false;
    this.nativeSingleToggleMode = false;
    this.singleToggleButton = null;
    this.lastSelectionToken = null;
    this.positionReady = false;
    this.positionTimer = null;
    this.pendingActions = new Set();
  }

  build() {
    if (this.widget && !this.widget.isDisposed?.()) return this.widget;
    const qx = globalThis.qx;
    const layout = new qx.ui.layout.Grid(4, 4);
    const panel = new qx.ui.window.Window('Formation').set({
      layout,
      padding: 5,
      width: PANEL_WIDTH,
      minWidth: PANEL_WIDTH,
      maxWidth: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      minHeight: PANEL_HEIGHT,
      maxHeight: PANEL_HEIGHT,
      showClose: false,
      showMinimize: false,
      showMaximize: false,
      allowMaximize: false,
      allowMinimize: false,
      resizable: false,
      movable: true,
      useMoveFrame: true,
      alwaysOnTop: false
    });
    for (let column = 0; column < PANEL_COLUMNS; column += 1) layout.setColumnWidth(column, BUTTON_SIZE);
    for (let row = 0; row < PANEL_ROWS; row += 1) layout.setRowHeight(row, BUTTON_SIZE);

    const Button = globalThis.webfrontend?.ui?.SoundButton ?? qx.ui.form.Button;
    ACTIONS.forEach(([action, tooltip, icon], index) => {
      const button = new Button(null, icon).set({
        width: BUTTON_SIZE, minWidth: BUTTON_SIZE, maxWidth: BUTTON_SIZE,
        height: BUTTON_SIZE, minHeight: BUTTON_SIZE, maxHeight: BUTTON_SIZE,
        allowGrowX: false, allowGrowY: false,
        show: 'icon', appearance: 'button-friendlist-scroll', center: true,
        toolTipText: tooltip
      });
      button.addListener('appear', () => {
        button.getChildControl?.('icon', true)?.set?.({ width: ICON_SIZE, height: ICON_SIZE, scale: true });
      });
      button.addListener('execute', () => void this.execute(action));
      panel.add(button, { row: Math.floor(index / PANEL_COLUMNS), column: index % PANEL_COLUMNS });
      if (action === 'toggle-one') this.singleToggleButton = button;
    });

    const application = qx.core.Init.getApplication();
    const root = application.getDesktop?.() ?? application.getRoot();
    root.add(panel, { left: 0, top: 0 });
    panel.addListener('move', () => this.queuePositionSave());
    panel.addListenerOnce('appear', () => void this.restorePosition());
    panel.exclude();
    this.widget = panel;
    return panel;
  }

  captureBaseline() {
    const snapshot = this.hub.snapshot();
    const key = `${snapshot.attacker?.id ?? ''}:${snapshot.target?.id ?? ''}`;
    if (!snapshot.units.length || key === this.baselineKey) return;
    this.baselineKey = key;
    this.baseline = this.hub.captureFormation();
  }

  async execute(action) {
    if (this.pendingActions.has(action)) return;
    this.pendingActions.add(action);
    try {
      if (action === 'simulate') {
        if (this.onSimulate) await this.onSimulate();
        else {
          const snapshot = this.hub.snapshot();
          const response = await this.hub.simulateFormation(snapshot.units);
          this.hub.playSimulation(response);
        }
      } else if (action === 'war-room') {
        await this.context.modules?.open?.('war-room');
      } else if (action === 'planner') {
        await this.onOpenPlanner?.();
      } else if (action === 'results') {
        await this.onOpenResults?.();
      } else if (action === 'reset') {
        if (!this.baseline) throw new Error('No starting formation has been captured.');
        this.hub.applyFormation(this.baseline);
      } else if (action === 'save') {
        await this.saveFormation();
      } else if (action === 'toggle-one') {
        this.setSingleToggleMode(!this.singleToggleMode);
      } else if (action.startsWith('toggle-')) {
        this.hub.toggleFormationVisibility(action.slice(7));
      } else {
        this.hub.transformActiveFormation(action);
      }
    } catch (error) {
      this.context.logger?.warn?.('Attack formation control failed.', { action, error: error?.message ?? String(error) });
      this.context.notifications?.show?.(`Formation control failed: ${error?.message ?? error}`, { level: 'error' });
    } finally {
      this.pendingActions.delete(action);
    }
  }

  setSingleToggleMode(enabled) {
    const next = Boolean(enabled);
    if (next !== this.singleToggleMode) {
      if (next) {
        try { this.nativeSingleToggleMode = this.hub.toggleNativeSingleDisableMode(); }
        catch { this.nativeSingleToggleMode = false; }
      } else if (this.nativeSingleToggleMode) {
        // Only execute the native control a second time when this palette
        // actually enabled it. Otherwise a late-appearing native control could
        // be switched on while the user is trying to leave fallback mode.
        try { this.hub.toggleNativeSingleDisableMode(); } catch {}
        this.nativeSingleToggleMode = false;
      }
    }
    this.singleToggleMode = next;
    this.lastSelectionToken = this.hub.selectedFormationUnitToken();
    if (this.singleToggleButton) {
      if (this.singleToggleMode) this.singleToggleButton.addState?.('pressed');
      else this.singleToggleButton.removeState?.('pressed');
      this.singleToggleButton.setToolTipText?.(this.singleToggleMode
        ? 'Single-troop toggle is active; click troops, then click this button to stop'
        : 'Toggle one troop: enable, then click troops until disabled');
    }
  }

  handleSelectionChanged() {
    if (!this.singleToggleMode || this.nativeSingleToggleMode) return;
    const token = this.hub.selectedFormationUnitToken();
    if (!token || token === this.lastSelectionToken) return;
    this.lastSelectionToken = token;
    try { this.hub.toggleFormationUnit(token); }
    catch (error) { this.context.logger?.debug?.('Selected object is not a live formation troop.', error); }
  }

  async saveFormation() {
    if (!this.context.storage?.set) throw new Error('Suite storage is unavailable.');
    const captured = this.hub.captureFormation();
    const presets = await this.context.storage.get?.(PRESET_KEY, []) ?? [];
    const matchesTarget = (item) => String(item.attackerId) === String(captured.attackerId)
      && String(item.target?.id) === String(captured.target?.id);
    const suggested = `Formation ${presets.filter(matchesTarget).length + 1}`;
    const name = globalThis.prompt?.('Save formation as:', suggested)?.trim();
    if (!name) return;
    const existing = presets.find((item) => matchesTarget(item)
      && String(item.name).toLowerCase() === name.toLowerCase());
    const preset = { ...captured, id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, updatedAt: Date.now() };
    const next = existing ? presets.map((item) => item.id === existing.id ? preset : item) : [...presets, preset];
    await this.context.storage.set(PRESET_KEY, next);
    this.context.eventBus?.emit?.('war-room:formation-presets-changed', {
      presetId: preset.id,
      attackerId: captured.attackerId,
      targetId: captured.target?.id
    });
    this.context.notifications?.show?.(
      `${name} saved for ${captured.attackerName} against ${captured.target?.name ?? 'this target'}.`,
      { level: 'success' }
    );
  }

  defaultPosition() {
    const application = globalThis.qx?.core?.Init?.getApplication?.();
    const root = application?.getDesktop?.() ?? application?.getRoot?.();
    const view = application?.getPlayArea?.();
    const rootBounds = root?.getBounds?.() ?? { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
    const viewBounds = view?.getBounds?.();
    const viewLocation = view?.getContentLocation?.() ?? view?.getLayoutProperties?.() ?? { left: 0, top: 0 };
    const panelWidth = PANEL_WIDTH, panelHeight = PANEL_HEIGHT;
    const left = Math.min(rootBounds.width - panelWidth - 8, Number(viewLocation.left || 0) + Number(viewBounds?.width || 720) + 6);
    const top = Math.min(rootBounds.height - panelHeight - 8, Number(viewLocation.top || 0) + Number(viewBounds?.height || 550) - panelHeight - 24);
    return { left: Math.max(8, left), top: Math.max(8, top) };
  }

  async restorePosition() {
    const stored = await this.context.storage?.get?.(POSITION_KEY, null);
    const position = stored && Number.isFinite(stored.left) && Number.isFinite(stored.top) ? stored : this.defaultPosition();
    this.widget?.setLayoutProperties?.({ left: position.left, top: position.top });
    this.positionReady = true;
  }

  queuePositionSave() {
    if (!this.positionReady || !this.widget || !this.context.storage?.set) return;
    clearTimeout(this.positionTimer);
    this.positionTimer = setTimeout(() => {
      const position = this.widget?.getLayoutProperties?.();
      if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
        void this.context.storage.set(POSITION_KEY, { left: position.left, top: position.top });
      }
    }, 200);
  }

  setVisible(visible) {
    const next = Boolean(visible);
    // Attack setup can switch directly from one target to another without the
    // palette ever becoming hidden. Keep Reset tied to the current target's
    // starting formation instead of retaining the previous target's baseline.
    if (next === this.visible) {
      if (next) this.captureBaseline();
      return;
    }
    this.visible = next;
    if (!next && !this.widget) return;
    this.build();
    if (next) {
      this.captureBaseline();
      this.widget.open?.();
      this.widget.show?.();
    } else {
      this.setSingleToggleMode(false);
      this.baseline = null;
      this.baselineKey = null;
      this.widget.exclude();
    }
  }

  destroy() {
    clearTimeout(this.positionTimer);
    this.widget?.destroy?.();
    this.widget = null;
    this.visible = null;
  }
}

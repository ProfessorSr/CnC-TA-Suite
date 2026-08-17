function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value !== undefined && value !== null) return value;
      }
    } catch { /* Selected map objects can be replaced while menus open. */ }
  }
  return null;
}

export function describeSelection(selected, clientRoot = globalThis.ClientLib) {
  if (!selected) return null;
  const x = Number(call(selected, ['get_RawX', 'get_X', 'get_PosX']) ?? NaN);
  const y = Number(call(selected, ['get_RawY', 'get_Y', 'get_PosY']) ?? NaN);
  const id = call(selected, ['get_Id', 'get_CityId', 'get_BaseId']);
  const cityType = call(selected, ['get_Type', 'get_CityType']);
  const visualType = call(selected, ['get_VisObjectType', 'get_ObjectType']);
  const cityTypes = clientRoot?.Vis?.Region?.RegionCity?.ERegionCityType ?? {};
  const visualTypes = clientRoot?.Vis?.VisObject?.EObjectType ?? {};
  const constructorName = String(selected.constructor?.name ?? '').toLowerCase();
  let category = 'target';
  let type = 'Base';
  if (cityType === cityTypes.Own || constructorName.includes('owncity')) category = 'own';
  else if (cityType === cityTypes.Alliance) category = 'allied';
  else if (visualType === visualTypes.RegionNPCCamp || constructorName.includes('npccamp')) type = 'Camp';
  else if (visualType === visualTypes.RegionNPCBase || constructorName.includes('npcbase')) type = 'Forgotten Base';
  else if (constructorName.includes('outpost')) type = 'Outpost';
  else if (cityType === cityTypes.Enemy) category = 'target';
  return Object.freeze({
    raw: selected,
    id,
    x,
    y,
    name: String(call(selected, ['get_Name', 'get_CityName']) ?? type),
    level: Number(call(selected, ['get_BaseLevel', 'get_Level']) ?? 0),
    territoryRadius: Number(call(selected, ['get_TerritoryRadius']) ?? 0),
    playerId: call(selected, ['get_PlayerId']),
    allianceId: call(selected, ['get_AllianceId']),
    category,
    type,
    validCoordinates: Number.isFinite(x) && Number.isFinite(y)
  });
}

const ACTIONS = Object.freeze([
  Object.freeze({ id: 'baseInformation', label: 'Base Information', moduleId: 'base-intelligence', scopes: ['target', 'allied', 'own'] }),
  Object.freeze({ id: 'warRoom', label: 'Open War Room', moduleId: 'war-room', scopes: ['target', 'allied'] }),
  Object.freeze({ id: 'targetInfo', label: 'Target Information', moduleId: 'war-room', scopes: ['target', 'allied'] }),
  Object.freeze({ id: 'scanNearby', label: 'Scan Nearby', moduleId: 'scanner', scopes: ['target', 'allied', 'own'] }),
  Object.freeze({ id: 'viewLayout', label: 'View Layout', moduleId: 'scanner', scopes: ['target', 'allied'] }),
  Object.freeze({ id: 'copyCoordinates', label: 'Copy Coordinates', action: 'copy', scopes: ['target', 'allied', 'own'] }),
  Object.freeze({ id: 'addCustomMarker', label: 'Add Custom Marker', action: 'marker-add', scopes: ['target', 'allied', 'own'], types: ['Base', 'Forgotten Base', 'Camp', 'Outpost'] }),
  Object.freeze({ id: 'removeCustomMarker', label: 'Remove Custom Marker', action: 'marker-remove', scopes: ['target', 'allied', 'own'], types: ['Base', 'Forgotten Base', 'Camp', 'Outpost'], transient: 'marker-exists' }),
  Object.freeze({ id: 'repairManager', label: 'Repair & Collection', moduleId: 'repair-manager', scopes: ['own'] }),
  Object.freeze({ id: 'upgradeManager', label: 'Upgrade Manager', moduleId: 'upgrade-manager', scopes: ['own'] }),
  Object.freeze({ id: 'layoutOptimizer', label: 'Layout Optimizer', moduleId: 'layout-optimizer', scopes: ['own'] }),
  Object.freeze({ id: 'resourceTransfer', label: 'Resource Transfer', moduleId: 'resource-transfer', scopes: ['own'] }),
  Object.freeze({ id: 'planMove', label: 'Plan Move Base', action: 'plan-move', scopes: ['target', 'allied', 'own'], types: ['Base', 'Forgotten Base'] }),
  Object.freeze({ id: 'planRuin', label: 'Plan Ruin', action: 'plan-ruin', scopes: ['target', 'allied'] }),
  Object.freeze({ id: 'planRuinFor', label: 'Plan Ruin For…', action: 'plan-ruin-for', scopes: ['target', 'allied'] }),
  Object.freeze({ id: 'planLevel', label: 'Plan Level Up', action: 'plan-level', scopes: ['target', 'allied', 'own'], types: ['Base'] }),
  Object.freeze({ id: 'planRemove', label: 'Plan Remove', action: 'plan-remove', scopes: ['target', 'allied'] }),
  Object.freeze({ id: 'undoPlan', label: 'Undo', action: 'plan-undo', scopes: ['target', 'allied', 'own'], transient: 'undo' }),
  Object.freeze({ id: 'resetPlans', label: 'Reset Plans', action: 'plan-reset', scopes: ['target', 'allied', 'own'], transient: 'reset' })
]);

export class ContextActionsPanel {
  constructor({ context, openOptions, strategicPlanner }) {
    this.context = context;
    this.openOptions = openOptions;
    this.strategicPlanner = strategicPlanner;
    this.panel = null;
    this.selection = null;
  }

  setting(id) { return this.context.moduleSettings.get(`show${id[0].toUpperCase()}${id.slice(1)}`, true); }

  build() {
    const qx = globalThis.qx;
    this.panel = new qx.ui.container.Composite(new qx.ui.layout.VBox(3)).set({
      paddingTop: 4,
      paddingBottom: 2,
      allowGrowX: true
    });
    this.title = new qx.ui.basic.Label('CnC-TA Suite').set({
      textAlign: 'center',
      font: 'bold',
      textColor: '#ffffff',
      paddingTop: 3,
      paddingBottom: 2
    });
    this.panel.add(this.title);
    this.actionBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(2));
    this.panel.add(this.actionBox);
    const options = new (globalThis.webfrontend?.ui?.SoundButton ?? qx.ui.form.Button)(
      'Suite Options',
      'FactionUI/icons/icon_forum_properties.png'
    );
    options.set({ minWidth: 112, allowGrowX: true, toolTipText: 'Choose which contextual actions are shown' });
    options.addListener('execute', () => { void this.openOptions(); });
    this.panel.add(options);
    return this.panel;
  }

  applicable(selection) {
    return ACTIONS.filter((action) => action.scopes.includes(selection.category)
      && (!action.types || action.types.includes(selection.type))
      && this.setting(action.id)
      && (action.transient === 'undo' ? this.strategicPlanner?.canUndo?.()
        : action.transient === 'reset' ? this.strategicPlanner?.isDirty?.()
          : action.transient === 'marker-exists' ? this.markersAtSelection().length > 0
            : true));
  }

  allianceMarkerHub() {
    return this.context.modules?.get?.('alliance')?.tabs?.hub ?? null;
  }

  markersAtSelection(hub = this.allianceMarkerHub()) {
    if (!hub || !this.selection?.validCoordinates) return [];
    return hub.displaySuiteMarkers?.().filter((marker) =>
      Number(marker.x) === Number(this.selection.x) && Number(marker.y) === Number(this.selection.y)) ?? [];
  }

  async ensureMarkerHub() {
    await this.context.modules?.enable?.('alliance');
    const hub = this.allianceMarkerHub();
    if (!hub) throw new Error('Alliance Intelligence marker services are unavailable.');
    await hub.privateMarkersReady;
    return hub;
  }

  makeRuinForButton(action) {
    const qx = globalThis.qx;
    const menu = new qx.ui.menu.Menu().set({ position: 'right-top' });
    for (const option of this.strategicPlanner?.allianceOptions?.() ?? []) {
      const item = new qx.ui.menu.Button(option.label).set({ textColor: option.color });
      item.addListener('execute', () => { void this.execute(action, option); });
      menu.add(item);
    }
    const button = new qx.ui.form.MenuButton(action.label, null, menu).set({
      appearance: 'button', minWidth: 112, allowGrowX: true,
      toolTipText: `${action.label} for ${this.selection.name}`
    });
    return button;
  }

  render(selected, clientRoot) {
    this.selection = describeSelection(selected, clientRoot);
    if (!this.selection) return false;
    if (!this.panel || this.panel.isDisposed?.()) this.build();
    this.actionBox.removeAll();
    for (const action of this.applicable(this.selection)) {
      const ButtonClass = globalThis.webfrontend?.ui?.SoundButton ?? globalThis.qx.ui.form.Button;
      const label = action.transient === 'undo' ? this.strategicPlanner.undoLabel() : action.label;
      const button = action.action === 'plan-ruin-for' ? this.makeRuinForButton(action) : new ButtonClass(label).set({
        minWidth: 112,
        allowGrowX: true,
        toolTipText: `${action.label} for ${this.selection.name}`
      });
      if (action.action !== 'plan-ruin-for') button.addListener('execute', () => { void this.execute(action); });
      this.actionBox.add(button);
    }
    this.title.setValue(`CnC-TA Suite · ${this.selection.type}`);
    return true;
  }

  async execute(action, option = null) {
    try {
      if (action.action === 'copy') {
        if (!this.selection?.validCoordinates) throw new Error('Coordinates are unavailable for this object.');
        const text = `${this.selection.x}:${this.selection.y}`;
        if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
        await globalThis.navigator.clipboard.writeText(text);
        this.context.notifications?.show?.(`Copied coordinates ${text}.`);
        return;
      }
      if (action.action === 'marker-add') {
        if (!this.selection?.validCoordinates) throw new Error('Coordinates are unavailable for this object.');
        const hub = await this.ensureMarkerHub();
        const label = globalThis.prompt?.(
          `Marker label for ${this.selection.x}:${this.selection.y}:`, this.selection.name || 'Custom marker'
        )?.trim();
        if (!label) return;
        const shared = globalThis.confirm?.(
          'Share this marker with alliance members using CnC-TA Suite?\n\nCancel creates a private marker visible only in this browser.'
        ) ?? false;
        const marker = { x: this.selection.x, y: this.selection.y, label, color: shared ? '#45d7ff' : '#ffcc33' };
        if (shared) await hub.addSharedSuiteMarker(marker); else await hub.addPrivateMarker(marker);
        this.context.notifications?.show?.(`${shared ? 'Alliance Suite' : 'Private'} marker added at ${marker.x}:${marker.y}.`);
        this.render(this.selection.raw, this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib);
        return;
      }
      if (action.action === 'marker-remove') {
        const hub = await this.ensureMarkerHub();
        const markers = this.markersAtSelection(hub);
        if (!markers.length) throw new Error('No Suite marker exists at this location.');
        const names = markers.map((marker) => `${marker.label} (${marker.scope})`).join('\n');
        if (!(globalThis.confirm?.(`Remove ${markers.length} marker${markers.length === 1 ? '' : 's'} at ${this.selection.x}:${this.selection.y}?\n\n${names}`) ?? false)) return;
        for (const marker of markers) await hub.deleteSuiteMarker(marker);
        this.context.notifications?.show?.(`${markers.length} marker${markers.length === 1 ? '' : 's'} removed.`);
        this.render(this.selection.raw, this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib);
        return;
      }
      if (action.action?.startsWith('plan-')) {
        const type = action.action.slice(5);
        await this.strategicPlanner?.execute?.(type, this.selection, option);
        this.render(this.selection.raw, this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib);
        return;
      }
      await this.context.modules.open(action.moduleId);
    } catch (error) {
      const message = `${action.label} failed: ${error?.message ?? error}`;
      this.context.logger?.warn?.(message, error);
      this.context.notifications?.show?.(message);
    }
  }

  attach(menu, selected, clientRoot) {
    if (!this.render(selected, clientRoot)) return false;
    if (this.attachedMenu === menu && this.panel.getLayoutParent?.()) return true;
    const parent = this.panel.getLayoutParent?.();
    if (parent && parent !== menu) parent.remove?.(this.panel);
    try {
      menu.add(this.panel);
      this.attachedMenu = menu;
      return true;
    } catch {
      const candidates = Object.values(menu).filter((value) =>
        value?.basename === 'Composite' && typeof value.add === 'function'
      );
      const host = candidates.find((value) => value.getChildren?.().some((child) =>
        child?.basename === 'Button' || typeof child?.getLabel === 'function'
      )) ?? candidates[0];
      if (!host) return false;
      host.add(this.panel);
      this.attachedMenu = menu;
      return true;
    }
  }

  destroy() {
    if (this.panel && !this.panel.isDisposed?.()) this.panel.destroy();
    this.panel = null;
    this.selection = null;
    this.attachedMenu = null;
  }
}

export { ACTIONS };

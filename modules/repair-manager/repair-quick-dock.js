const suiteIcon = (name) => new URL(`../../assets/icons/${name}.svg`, import.meta.url).href;

const MANAGER_BUTTON = Object.freeze({
  action: 'manager',
  icon: 'FactionUI/icons/icon_forum_properties.png',
  tooltip: 'Open Repair & Collection Manager'
});

const QUICK_REPAIRS = Object.freeze([
  Object.freeze({
    action: 'buildings',
    availability: 'buildings',
    icon: suiteIcon('api'),
    tooltip: 'Repair all damaged buildings'
  }),
  Object.freeze({
    action: 'offense',
    availability: 'offense',
    icon: 'webfrontend/ui/icons/icn_repair_off_points.png',
    tooltip: 'Repair all damaged offense units'
  }),
  Object.freeze({
    action: 'defense',
    availability: 'defense',
    icon: 'FactionUI/icons/icon_def_army_points.png',
    tooltip: 'Repair all damaged defense units'
  }),
  Object.freeze({
    action: 'collect',
    availability: 'collect',
    icon: 'FactionUI/icons/icon_collect_packages.png',
    tooltip: 'Collect completed packages from all owned bases'
  })
]);

const HEADER_MODULES = Object.freeze([
  Object.freeze({ moduleId: 'upgrade-manager', label: 'Quick Upgrade', icon: 'FactionUI/icons/icon_building_detail_upgrade.png', quickUpgrade: true }),
  Object.freeze({ moduleId: 'resource-transfer', label: 'Transfer All Resources', icon: 'FactionUI/icons/icon_transfer_resource.png', quickTransfer: true }),
  Object.freeze({ moduleId: 'layout-optimizer', label: 'Base Layout Optimizer', icon: 'FactionUI/icons/icon_load_save.png' })
]);

const RIGHT_MODULE_GROUPS = Object.freeze([
  Object.freeze({ title: 'Base Tools', modules: Object.freeze([
    Object.freeze({ moduleId: 'upgrade-manager', label: 'Upgrade Manager', icon: suiteIcon('upgrade') }),
    Object.freeze({ moduleId: 'resource-transfer', label: 'Resource Transfer', icon: suiteIcon('transfer') }),
    Object.freeze({ moduleId: 'layout-optimizer', label: 'Layout Optimizer', icon: suiteIcon('layout') }),
    Object.freeze({ moduleId: 'base-intelligence', label: 'Player Intelligence', icon: suiteIcon('intelligence') })
  ]) }),
  Object.freeze({ title: 'World & Combat', modules: Object.freeze([
    Object.freeze({ moduleId: 'scanner', label: 'Scanner', icon: 'webfrontend/ui/icons/efficiency_icons/icon_efficiency_target_range.png' }),
    Object.freeze({ moduleId: 'war-room', label: 'War Room', icon: suiteIcon('war-room') }),
    Object.freeze({ moduleId: 'alliance', label: 'Alliance Intelligence', icon: suiteIcon('alliance') }),
    Object.freeze({ moduleId: 'context-actions', label: 'Context Actions', icon: suiteIcon('context') }),
    Object.freeze({ moduleId: 'next-mcv', label: 'Next MCV', icon: suiteIcon('mcv-clock'), embedded: true })
  ]) }),
  Object.freeze({ title: 'Analysis', modules: Object.freeze([
    Object.freeze({ moduleId: 'combat-reports', label: 'Combat Reports', icon: 'FactionUI/icons/icon_reports_total_victory.png' }),
    Object.freeze({ moduleId: 'research-eta', label: 'Research Center', icon: suiteIcon('research-eta') }),
    Object.freeze({ moduleId: 'tactical-map', label: 'Tactical Map', icon: suiteIcon('map') }),
    Object.freeze({ moduleId: 'world-tools', label: 'World Map Tools', icon: suiteIcon('world') }),
    Object.freeze({ moduleId: 'support-manager', label: 'Support Manager', icon: suiteIcon('support') }),
    Object.freeze({ moduleId: 'external-tools', label: 'External Analysis', icon: suiteIcon('external') }),
    Object.freeze({ moduleId: 'communications', label: 'Communications', icon: suiteIcon('communications') })
  ]) }),
  Object.freeze({ title: 'Suite', modules: Object.freeze([
    Object.freeze({ moduleId: 'module-manager', label: 'Module Manager', icon: suiteIcon('modules') }),
    Object.freeze({ moduleId: 'api-inspector', label: 'API Inspector', icon: suiteIcon('inspect-data') }),
    Object.freeze({ moduleId: 'ui-tools', label: 'UI Tools', icon: suiteIcon('ui-tools') }),
    Object.freeze({ moduleId: 'hotkeys', label: 'Hotkeys', icon: suiteIcon('hotkeys') }),
    Object.freeze({ moduleId: 'suite-status', label: 'Suite Status', icon: 'webfrontend/ui/common/icon_moral_alert_orange.png' }),
    Object.freeze({ moduleId: 'command-manual', label: 'Command Manual', icon: suiteIcon('command-manual') }),
    Object.freeze({ moduleId: 'launcher', label: 'Suite Dashboard', icon: 'FactionUI/icons/icon_attack_start_combat.png' })
  ]) })
]);

const NEXT_MCV_MODULE = Object.freeze({
  moduleId: 'next-mcv',
  label: 'Next MCV',
  embedded: true
});

const HEADER_DOCK_GAP = 0;
const BUTTON_SIZE = 31;
const BUTTON_GAP = 4;
const SUITE_COLLAPSED_KEY = 'cnc-ta-suite:quick-dock:suite-collapsed';
const NEXT_MCV_OPEN_KEY = 'cnc-ta-suite:quick-dock:next-mcv-open';

function savedBoolean(key, fallback) {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value == null ? fallback : value === 'true';
  } catch { return fallback; }
}

function saveBoolean(key, value) {
  try { globalThis.localStorage?.setItem(key, String(Boolean(value))); }
  catch { /* Dock visibility preferences are non-critical. */ }
}

export function rightDockDefinitions() {
  return Object.freeze([
    MANAGER_BUTTON,
    ...QUICK_REPAIRS.filter((item) => item.action !== 'collect'),
    ...RIGHT_MODULE_GROUPS.flatMap((group) => group.modules)
  ]);
}

export class RepairQuickDock {
  constructor({ context, hub, runAction, openManager }) {
    this.context = context;
    this.hub = hub;
    this.runAction = runAction;
    this.openManager = openManager;
    this.container = null;
    this.root = null;
    this.playArea = null;
    this.listenerIds = [];
    this.windowResizeHandler = null;
    this.buttons = new Map();
    this.busy = new Set();
    this.dockMode = 'vertical';
    this.navigationButtons = new Map();
    this.navigationGroupTitles = new Map();
    this.navigationHost = null;
    this.nextMCVPanel = null;
    this.destroyed = false;
    // Start every game load with the large Suite shortcut palette collapsed.
    // Expanding it remains a session action rather than a startup preference.
    this.shortcutsCollapsed = true;
    saveBoolean(SUITE_COLLAPSED_KEY, true);
    this.nextMCVOpen = savedBoolean(NEXT_MCV_OPEN_KEY, true);
  }

  build() {
    if (this.destroyed) return null;
    if (this.container && !this.container.isDisposed?.()) return this.container;
    const qx = globalThis.qx;
    const application = qx?.core?.Init?.getApplication?.();
    const root = application?.getDesktop?.() ?? application?.getRoot?.();
    if (!qx || !root) throw new Error('The game desktop is unavailable for quick-repair controls.');
    this.root = root;
    this.playArea = application?.getPlayArea?.() ?? null;

    this.container = new qx.ui.container.Composite(new qx.ui.layout.VBox(4)).set({
      padding: 0,
      backgroundColor: 'transparent',
      zIndex: 11
    });

    const ButtonClass = globalThis.webfrontend?.ui?.SoundButton ?? qx.ui.form.Button;
    // The manager launcher belongs only in the right navigation. The base-view
    // header keeps immediate base tools/actions and no duplicate manager icon.
    for (const definition of [...HEADER_MODULES, ...QUICK_REPAIRS]) {
      const button = new ButtonClass(null, definition.icon).set({
        width: 31,
        height: 31,
        minWidth: 31,
        maxWidth: 31,
        minHeight: 31,
        maxHeight: 31,
        toolTipText: definition.tooltip ?? `Open ${definition.label}`,
        show: 'icon',
        appearance: 'button-friendlist-scroll',
        center: true,
        allowGrowX: false,
        allowGrowY: false
      });
      button.addListener('appear', () => {
        const icon = button.getChildControl?.('icon', true);
        icon?.set?.({ width: 23, height: 23, scale: true });
      });
      button.addListener('execute', () => { void this.execute(definition); });
      button.setEnabled(definition.action === 'manager' || Boolean(definition.moduleId));
      this.buttons.set(definition.moduleId ?? definition.availability ?? definition.action, button);
      this.container.add(button);
    }

    root.add(this.container, { left: 0, top: 0 });
    for (const widget of [this.root, this.playArea]) {
      if (!widget?.addListener) continue;
      for (const event of ['resize', 'move']) {
        try {
          const id = widget.addListener(event, () => this.reposition());
          this.listenerIds.push({ widget, id });
        } catch {
          // Not every Qooxdoo game widget publishes both layout events.
        }
      }
    }
    this.windowResizeHandler = () => this.reposition();
    globalThis.addEventListener?.('resize', this.windowResizeHandler);
    this.container.show();
    this.reposition();
    return this.container;
  }

  findBaseHeaderAnchor() {
    const viewportWidth = Number(globalThis.innerWidth || 0);
    const selectors = '.qx-button-friendlist-scroll-disabled, .qx-button-friendlist-scroll';
    let best = null;
    for (const button of globalThis.document?.querySelectorAll?.(selectors) ?? []) {
      const holder = button.parentElement;
      const baseSelector = holder?.nextElementSibling;
      const holderRect = holder?.getBoundingClientRect?.();
      const selectorRect = baseSelector?.getBoundingClientRect?.();
      if (!holderRect || !selectorRect) continue;
      const holderMatches = holderRect.width >= 30 && holderRect.width <= 45
        && holderRect.height >= 30 && holderRect.height <= 45;
      const selectorMatches = selectorRect.width >= 150 && selectorRect.width <= 250
        && selectorRect.height >= 20 && selectorRect.height <= 35;
      const inBaseHeader = holderRect.top >= 100
        && (!viewportWidth || holderRect.left >= viewportWidth * 0.5);
      if (!holderMatches || !selectorMatches || !inBaseHeader) continue;
      if (!best || holderRect.left > best.left) best = {
        left: holderRect.left,
        top: holderRect.top,
        width: holderRect.width,
        height: holderRect.height,
        holder
      };
    }
    return best;
  }

  findNavigationAnchor() {
    for (const element of globalThis.document?.querySelectorAll?.('.qx-button-standard, .qx-button-standard-disabled') ?? []) {
      if (String(element.textContent ?? '').trim().toLowerCase() !== 'collect resources') continue;
      const hostElement = element.closest?.('.qx-pane-navigation-bar');
      const rect = hostElement?.getBoundingClientRect?.();
      if (rect?.width >= 120 && rect?.height >= 100) return { element, hostElement, rect };
    }
    return null;
  }

  hasBlockingOverlay() {
    const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
    for (const widget of Object.values(registry)) {
      if (!widget || widget === this.container || widget === this.navigationPanel) continue;
      const className = String(
        widget.classname
        ?? widget.constructor?.classname
        ?? widget.constructor?.name
        ?? ''
      );
      if (!/(?:Overlay|Window|Dialog)$/i.test(className)) continue;
      try {
        if (widget.isDisposed?.()) continue;
        if (widget.getVisibility?.() !== 'visible') continue;
        if (typeof widget.isSeeable === 'function' && !widget.isSeeable()) continue;
        const bounds = widget.getBounds?.();
        if (Number(bounds?.width || 0) >= 420 && Number(bounds?.height || 0) >= 260) {
          return true;
        }
      } catch {
        // Ignore stale Qooxdoo registry entries while native overlays rebuild.
      }
    }
    return false;
  }

  widgetFromElement(element) {
    const Widget = globalThis.qx?.ui?.core?.Widget;
    try {
      const direct = Widget?.getWidgetByElement?.(element);
      if (direct) return direct;
    } catch { /* Fall through to the object registry. */ }
    const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
    for (const candidate of Object.values(registry)) {
      if (!candidate?.getContentElement || !candidate?.getLayoutParent) continue;
      try {
        if (candidate.getContentElement()?.getDomElement?.() === element) return candidate;
      } catch { /* Disposed registry entry. */ }
    }
    return null;
  }

  embedNavigationPanel(anchor) {
    const section = this.widgetFromElement(anchor.hostElement);
    const parent = section?.getLayoutParent?.();
    const sectionBounds = section?.getBounds?.();
    const parentBounds = parent?.getBounds?.();
    if (!parent?.add || !sectionBounds || !parentBounds) return false;
    const panelHeight = Math.max(156, Number(this.navigationPanel?.getSizeHint?.()?.height || 0));
    const insertionTop = sectionBounds.top;
    const shifted = [];
    try {
      for (const child of parent.getChildren?.() ?? []) {
        if (child === this.navigationPanel) continue;
        const properties = child.getLayoutProperties?.() ?? {};
        if (Number(properties.top) < insertionTop) continue;
        shifted.push({ child, top: properties.top });
        child.setLayoutProperties({ top: Number(properties.top) + panelHeight });
      }
      parent.add(this.navigationPanel, {
        left: sectionBounds.left,
        top: insertionTop
      });
      this.navigationEmbed = {
        parent,
        baseHeight: parentBounds.height,
        panelHeight,
        originalHeight: parent.getHeight?.(),
        originalMinHeight: parent.getMinHeight?.(),
        shifted
      };
      parent.set?.({
        height: parentBounds.height + panelHeight,
        minHeight: parentBounds.height + panelHeight
      });
      return true;
    } catch {
      for (const item of shifted) {
        if (!item.child?.isDisposed?.()) item.child.setLayoutProperties?.({ top: item.top });
      }
      return false;
    }
  }

  installNavigationButtons() {
    if (this.destroyed || this.navigationPanel?.isDisposed?.()) {
      this.navigationButtons.clear();
      this.navigationGroupTitles.clear();
      this.navigationPanel = null;
    }
    const anchor = this.findNavigationAnchor();
    if (!anchor) {
      this.navigationPanel?.exclude?.();
      return false;
    }
    if (this.navigationPanel?.isDisposed?.()) {
      this.navigationButtons.clear();
      this.navigationPanel = null;
    }
    const qx = globalThis.qx;
    if (!this.navigationPanel) {
      const ButtonClass = qx.ui.form.Button;
      const IconButtonClass = globalThis.webfrontend?.ui?.SoundButton ?? ButtonClass;
      const nativeSection = this.widgetFromElement(anchor.hostElement);
      const nativeBottom = this.widgetFromElement(
        anchor.hostElement.nextElementSibling?.classList?.contains('qx-pane-navigation-bar-bottom')
          ? anchor.hostElement.nextElementSibling
          : null
      );
      const fallbackPane = new qx.ui.decoration.Decorator(1, 'solid', '#859397');
      fallbackPane.setBackgroundColor?.('#b8c3c5');
      fallbackPane.setRadiusTopLeft?.(8);
      fallbackPane.setRadiusBottomLeft?.(8);
      const fallbackBottom = new qx.ui.decoration.Decorator(1, 'solid', '#859397');
      fallbackBottom.setBackgroundColor?.('#aebabc');
      fallbackBottom.setRadiusBottomLeft?.(8);
      this.navigationPanel = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({
        width: 128,
        padding: 0,
        backgroundColor: 'transparent',
        zIndex: 11
      });
      const sectionTitle = (text) => new qx.ui.basic.Label(text).set({
        width: 122,
        height: 22,
        minHeight: 22,
        textAlign: 'center',
        font: 'bold',
        textColor: '#ffffff',
        backgroundColor: '#0b617d',
        paddingTop: 2
      });
      const makeSection = (titleText) => {
        const section = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({ width: 128 });
        const body = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({
          width: 128,
          paddingTop: 4,
          paddingLeft: 3,
          paddingRight: 3,
          paddingBottom: 4,
          decorator: nativeSection?.getDecorator?.() ?? fallbackPane
        });
        let title = null;
        if (titleText) {
          title = sectionTitle(titleText);
          body.add(title);
        }
        const bottom = new qx.ui.core.Widget().set({
          width: 128,
          height: 15,
          minHeight: 15,
          maxHeight: 15,
          decorator: nativeBottom?.getDecorator?.() ?? fallbackBottom
        });
        section.add(body);
        section.add(bottom);
        this.navigationPanel.add(section);
        return { section, body, title };
      };
      const makeIconButton = (definition) => {
        const button = new IconButtonClass(null, definition.icon).set({
          width: BUTTON_SIZE, minWidth: BUTTON_SIZE, maxWidth: BUTTON_SIZE,
          height: BUTTON_SIZE, minHeight: BUTTON_SIZE, maxHeight: BUTTON_SIZE,
          allowGrowX: false, allowGrowY: false,
          show: 'icon', appearance: 'button-friendlist-scroll', center: true,
          toolTipText: definition.tooltip ?? `Open ${definition.label}`
        });
        button.addListener('appear', () => {
          button.getChildControl?.('icon', true)?.set?.({ width: 23, height: 23, scale: true });
        });
        button.addListener('execute', () => { void this.execute(definition); });
        this.navigationButtons.set(definition.moduleId ?? definition.availability ?? definition.action, button);
        return button;
      };

      const toolsSection = makeSection('CnC-TA Suite');
      toolsSection.title.set?.({ cursor: 'pointer', toolTipText: 'Collapse or expand Suite shortcuts' });
      this.shortcutContent = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      toolsSection.body.add(this.shortcutContent);
      toolsSection.title.addListener('tap', () => this.toggleShortcutContent());

      const addIconGroup = (titleText, definitions) => {
        const groupBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
        const groupLabel = new qx.ui.basic.Label(titleText).set({
          width: 122,
          textAlign: 'center',
          font: 'bold',
          textColor: '#344448'
        });
        groupBox.add(groupLabel);
        for (let index = 0; index < definitions.length; index += 3) {
          const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(BUTTON_GAP, 'center'));
          for (const definition of definitions.slice(index, index + 3)) {
            row.add(makeIconButton(definition));
          }
          groupBox.add(row);
        }
        this.shortcutContent.add(groupBox);
        this.navigationGroupTitles.set(titleText, groupBox);
      };

      addIconGroup('Repair', [
        MANAGER_BUTTON,
        ...QUICK_REPAIRS.filter((item) => item.action !== 'collect')
      ]);
      for (const group of RIGHT_MODULE_GROUPS) addIconGroup(group.title, group.modules);
      this.shortcutContent.setVisibility?.(this.shortcutsCollapsed ? 'excluded' : 'visible');

      const nextMCVSection = makeSection(null);
      nextMCVSection.section.exclude();
      this.nextMCVBody = nextMCVSection.body;
      this.nextMCVSection = nextMCVSection.section;
      if (this.nextMCVOpen) this.setNextMCVPanelVisible(true, false);
      if (!this.embedNavigationPanel(anchor)) {
        this.root.add(this.navigationPanel, { left: 0, top: 0 });
      }
    }
    if (this.navigationEmbed?.parent && !this.navigationEmbed.parent.isDisposed?.()) {
      this.navigationPanel?.show?.();
      this.navigationHost = anchor.hostElement;
      return true;
    }
    const rootLocation = this.root?.getContentLocation?.() ?? { left: 0, top: 0 };
    this.navigationPanel.setLayoutProperties({
      left: Math.round(anchor.rect.left - Number(rootLocation.left || 0)),
      top: Math.round(anchor.rect.bottom - Number(rootLocation.top || 0) + 6)
    });
    this.navigationPanel?.show?.();
    this.navigationHost = anchor.hostElement;
    return true;
  }

  toggleShortcutContent() {
    this.shortcutsCollapsed = !this.shortcutsCollapsed;
    saveBoolean(SUITE_COLLAPSED_KEY, this.shortcutsCollapsed);
    this.shortcutContent?.setVisibility?.(this.shortcutsCollapsed ? 'excluded' : 'visible');
    globalThis.qx?.ui?.core?.queue?.Manager?.flush?.();
    this.syncNavigationEmbedHeight();
  }

  setDockMode(mode) {
    if (this.dockMode === mode) return;
    const qx = globalThis.qx;
    this.container.setLayout(mode === 'horizontal'
      ? new qx.ui.layout.HBox(BUTTON_GAP)
      : new qx.ui.layout.VBox(BUTTON_GAP));
    this.dockMode = mode;
  }

  reposition() {
    if (!this.container || this.container.isDisposed?.()) return;
    this.installNavigationButtons();
    this.navigationPanel?.show?.();
    const buttonCount = [...this.buttons.values()].filter((button) =>
      button.getVisibility?.() !== 'excluded'
    ).length || 1;
    const horizontalWidth = buttonCount * BUTTON_SIZE + (buttonCount - 1) * BUTTON_GAP;
    const headerAnchor = this.findBaseHeaderAnchor();
    if (headerAnchor) {
      this.setDockMode('horizontal');
      const anchorWidget = this.widgetFromElement(headerAnchor.holder);
      const headerParent = anchorWidget?.getLayoutParent?.();
      if (headerParent?.add) {
        const currentParent = this.container.getLayoutParent?.();
        if (currentParent !== headerParent) {
          currentParent?.remove?.(this.container);
          headerParent.add(this.container, { left: 0, top: 0 });
        }
      }
      if (this.nativePackageHolder && this.nativePackageHolder !== headerAnchor.holder) {
        this.nativePackageHolder.style.visibility = '';
      }
      this.nativePackageHolder = headerAnchor.holder;
      this.nativePackageHolder.style.visibility = 'hidden';
      const parentLocation = this.container.getLayoutParent?.()?.getContentLocation?.()
        ?? this.root?.getContentLocation?.()
        ?? { left: 0, top: 0 };
      const left = Math.max(4, Math.round(
        headerAnchor.left - Number(parentLocation.left || 0)
        - horizontalWidth + BUTTON_SIZE - HEADER_DOCK_GAP
      ));
      const top = Math.max(4, Math.round(
        headerAnchor.top - Number(parentLocation.top || 0) + 5
      ));
      this.container.setLayoutProperties?.({ left, top });
      this.container.show();
      return;
    }
    if (this.nativePackageHolder) this.nativePackageHolder.style.visibility = '';
    this.nativePackageHolder = null;
    this.container.exclude();
  }

  async execute(definition) {
    if (definition.moduleId) {
      try {
        if (definition.quickUpgrade) {
          const module = this.context.modules?.get?.(definition.moduleId);
          if (typeof module?.openQuick !== 'function') throw new Error('Quick Upgrade is unavailable.');
          if (this.closeManagedWindows(['upgrade-manager-quick'])) return;
          await module.openQuick();
          return;
        }
        if (definition.quickTransfer) {
          const module = this.context.modules?.get?.(definition.moduleId);
          if (typeof module?.openQuickTransfer !== 'function') throw new Error('Quick resource transfer is unavailable.');
          await module.openQuickTransfer();
          return;
        }
        if (definition.embedded) {
          this.toggleNextMCVPanel();
          return;
        }
        if (this.closeModuleWindows(definition.moduleId)) return;
        await this.context.modules?.open?.(definition.moduleId);
      } catch (error) {
        const message = `Unable to open ${definition.label}: ${error?.message ?? error}`;
        this.context.logger?.warn?.(message, error);
        this.context.notifications?.show?.(message);
      }
      return;
    }
    if (definition.action === 'manager') {
      try {
        if (this.closeManagedWindows(['repair-manager'])) return;
        await this.openManager?.();
      } catch (error) {
        const message = `Unable to open Repair & Collection Manager: ${error?.message ?? error}`;
        this.context.logger?.warn?.(message, error);
        this.context.notifications?.show?.(message);
      }
      return;
    }
    if (this.busy.has(definition.action)) return;
    this.busy.add(definition.action);
    const button = this.buttons.get(definition.availability);
    button?.setEnabled?.(false);
    try {
      const result = await this.runAction(definition.action, { manual: true });
      this.context.notifications?.show?.(result.message);
    } catch (error) {
      const message = `Quick repair failed: ${error?.message ?? error}`;
      this.context.logger?.warn?.(message, error);
      this.context.notifications?.show?.(message);
    } finally {
      this.busy.delete(definition.action);
      button?.setEnabled?.(true);
      this.refresh();
    }
  }

  closeManagedWindows(ids) {
    const windows = this.context.windows?.windows;
    if (!windows) return false;
    const openIds = ids.filter((id) => {
      const record = windows.get?.(id);
      return record?.window && !record.window.isDisposed?.();
    });
    for (const id of openIds) this.context.windows.close?.(id);
    return openIds.length > 0;
  }

  closeModuleWindows(moduleId) {
    const windows = this.context.windows?.windows;
    const ids = windows ? [...windows.keys()].filter((id) =>
      id === moduleId || id.startsWith(`${moduleId}-`)
    ) : [];
    if (this.closeManagedWindows(ids)) return true;
    const module = this.context.modules?.get?.(moduleId);
    const nativeWindows = [
      module?.scannerWindow?.window,
      module?.scannerWindow?.layoutWindow?.window,
      module?.record?.window,
      module?.window?.record?.window
    ].filter((window) => window && !window.isDisposed?.() && window.isVisible?.() !== false);
    for (const window of nativeWindows) window.close?.();
    return nativeWindows.length > 0;
  }

  toggleNextMCVPanel() {
    const visible = !this.nextMCVPanel
      || this.nextMCVPanel.isDisposed?.()
      || this.nextMCVPanel.getVisibility?.() === 'excluded';
    this.setNextMCVPanelVisible(visible, true);
  }

  setNextMCVPanelVisible(visible, persist = true) {
    this.nextMCVOpen = Boolean(visible);
    if (persist) saveBoolean(NEXT_MCV_OPEN_KEY, this.nextMCVOpen);
    if (this.nextMCVOpen && (!this.nextMCVPanel || this.nextMCVPanel.isDisposed?.())) {
      const module = this.context.modules?.get?.('next-mcv');
      if (typeof module?.buildEmbedded !== 'function') {
        throw new Error('The Next MCV embedded view is unavailable.');
      }
      this.nextMCVPanel = module.buildEmbedded(this.context);
      if (!this.nextMCVPanel || !this.nextMCVBody?.add) {
        this.nextMCVPanel = null;
        // Keep the requested open state. The Next MCV module can finish
        // enabling after the dock, and a later refresh will retry embedding it.
        return;
      }
      this.nextMCVPanel.set?.({ width: 122, maxWidth: 122, allowGrowX: false });
      this.nextMCVBody.add(this.nextMCVPanel);
      this.nextMCVSection.show?.();
    } else if (this.nextMCVOpen) {
      this.nextMCVPanel.show?.();
      this.nextMCVSection.show?.();
    } else {
      this.nextMCVPanel.exclude?.();
      this.nextMCVSection.exclude?.();
    }
    globalThis.qx?.ui?.core?.queue?.Manager?.flush?.();
    this.syncNavigationEmbedHeight();
  }

  syncNavigationEmbedHeight() {
    const embed = this.navigationEmbed;
    if (!embed?.parent || embed.parent.isDisposed?.()) return;
    const panelHeight = Math.max(156, Number(this.navigationPanel?.getSizeHint?.()?.height || 0));
    if (panelHeight === embed.panelHeight) return;
    embed.panelHeight = panelHeight;
    for (const item of embed.shifted ?? []) {
      if (!item.child?.isDisposed?.()) {
        item.child.setLayoutProperties?.({ top: Number(item.top) + panelHeight });
      }
    }
    embed.parent.set?.({
      height: embed.baseHeight + panelHeight,
      minHeight: embed.baseHeight + panelHeight
    });
  }

  refresh() {
    if (this.destroyed) return;
    try {
      if (!this.build()) return;
      this.installNavigationButtons();
      const availability = this.hub.actionAvailability();
      const modules = this.context.modules?.snapshot?.() ?? {};
      for (const definition of HEADER_MODULES) {
        const button = this.buttons.get(definition.moduleId);
        if (modules[definition.moduleId]?.state === 'enabled') {
          button?.show?.();
          button?.setEnabled?.(true);
        }
        else button?.exclude?.();
      }
      for (const group of RIGHT_MODULE_GROUPS) {
        const groupVisible = group.modules.some((definition) =>
          modules[definition.moduleId]?.state === 'enabled'
        );
        const groupBox = this.navigationGroupTitles.get(group.title);
        if (groupVisible) groupBox?.show?.();
        else groupBox?.exclude?.();
        for (const definition of group.modules) {
          const button = this.navigationButtons.get(definition.moduleId);
          if (modules[definition.moduleId]?.state === 'enabled') button?.show?.();
          else button?.exclude?.();
        }
      }
      if (modules[NEXT_MCV_MODULE.moduleId]?.state !== 'enabled') {
        this.nextMCVPanel?.exclude?.();
        this.nextMCVSection?.exclude?.();
      } else if (this.nextMCVOpen) {
        this.setNextMCVPanelVisible(true, false);
      }
      const managerButton = this.buttons.get('manager');
      managerButton?.show?.();
      managerButton?.setEnabled?.(true);
      const navigationManager = this.navigationButtons.get('manager');
      navigationManager?.show?.();
      navigationManager?.setEnabled?.(true);
      for (const definition of QUICK_REPAIRS) {
        const button = this.buttons.get(definition.availability);
        const navigationButton = this.navigationButtons.get(definition.availability);
        const enabled = availability[definition.availability]?.available > 0
          && !this.busy.has(definition.action);
        button?.show?.();
        button?.setEnabled?.(enabled);
        navigationButton?.show?.();
        navigationButton?.setEnabled?.(enabled);
      }
      globalThis.qx?.ui?.core?.queue?.Manager?.flush?.();
      this.syncNavigationEmbedHeight();
      this.reposition();
    } catch (error) {
      this.context.logger?.warn?.('Unable to refresh quick-repair controls.', error);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.windowResizeHandler) {
      globalThis.removeEventListener?.('resize', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
    for (const { widget, id } of this.listenerIds) {
      if (!widget?.isDisposed?.()) widget.removeListenerById?.(id);
    }
    this.listenerIds = [];
    this.buttons.clear();
    this.navigationButtons.clear();
    this.navigationGroupTitles.clear();
    if (this.nativePackageHolder) this.nativePackageHolder.style.visibility = '';
    this.nativePackageHolder = null;
    if (this.navigationEmbed?.parent && !this.navigationEmbed.parent.isDisposed?.()) {
      for (const item of this.navigationEmbed.shifted ?? []) {
        if (!item.child?.isDisposed?.()) item.child.setLayoutProperties?.({ top: item.top });
      }
      this.navigationEmbed.parent.set?.({
        height: this.navigationEmbed.originalHeight,
        minHeight: this.navigationEmbed.originalMinHeight
      });
    }
    this.navigationEmbed = null;
    if (this.navigationPanel && !this.navigationPanel.isDisposed?.()) this.navigationPanel.destroy();
    this.navigationPanel = null;
    this.navigationHost = null;
    this.nextMCVPanel = null;
    this.nextMCVBody = null;
    this.nextMCVSection = null;
    this.shortcutContent = null;
    this.shortcutsCollapsed = savedBoolean(SUITE_COLLAPSED_KEY, true);
    this.nextMCVOpen = savedBoolean(NEXT_MCV_OPEN_KEY, true);
    if (this.container && !this.container.isDisposed?.()) this.container.destroy();
    this.container = null;
    this.root = null;
    this.playArea = null;
    this.dockMode = 'vertical';
  }
}

export { MANAGER_BUTTON, QUICK_REPAIRS };

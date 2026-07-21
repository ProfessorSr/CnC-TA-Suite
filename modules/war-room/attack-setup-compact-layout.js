const nativeIcon = (name) => `FactionUI/icons/${name}.png`;
const suiteIcon = (name) => new URL(`../../assets/icons/${name}.svg`, import.meta.url).href;

function descendants(root, depth = 4) {
  const found = [];
  const visit = (widget, level) => {
    if (!widget || level > depth || found.includes(widget)) return;
    found.push(widget);
    try { for (const child of widget.getChildren?.() ?? []) visit(child, level + 1); } catch { /* Optional tree. */ }
  };
  visit(root, 0);
  return found;
}

export class AttackSetupCompactLayout {
  constructor({ context, hub }) {
    this.context = context;
    this.hub = hub;
    this.installed = false;
    this.hidden = [];
    this.rebuilt = [];
    this.listeners = [];
  }

  button(icon, tooltip, action, index, { width = 20, height = 20, appearance = 'button-friendlist-scroll' } = {}) {
    const qx = globalThis.qx;
    const Button = globalThis.webfrontend?.ui?.SoundButton ?? qx.ui.form.Button;
    const button = new Button(null, icon).set({
      width, minWidth: width, maxWidth: width,
      height, minHeight: height, maxHeight: height,
      allowGrowX: false, allowGrowY: false,
      show: 'icon', appearance, center: true, padding: 0,
      toolTipText: tooltip
    });
    button.addListener('appear', () => button.getChildControl?.('icon', true)?.set?.({
      width: Math.min(16, width), height: Math.min(16, height), scale: true
    }));
    button.addListener('execute', () => {
      try { this.hub.transformFormationSection(action, index); }
      catch (error) { this.context.logger?.warn?.('Compact formation control failed.', { action, index, error: error?.message ?? error }); }
    });
    return button;
  }

  rememberAndReplace(container, layout, children) {
    if (!container?.getChildren || !container?.add) return false;
    const previous = [...container.getChildren()].map((widget) => ({
      widget,
      layoutProperties: { ...(widget.getLayoutProperties?.() ?? {}) }
    }));
    const previousLayout = container.getLayout?.() ?? null;
    this.rebuilt.push({ container, previous, previousLayout });
    container.removeAll?.();
    container.setLayout?.(layout);
    for (const [widget, options] of children) {
      if (options) container.add(widget, options);
      else container.add(widget);
    }
    return true;
  }

  findWaveRows(mainContainer, rowCount) {
    const children = mainContainer?.getChildren?.() ?? [];
    let start = children.findIndex((child) => descendants(child, 2).some((widget) =>
      /(?:army\s*)?wave\s*1/i.test(String(widget.getValue?.() ?? widget.getLabel?.() ?? widget.$$user_value ?? ''))
    ));
    if (start < 0) {
      const candidates = children.map((child, index) => ({ child, index }))
        .filter(({ child }) => (child.getChildren?.()?.length ?? 0) > 0);
      for (let index = 0; index <= candidates.length - rowCount; index += 1) {
        const run = candidates.slice(index, index + rowCount);
        if (run.every((entry, offset) => entry.index === run[0].index + offset)) {
          start = run[0].index;
          break;
        }
      }
    }
    return start < 0 ? [] : children.slice(start, start + rowCount);
  }

  install() {
    if (this.installed) return true;
    const qx = globalThis.qx;
    const app = qx?.core?.Init?.getApplication?.();
    const attackBar = app?.getArmySetupAttackBar?.();
    if (!qx || !attackBar) return false;
    const root = this.hub.clientLib()?.root ?? globalThis.ClientLib;
    const path = root?.Data?.Missions?.PATH?.BAR_ATTACKSETUP;
    const armyRoot = (path != null ? app.getUIItem?.(path) : null) ?? attackBar;

    // Remove the two redundant horizontal control sections. Keep their exact
    // prior visibility so disabling War Room restores the native interface.
    for (const candidate of [attackBar, ...Object.values(attackBar).filter((value) => value && typeof value === 'object')]) {
      if (!['cnt_controls', 'btn_toggle'].includes(candidate?.objid)) continue;
      this.hidden.push({ widget: candidate, visibility: candidate.getVisibility?.() ?? 'visible' });
      candidate.exclude?.();
    }

    const rowCount = Number(root?.Base?.Util?.get_ArmyMaxSlotCountY?.() ?? 4);
    const mainContainer = attackBar.getMainContainer?.() ?? armyRoot;
    const rows = this.findWaveRows(mainContainer, rowCount);
    rows.forEach((row, index) => {
      const layout = new qx.ui.layout.HBox(2);
      const controls = [
        [this.button(suiteIcon('formation-mirror-horizontal'), `Mirror row ${index + 1}`, 'mirror-row', index, { appearance: 'button-addpoints' }), null],
        [new qx.ui.core.Spacer(), { flex: 1 }],
        [this.button(nativeIcon('icon_step_left_button'), `Shift row ${index + 1} left`, 'row-left', index, { appearance: 'button-addpoints' }), null],
        [this.button(nativeIcon('icon_step_right_button'), `Shift row ${index + 1} right`, 'row-right', index, { appearance: 'button-addpoints' }), null]
      ];
      this.rememberAndReplace(row, layout, controls);
    });

    this.installed = this.hidden.length > 0 || this.rebuilt.length > 0;
    return this.installed;
  }

  uninstall() {
    for (const { widget, id } of this.listeners) {
      try { widget.removeListenerById?.(id); } catch { /* Widget may already be disposed. */ }
    }
    this.listeners = [];
    for (const { container, previous, previousLayout } of this.rebuilt.reverse()) {
      if (container?.isDisposed?.()) continue;
      container.removeAll?.();
      if (previousLayout) container.setLayout?.(previousLayout);
      for (const { widget, layoutProperties } of previous) {
        if (Object.keys(layoutProperties).length) container.add?.(widget, layoutProperties);
        else container.add?.(widget);
      }
      container.setOpacity?.(1);
    }
    for (const { widget, visibility } of this.hidden) {
      if (widget?.isDisposed?.()) continue;
      widget.setVisibility?.(visibility);
    }
    this.rebuilt = [];
    this.hidden = [];
    this.installed = false;
  }
}

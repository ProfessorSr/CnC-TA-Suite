function number(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

const LABELS = Object.freeze({
  buildings: 'Buildings', defense: 'Defense', offense: 'Offense'
});

const RESOURCES = Object.freeze([
  Object.freeze({ id: 'tiberium', label: 'Tiberium', icon: 'webfrontend/ui/common/icn_res_tiberium.png' }),
  Object.freeze({ id: 'crystal', label: 'Crystal', icon: 'webfrontend/ui/common/icn_res_chrystal.png' }),
  Object.freeze({ id: 'credits', label: 'Credits', icon: 'webfrontend/ui/common/icn_res_dollar.png' }),
  Object.freeze({ id: 'power', label: 'Power', icon: 'webfrontend/ui/common/icn_res_power.png' })
]);

export class QuickUpgradeWindow {
  constructor({ context, hub }) {
    this.context = context;
    this.hub = hub;
    this.record = null;
    this.resourceRows = new Map();
    this.selectedKey = null;
    this.timer = null;
    this.viewKey = null;
  }

  palette() {
    return this.hub.faction() === 'nod'
      ? { accent: '#d94b43', dark: '#7f1714', glow: '#ff776f' }
      : { accent: '#16a9dc', dark: '#075d7b', glow: '#66d8ff' };
  }

  panel(qx, padding = 9) {
    const decorator = new qx.ui.decoration.Decorator(2, 'solid', this.palette().accent);
    decorator.setBackgroundColor?.('#c6d0d2');
    decorator.setRadius?.(8);
    decorator.setRadiusTopLeft?.(8);
    decorator.setRadiusTopRight?.(8);
    decorator.setRadiusBottomLeft?.(8);
    decorator.setRadiusBottomRight?.(8);
    return new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({
      padding,
      decorator
    });
  }

  build() {
    const qx = globalThis.qx;
    const colors = this.palette();
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 7 });

    const selected = this.panel(qx);
    selected.add(new qx.ui.basic.Label('Selected Building').set({
      font: 'bold', textAlign: 'center', textColor: colors.dark
    }));
    this.selectedName = new qx.ui.basic.Label('Select a building in the base view.').set({
      textAlign: 'center', textColor: '#253337', wrap: true
    });
    selected.add(this.selectedName);
    const selectedControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(7, 'center'));
    selectedControls.add(new qx.ui.basic.Label('Level').set({ textColor: '#253337', alignY: 'middle' }));
    this.selectedLevel = new qx.ui.form.Spinner(1, 1, 80).set({ width: 68, enabled: false });
    this.selectedLevel.addListener('changeValue', () => this.renderSelected());
    this.selectedUpgrade = new qx.ui.form.Button('Upgrade Selected').set({ enabled: false });
    this.selectedUpgrade.addListener('execute', () => this.applySelected());
    selectedControls.add(this.selectedLevel);
    selectedControls.add(this.selectedUpgrade);
    selected.add(selectedControls);
    this.selectedCosts = new qx.ui.basic.Label('Costs: —').set({
      rich: true, wrap: true, textAlign: 'center', textColor: '#253337'
    });
    selected.add(this.selectedCosts);
    root.add(selected);

    const controls = this.panel(qx);
    this.heading = new qx.ui.basic.Label('Loading upgrade information…').set({
      font: 'bold', textAlign: 'center', textColor: colors.dark, wrap: true
    });
    controls.add(this.heading);
    const levelRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8, 'center'));
    levelRow.add(new qx.ui.basic.Label('Upgrade all to level').set({
      textColor: '#253337', font: 'bold', alignY: 'middle'
    }));
    const cap = Number(this.hub.root()?.Data?.MainData?.GetInstance?.()?.get_Server?.()?.get_PlayerUpgradeCap?.() || 80);
    this.level = new qx.ui.form.Spinner(1, 1, Math.max(1, cap)).set({ width: 72 });
    this.level.addListener('changeValue', () => this.render());
    levelRow.add(this.level);
    controls.add(levelRow);
    root.add(controls);

    const costs = this.panel(qx);
    costs.add(new qx.ui.basic.Label('Resources Required').set({
      font: 'bold', textAlign: 'center', textColor: colors.dark
    }));
    for (const resource of RESOURCES) {
      const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
      row.add(new qx.ui.basic.Image(resource.icon).set({ width: 20, height: 20, scale: true }));
      const label = new qx.ui.basic.Label(`${resource.label}: —`).set({
        rich: true, alignY: 'middle', wrap: true
      });
      row.add(label, { flex: 1 });
      costs.add(row);
      this.resourceRows.set(resource.id, label);
    }
    root.add(costs, { flex: 1 });

    const actions = this.panel(qx, 7);
    const buttonRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8, 'center'));
    const refresh = new qx.ui.form.Button('Refresh');
    this.upgrade = new qx.ui.form.Button('Upgrade All');
    refresh.addListener('execute', () => this.render());
    this.upgrade.addListener('execute', () => this.apply());
    buttonRow.add(refresh);
    buttonRow.add(this.upgrade);
    actions.add(buttonRow);
    this.status = new qx.ui.basic.Label('').set({ textAlign: 'center', font: 'bold' });
    actions.add(this.status);
    root.add(actions);

    root.addListenerOnce('dispose', () => {
      clearInterval(this.timer);
      this.timer = null;
    });
    this.render(true);
    this.renderSelected(true);
    this.timer = setInterval(() => this.refreshForCurrentView(), 750);
    return root;
  }

  refreshForCurrentView() {
    if (!this.record?.window || this.record.window.isDisposed?.()) return;
    const cityId = this.hub.cityId(this.hub.currentCity());
    const scope = this.hub.currentScope();
    const nextKey = `${cityId}:${scope}`;
    if (nextKey !== this.viewKey) {
      this.viewKey = nextKey;
      this.selectedKey = null;
      this.render(true);
      this.renderSelected(true);
      return;
    }
    this.render();
    this.renderSelected();
  }

  renderSelected(reset = false) {
    try {
      if (!this.selectedLevel || this.selectedLevel.isDisposed?.()) return;
      const cap = this.selectedLevel.getMaximum();
      const probe = this.hub.selectedUpgradePlan(cap);
      if (!probe) {
        this.selectedKey = null;
        this.selectedName.setValue('Select a building or unit in the current base view.');
        this.selectedCosts.setValue('Costs: —');
        this.selectedLevel.setEnabled(false);
        this.selectedUpgrade.setEnabled(false);
        return;
      }
      const key = `${probe.scope}:${probe.name}:${probe.level}`;
      if (reset || key !== this.selectedKey) {
        this.selectedKey = key;
        this.selectedLevel.setMinimum(Math.min(cap, probe.level + 1));
        this.selectedLevel.setValue(Math.min(cap, probe.level + 1));
      }
      const plan = this.hub.selectedUpgradePlan(Number(this.selectedLevel.getValue()));
      this.selectedPlan = plan;
      this.selectedName.setValue(`${plan.name} — level ${plan.level}`);
      this.selectedLevel.setEnabled(!plan.invalidLevel);
      if (plan.invalidLevel || !plan.costs) {
        this.selectedCosts.setValue('Choose a level above the current level.');
        this.selectedUpgrade.setEnabled(false);
        return;
      }
      this.selectedCosts.setValue(RESOURCES.filter((resource) => plan.costs[resource.id] > 0).map((resource) => {
        const sufficient = plan.shortfall[resource.id] <= 0;
        return `<span style="color:${sufficient ? '#19733a' : '#b32323'}"><b>${resource.label}</b> ${number(plan.costs[resource.id])}</span>`;
      }).join(' &nbsp; ') || 'No resources required.');
      this.selectedUpgrade.setEnabled(plan.affordable && Object.values(plan.costs).some((value) => value > 0));
    } catch (error) {
      this.selectedName?.setValue?.('Selected upgrade information is unavailable.');
      this.selectedCosts?.setValue?.('Costs: —');
      this.selectedUpgrade?.setEnabled?.(false);
    }
  }

  render(resetLevel = false) {
    try {
      if (!this.level || this.level.isDisposed?.()) return;
      if (resetLevel) {
        const scope = this.hub.currentScope();
        const suggested = this.hub.lowestUpgradeableLevel(scope);
        this.level.setValue(Math.min(this.level.getMaximum(), Math.max(1, suggested)));
      }
      const plan = this.hub.quickUpgradePlan(Number(this.level.getValue()));
      const colors = this.palette();
      this.plan = plan;
      this.viewKey = `${this.hub.cityId(this.hub.currentCity())}:${plan.scope}`;
      this.heading.setValue(`${plan.city} — Upgrade All ${LABELS[plan.scope]}`);
      this.heading.setTextColor(colors.dark);
      for (const resource of RESOURCES) {
        const needed = plan.costs[resource.id];
        const available = plan.resources[resource.id];
        const sufficient = available >= needed;
        const color = sufficient ? '#19733a' : '#b32323';
        this.resourceRows.get(resource.id)?.setValue?.(
          `<span style="color:${color}"><b>${resource.label}: ${number(needed)}</b><br>`
          + `Available: ${number(available)}${sufficient ? ' — Ready' : ` — Short ${number(needed - available)}`}</span>`
        );
      }
      const hasCost = Object.values(plan.costs).some((value) => value > 0);
      const noun = LABELS[plan.scope];
      const canUpgrade = plan.affordableCount > 0 && hasCost;
      this.upgrade.setEnabled(canUpgrade);
      this.upgrade.setLabel(
        plan.affordableCount >= plan.totalCount
          ? `Upgrade All ${noun}`
          : `Upgrade ${plan.affordableCount} ${noun}`
      );
      this.status.setTextColor(canUpgrade ? '#19733a' : '#b32323');
      this.status.setValue(!hasCost ? 'Nothing requires upgrading at this level.'
        : plan.affordable ? 'All required resources are available.'
          : canUpgrade ? `${plan.affordableCount} of ${plan.totalCount} can be upgraded now.`
            : 'Additional resources are required.');
    } catch (error) {
      this.heading?.setValue?.(error?.message ?? String(error));
      for (const label of this.resourceRows.values()) label.setValue('—');
      this.status?.setValue?.('Upgrade data is unavailable for the current view.');
      this.status?.setTextColor?.('#b32323');
      this.upgrade?.setEnabled?.(false);
    }
  }

  apply() {
    const targetLevel = Number(this.level?.getValue?.());
    const partialUnits = this.plan?.scope !== 'buildings' && !this.plan?.affordable;
    const result = partialUnits
      ? this.hub.upgradeAffordableToLevel(this.plan)
      : this.hub.upgradeAllToLevel(targetLevel, this.plan?.scope);
    if (result.success) {
      const upgraded = Number(result.upgraded ?? this.plan?.affordableCount ?? 0);
      this.context.notifications?.show?.(
        `Upgrading ${upgraded} ${LABELS[result.scope].toLowerCase()} toward level ${targetLevel}.`
      );
    } else {
      this.context.notifications?.show?.(`Upgrade failed: ${result.reason}`);
    }
    this.render();
  }

  applySelected() {
    const result = this.hub.upgradeSelectedToLevel(this.selectedPlan);
    if (result.success) this.context.notifications?.show?.(`Upgrading ${this.selectedPlan.name}.`);
    else this.context.notifications?.show?.(`Upgrade failed: ${result.reason}`);
    this.renderSelected();
    this.render();
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.render(true);
      this.record.window.open();
      this.record.window.setActive?.(true);
      return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'upgrade-manager-quick', title: 'Quick Upgrade', content: this.build(),
      x: 760, y: 90, width: 370, height: 570, resizable: true, singleton: true
    });
    return this.record;
  }
}

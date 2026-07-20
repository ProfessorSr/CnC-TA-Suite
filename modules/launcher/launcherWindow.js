import { SUITE_VERSION } from '../../core/utils/version.js';
import { availableModuleVersion, hasModuleUpdate, moduleStatus, moduleVersion } from '../../core/modules/modulePresentation.js';

function label(qx, value, options = {}) {
  return new qx.ui.basic.Label(value).set({ textColor: '#1d2b32', ...options });
}

function modules(context) {
  return [...(context.modules?.registry?.values?.() ?? [])].sort((left, right) =>
    String(left.name ?? left.id).localeCompare(String(right.name ?? right.id))
  );
}

function currentBase(context) {
  const client = context?.hub?.game?.services?.tryGet?.('clientLib');
  const cities = client?.getMainData?.()?.get_Cities?.();
  const city = cities?.get_CurrentOwnCity?.();
  return city ? {
    name: String(city.get_Name?.() ?? 'Current base'),
    level: Number(city.get_LvlBase?.() ?? city.get_BaseLevel?.() ?? 0),
    x: Number(city.get_X?.() ?? 0),
    y: Number(city.get_Y?.() ?? 0)
  } : null;
}

function metric(qx, value, caption, color) {
  const card = new qx.ui.container.Composite(new qx.ui.layout.VBox(1)).set({
    padding: 9, decorator: 'main', minWidth: 126, allowGrowX: true,
    cursor: 'pointer', toolTipText: `Show ${caption.toLowerCase()}`
  });
  card.add(label(qx, String(value), { font: 'bold', textColor: color, textAlign: 'center' }));
  card.add(label(qx, caption, { textColor: '#243c49', textAlign: 'center', font: 'bold' }));
  return card;
}

function statusRow(qx, title, status, color = '#62c985', detail = '') {
  const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(8)).set({ paddingTop: 1, paddingBottom: 1 });
  row.add(label(qx, title, { font: 'bold', textColor: '#10191d' }), { flex: 1 });
  row.add(label(qx, status, { textColor: color, toolTipText: detail || status }));
  return row;
}

function moduleRuntimeStatus(context, id) {
  const module = context.modules?.get?.(id);
  const state = context.modules?.getState?.(id) ?? 'registered';
  if (id === 'scanner' && state === 'enabled') {
    const scan = module?.controller?.getState?.();
    if (scan?.error) return { label: 'Error', color: '#ff6666', detail: scan.error };
    if (scan?.running) return { label: 'Scanning', color: '#62c985' };
    if (scan?.progress?.phase === 'paused') return { label: 'Paused', color: '#d6b85a' };
    return { label: 'Idle', color: '#72b9e6' };
  }
  if (id === 'war-room' && state === 'enabled') return { label: 'Ready', color: '#62c985' };
  if (id === 'repair-manager' && state === 'enabled') {
    return { label: module?.running ? 'Working' : 'Active', color: '#62c985' };
  }
  return moduleStatus(state);
}

export function buildLauncherWindow(context) {
  const qx = globalThis.qx;
  const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(8)).set({ padding: 10, textColor: '#1d2b32' });
  let activeFilter = 'installed';
  const header = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
  const identity = new qx.ui.container.Composite(new qx.ui.layout.VBox(1));
  identity.add(label(qx, 'CnC-TA-Suite Dashboard', { font: 'bold', textColor: '#9fe8ff' }));
  identity.add(label(qx, `Suite v${SUITE_VERSION}`, { textColor: '#aebfc9' }));
  header.add(identity, { flex: 1 });
  const refresh = new qx.ui.form.Button('Refresh').set({ width: 76, toolTipText: 'Refresh dashboard data' });
  header.add(refresh);
  root.add(header);

  const tabs = new qx.ui.tabview.TabView();
  root.add(tabs, { flex: 1 });

  const overview = new qx.ui.tabview.Page('Overview').set({ layout: new qx.ui.layout.VBox(9), padding: 9 });
  const metrics = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
  overview.add(metrics);
  const current = new qx.ui.groupbox.GroupBox('Current Base').set({ layout: new qx.ui.layout.VBox(3), padding: 8 });
  const currentLabel = label(qx, 'No owned base is currently open.', { wrap: true });
  current.add(currentLabel);
  overview.add(current);
  const services = new qx.ui.groupbox.GroupBox('Live Module Status · Installed Modules').set({ layout: new qx.ui.layout.VBox(0), padding: 8 });
  const servicesScroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto' });
  servicesScroll.add(services);
  overview.add(servicesScroll, { flex: 1 });
  tabs.add(overview);

  const inventory = new qx.ui.tabview.Page('Modules').set({ layout: new qx.ui.layout.VBox(6), padding: 8 });
  const inventoryScroll = new qx.ui.container.Scroll();
  const inventoryList = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
  inventoryScroll.add(inventoryList); inventory.add(inventoryScroll, { flex: 1 }); tabs.add(inventory);

  const dependencies = new qx.ui.tabview.Page('Dependencies').set({ layout: new qx.ui.layout.VBox(6), padding: 8 });
  dependencies.add(label(qx, 'Module Dependency Graph', { font: 'bold', textColor: '#9fe8ff' }));
  dependencies.add(label(qx, 'Every module uses Suite Core. Declared module-to-module dependencies are shown beneath each module.', { wrap: true, textColor: '#17262d' }));
  const dependencyScroll = new qx.ui.container.Scroll();
  const dependencyList = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
  dependencyScroll.add(dependencyList); dependencies.add(dependencyScroll, { flex: 1 }); tabs.add(dependencies);

  let overviewSignature = '';
  let inventoryRendered = false;
  let dependenciesRendered = false;

  const renderInventory = (installed) => {
    if (inventoryRendered) return;
    inventoryRendered = true;
    for (const module of installed) {
      const state = moduleStatus(context.modules.getState(module.id));
      const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(8)).set({ padding: 6 });
      const info = new qx.ui.container.Composite(new qx.ui.layout.VBox(1));
      info.add(label(qx, module.name ?? module.id, { font: 'bold', textColor: '#000000' }));
      const available = availableModuleVersion(module);
      info.add(label(qx,
        `<span style="color:#006fa6"><b>v${moduleVersion(module)}</b></span>`
        + ` · <span style="color:#ffffff">Updated ${module.manifest?.lastUpdated ?? 'Unknown'}</span>`
        + ` · <span style="color:#000000">${module.manifest?.author || module.author || 'Unknown author'}</span>`
        + (hasModuleUpdate(module) ? ` · <span style="color:#a35d00">v${available} available</span>` : ''),
        { rich: true, textColor: '#000000' }
      ));
      row.add(info, { flex: 1 });
      row.add(label(qx, state.label, { textColor: state.color, alignY: 'middle' }));
      inventoryList.add(row);
    }
  };

  const renderDependencies = (installed) => {
    if (dependenciesRendered) return;
    dependenciesRendered = true;
    for (const module of installed) {
      const declared = module.dependencies ?? module.manifest?.dependencies ?? [];
      dependencyList.add(label(qx,
        `<b>Suite Core → ${module.name ?? module.id}</b>${declared.length ? `<br>↳ ${declared.join(' · ')}` : '<br>↳ No additional module dependencies'}`,
        { rich: true, padding: 6, textColor: declared.length ? '#005d85' : '#17262d' }
      ));
    }
  };

  const render = () => {
    if (root.isDisposed?.()) return;
    const installed = modules(context);
    const states = installed.map((module) => context.modules.getState(module.id));
    const running = states.filter((state) => state === 'enabled').length;
    const disabled = states.filter((state) => state === 'disabled').length;
    const updates = installed.filter(hasModuleUpdate);
    const base = currentBase(context);
    const runtime = installed.map((module) => {
      const status = moduleRuntimeStatus(context, module.id);
      return `${module.id}:${context.modules.getState(module.id)}:${status.label}:${status.detail ?? ''}`;
    });
    const signature = JSON.stringify([activeFilter, installed.length, running, disabled,
      updates.map((module) => module.id), base, runtime]);
    if (signature === overviewSignature) return;
    overviewSignature = signature;
    for (const child of metrics.removeAll()) child.destroy();
    const cards = [
      ['installed', metric(qx, installed.length, 'Installed Modules', '#006b92')],
      ['running', metric(qx, running, 'Running', '#157a38')],
      ['disabled', metric(qx, disabled, 'Disabled', '#4d5960')],
      ['updates', metric(qx, updates.length, 'Updates Available', updates.length ? '#a35d00' : '#176b91')]
    ];
    for (const [filter, card] of cards) {
      card.addListener('tap', () => { activeFilter = filter; render(); });
      metrics.add(card, { flex: 1 });
    }

    currentLabel.setValue(base
      ? `<b>${base.name}</b>${base.level ? ` · Level ${base.level}` : ''}<br>${base.x}:${base.y}`
      : 'No owned base is currently open.');
    currentLabel.setRich(true);

    for (const child of services.removeAll()) child.destroy();
    const visibleModules = activeFilter === 'running'
      ? installed.filter((module) => context.modules.getState(module.id) === 'enabled')
      : activeFilter === 'disabled'
        ? installed.filter((module) => context.modules.getState(module.id) === 'disabled')
        : activeFilter === 'updates' ? updates : installed;
    const filterTitle = { installed: 'Installed Modules', running: 'Running', disabled: 'Disabled', updates: 'Updates Available' }[activeFilter];
    services.setLegend?.(`Live Module Status · ${filterTitle}`);
    if (!visibleModules.length) services.add(label(qx, `No ${filterTitle.toLowerCase()} found.`, { textColor: '#253941' }));
    for (const module of visibleModules) {
      const status = moduleRuntimeStatus(context, module.id);
      services.add(statusRow(qx, module.name ?? module.id, status.label, status.color, status.detail));
    }

  };

  const renderSelectedTab = () => {
    const installed = modules(context);
    const selected = tabs.getSelection?.()?.[0];
    if (selected === inventory) renderInventory(installed);
    if (selected === dependencies) renderDependencies(installed);
  };
  const refreshAll = () => {
    overviewSignature = '';
    inventoryRendered = false;
    dependenciesRendered = false;
    for (const child of inventoryList.removeAll()) child.destroy();
    for (const child of dependencyList.removeAll()) child.destroy();
    render();
    renderSelectedTab();
  };
  refresh.addListener('execute', refreshAll);
  tabs.addListener('changeSelection', renderSelectedTab);
  root.__suiteDashboardRefresh = refreshAll;
  if (qx.event?.Timer) {
    const timer = new qx.event.Timer(2000);
    timer.addListener('interval', () => { if (root.isVisible?.()) render(); });
    timer.start();
    root.addListener('dispose', () => { timer.stop(); timer.dispose(); });
  }
  render();
  return root;
}

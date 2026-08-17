import { MANUAL_SECTIONS } from './manual-content.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function listHtml(title, items, ordered = false) {
  if (!items?.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<h3 style="color:#006b91;margin:12px 0 4px">${escapeHtml(title)}</h3><${tag} style="margin:3px 0 8px 22px;padding:0">`
    + items.map((item) => `<li style="margin:3px 0">${escapeHtml(item)}</li>`).join('') + `</${tag}>`;
}

function controlsHtml(controls) {
  if (!controls?.length) return '';
  return '<details open style="margin-top:10px"><summary style="color:#006b91;font-weight:bold;font-size:14px;cursor:pointer">Features, Buttons, and Controls</summary>'
    + '<table cellspacing="0" cellpadding="5" style="width:100%;border-collapse:collapse">'
    + controls.map(([name, description], index) => `<tr style="background:${index % 2 ? '#d7e0e3' : '#c8d3d7'}">`
      + `<td style="width:155px;color:#174b61;font-weight:bold;border-bottom:1px solid #9babb2">${escapeHtml(name)}</td>`
      + `<td style="color:#253940;border-bottom:1px solid #9babb2">${escapeHtml(description)}</td></tr>`).join('')
    + '</table></details>';
}

const RELATED = Object.freeze({
  'war-room': ['scanner', 'base-intelligence', 'combat-reports'], scanner: ['war-room', 'tactical-map', 'base-intelligence'],
  'base-intelligence': ['scanner', 'war-room', 'repair-manager'], 'repair-manager': ['base-intelligence', 'upgrade-manager'],
  'upgrade-manager': ['resource-transfer', 'layout-optimizer', 'base-intelligence'], 'resource-transfer': ['upgrade-manager', 'layout-optimizer'],
  'layout-optimizer': ['upgrade-manager', 'resource-transfer'], 'next-mcv': ['upgrade-manager', 'resource-transfer'],
  'context-actions': ['world-tools', 'tactical-map', 'war-room'], alliance: ['communications', 'world-tools'],
  'combat-reports': ['war-room', 'base-intelligence'], communications: ['alliance', 'context-actions'],
  'tactical-map': ['scanner', 'world-tools', 'context-actions'], 'world-tools': ['tactical-map', 'context-actions', 'alliance'],
  'support-manager': ['base-intelligence', 'repair-manager'], 'api-inspector': ['suite-status', 'command-manual'],
  'suite-status': ['api-inspector', 'module-manager'], 'ui-tools': ['module-manager', 'command-manual'],
  hotkeys: ['module-manager', 'command-manual'], 'external-tools': ['communications', 'combat-reports'],
  launcher: ['module-manager', 'suite-status'], 'module-manager': ['launcher', 'command-manual'],
  'command-manual': ['module-manager', 'suite-status']
});

function previewHtml(entry, module) {
  if (!module) return '';
  const buttons = entry.controls.slice(0, 5).map(([name], index) =>
    `<span style="display:inline-block;margin:3px;padding:4px 7px;border-radius:4px;color:#fff;background:${['#08779b', '#208443', '#986d08', '#754ca8', '#a33c38'][index]}">${escapeHtml(name)}</span>`
  ).join('');
  return '<h3 style="color:#006b91;margin:12px 0 5px">What to Expect</h3>'
    + `<div style="background:#222b30;border:2px solid #84969e;border-radius:6px;color:#fff;padding:0 8px 8px">`
    + `<div style="background:#08779b;margin:0 -8px 7px;padding:5px 8px;font-weight:bold">${escapeHtml(entry.title)} <span style="float:right">? Help &nbsp; ×</span></div>`
    + `<div style="color:#9fe8ff;margin-bottom:4px">${escapeHtml(entry.summary)}</div>${buttons || '<span style="color:#aebbc1">Information view</span>'}</div>`
    + '<div style="font-size:10px;color:#53656d">Representative UI preview; live controls vary with game state and current view.</div>';
}

function sectionHtml(entry, module, sections) {
  const metadata = module
    ? `<div style="margin:0 0 10px;color:#53656d">Installed module: <b>${escapeHtml(module.name ?? module.id)}</b> · v${escapeHtml(module.version)} · ${escapeHtml(module.state)}</div>`
    : '';
  const related = (RELATED[entry.id] ?? []).map((id) => sections.find((item) => item.id === id)?.title).filter(Boolean);
  const quickStart = entry.steps.slice(0, 3);
  return `<div style="padding:14px 16px;background:#c8d3d7;color:#17262d;border-top:4px solid #edf5f7;border-bottom:6px solid #667a83;border-radius:8px">`
    + `<h1 style="color:#075d7a;margin:0 0 5px;font-size:20px">${escapeHtml(entry.title)}</h1>${metadata}`
    + `<h3 style="color:#006b91;margin:8px 0 3px">Purpose</h3><p style="font-size:13px;line-height:1.45;margin:3px 0 8px">${escapeHtml(entry.summary)}</p>`
    + (entry.steps.length ? `<h3 style="color:#006b91;margin:8px 0 3px">When to Use It</h3><p style="margin:3px 0 8px">Common scenarios include: ${escapeHtml(entry.steps.slice(0, 2).join(' '))}</p>` : '')
    + listHtml('30-Second Quick Start', quickStart, true)
    + (entry.steps.length > 3 ? listHtml('Complete Walkthrough', entry.steps, true) : '')
    + controlsHtml(entry.controls)
    + listHtml('Tips & Tricks', entry.notes)
    + (related.length ? `<h3 style="color:#006b91;margin:12px 0 4px">Related Modules</h3><p>${escapeHtml(related.join(' · '))}</p>` : '')
    + previewHtml(entry, module)
    + '</div>';
}

function moduleRecords(context) {
  return [...(context.modules?.registry?.values?.() ?? [])]
    .filter((module) => context.modules.getState?.(module.id) === 'enabled')
    .map((module) => ({
      id: module.id, name: module.name ?? module.id, version: module.version ?? '0.0.0',
      state: context.modules.getState?.(module.id) ?? 'registered',
      description: module.manifest?.description ?? module.description ?? '',
      renderer: module.definition?.renderer ?? 'custom',
      manual: module.manual ?? module.manifest?.manual ?? null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function moduleManualSections(context) {
  return moduleRecords(context).filter((module) => module.manual).map((module) => ({
    ...module.manual,
    id: module.id,
    title: module.manual.title ?? module.name,
    summary: module.manual.summary ?? module.description,
    steps: module.manual.steps ?? [],
    controls: module.manual.controls ?? [],
    notes: module.manual.notes ?? []
  }));
}

export function manualSearch(query, sections = MANUAL_SECTIONS) {
  const normalized = String(query ?? '').trim().toLowerCase();
  if (!normalized) return sections.map((entry) => ({ id: entry.id, label: entry.title }));
  const results = [];
  for (const entry of sections) {
    if ([entry.title, entry.summary, ...entry.steps, ...entry.notes].join(' ').toLowerCase().includes(normalized)) {
      results.push({ id: entry.id, label: entry.title });
    }
    for (const [name, description] of entry.controls) {
      if (`${name} ${description}`.toLowerCase().includes(normalized)) {
        results.push({ id: entry.id, label: `${entry.title} — ${name}` });
      }
    }
  }
  return results;
}

export function buildCommandManual(context, owner = null) {
  const qx = globalThis.qx;
  const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 9, textColor: '#ffffff' });
  const search = new qx.ui.form.TextField().set({ placeholder: 'Search instructions, buttons, modules, or glossary…' });
  root.add(search);

  const body = new qx.ui.container.Composite(new qx.ui.layout.HBox(8)).set({ allowGrowY: true });
  root.add(body, { flex: 1 });
  const navigation = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ width: 235, minWidth: 235, allowGrowY: true });
  navigation.add(new qx.ui.basic.Label('Table of Contents').set({ font: 'bold', textColor: '#9fe8ff' }));
  const contents = new qx.ui.form.List();
  navigation.add(contents, { flex: 1 });
  const moduleButton = new qx.ui.form.Button('Enabled Modules');
  navigation.add(moduleButton);
  body.add(navigation, { flex: 0 });

  const articleHost = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ allowGrowY: true });
  const scroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto' });
  const article = new qx.ui.basic.Label('').set({ rich: true, wrap: true, selectable: true, textColor: '#17262d' });
  scroll.add(article);
  articleHost.add(scroll, { flex: 1 });
  const paging = new qx.ui.container.Composite(new qx.ui.layout.HBox(6, 'right'));
  const previous = new qx.ui.form.Button('Previous');
  const next = new qx.ui.form.Button('Next');
  paging.add(previous); paging.add(next); articleHost.add(paging);
  body.add(articleHost, { flex: 1 });

  let visible = [];
  let currentId = 'welcome';
  let currentQuery = '';

  const installed = () => moduleRecords(context);
  const sections = () => [
    ...MANUAL_SECTIONS,
    ...moduleManualSections(context)
  ];
  const moduleFor = (id) => installed().find((module) => module.id === id);
  const renderArticle = (id) => {
    const available = sections();
    const entry = available.find((item) => item.id === id) ?? available[0];
    currentId = entry.id;
    article.setValue(sectionHtml(entry, moduleFor(entry.id), available));
    const index = visible.findIndex((item) => item.id === currentId);
    previous.setEnabled(index > 0);
    next.setEnabled(index >= 0 && index < visible.length - 1);
  };
  const searchMatches = () => manualSearch(currentQuery, sections())
    .map((result) => ({ entry: sections().find((entry) => entry.id === result.id), label: result.label }))
    .filter((result) => result.entry && visible.some((entry) => entry.id === result.entry.id));
  const renderContents = () => {
    contents.removeAll();
    for (const result of searchMatches()) contents.add(new qx.ui.form.ListItem(result.label, null, result.entry.id));
    renderArticle(visible.some((entry) => entry.id === currentId) ? currentId : visible[0]?.id ?? 'welcome');
  };
  const refreshAvailableSections = () => {
    const available = sections();
    visible = currentQuery
      ? available.filter((entry) => searchText(entry).includes(currentQuery))
      : available;
    renderContents();
  };
  const searchText = (entry) => [entry.title, entry.summary, ...entry.steps, ...entry.notes, ...entry.controls.flat()].join(' ').toLowerCase();
  search.addListener('changeValue', (event) => {
    const query = String(event.getData() ?? '').trim().toLowerCase();
    currentQuery = query;
    const available = sections();
    visible = query ? available.filter((entry) => searchText(entry).includes(query)) : available;
    renderContents();
  });
  contents.addListener('changeSelection', (event) => {
    const id = event.getData()?.[0]?.getModel?.();
    if (id) renderArticle(id);
  });
  previous.addListener('execute', () => {
    const index = visible.findIndex((entry) => entry.id === currentId);
    if (index > 0) renderArticle(visible[index - 1].id);
  });
  next.addListener('execute', () => {
    const index = visible.findIndex((entry) => entry.id === currentId);
    if (index >= 0 && index < visible.length - 1) renderArticle(visible[index + 1].id);
  });
  moduleButton.addListener('execute', () => {
    article.setValue('<div style="padding:14px;background:#c8d3d7;color:#17262d;border-top:4px solid #edf5f7;border-bottom:6px solid #667a83;border-radius:8px">'
      + '<h1 style="color:#075d7a;margin-top:0">Enabled Modules</h1>'
      + installed().map((module) => `<div style="padding:6px;border-bottom:1px solid #9babb2"><b style="color:#174b61">${escapeHtml(module.name)}</b> `
        + `<span style="color:#006b91">v${escapeHtml(module.version)}</span> · ${escapeHtml(module.state)} · ${escapeHtml(module.renderer)}<br>`
        + `<span style="color:#53656d">${escapeHtml(module.description)}</span></div>`).join('') + '</div>');
  });

  context.events?.on?.('module:started', refreshAvailableSections);
  context.events?.on?.('module:stopped', refreshAvailableSections);
  context.events?.on?.('module:registered', refreshAvailableSections);
  context.events?.on?.('module:unloaded', refreshAvailableSections);

  visible = sections();
  renderContents();
  root.__suiteManualOpen = (id) => {
    search.setValue?.('');
    currentQuery = '';
    visible = sections();
    renderContents();
    renderArticle(sections().some((entry) => entry.id === id) ? id : 'welcome');
  };
  if (owner) owner.navigateManual = root.__suiteManualOpen;
  return root;
}

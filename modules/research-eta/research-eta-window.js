import { RESEARCH_CATALOG } from './research-catalog.js';

const compact = (value) => {
  const number = Number(value) || 0;
  for (const [size, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(number) >= size) return `${(number / size).toFixed(number >= size * 100 ? 0 : 2).replace(/\.0+$|(?<=\.[0-9])0$/, '')}${suffix}`;
  }
  return Math.round(number).toLocaleString();
};

function eta(remaining, hourly) {
  if (remaining <= 0) return 'Ready now';
  if (!(hourly > 0)) return 'Production unavailable';
  let seconds = Math.ceil(remaining / hourly * 3600);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export class ResearchEtaWindow {
  constructor({ context, owner }) {
    this.context = context;
    this.owner = owner;
    this.category = 'OFFENSE';
    this.page = 0;
    this.root = null;
  }

  build() {
    if (this.root && !this.root.isDisposed?.()) return this.root;
    const qx = globalThis.qx;
    this.root = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({ backgroundColor: '#263b46' });
    this.header = new qx.ui.basic.Label('').set({ rich: true, textAlign: 'center', padding: 8, font: 'bold', textColor: '#26343b', backgroundColor: '#d8ddde' });
    this.root.add(this.header);
    const tabs = new qx.ui.container.Composite(new qx.ui.layout.HBox(5)).set({ paddingTop: 10, paddingLeft: 25, paddingBottom: 8, backgroundColor: '#393a35' });
    for (const category of ['OFFENSE', 'DEFENSE', 'SPECIAL']) {
      const button = new qx.ui.form.Button(category);
      button.addListener('execute', () => { this.category = category; this.page = 0; this.render(); });
      tabs.add(button);
    }
    this.root.add(tabs);
    const body = new qx.ui.container.Composite(new qx.ui.layout.HBox(8)).set({ padding: 10, backgroundColor: '#b8d2db' });
    this.previous = new qx.ui.form.Button('◀').set({ width: 34 });
    this.previous.addListener('execute', () => { this.page -= 1; this.render(); });
    body.add(this.previous);
    this.grid = new qx.ui.container.Composite(new qx.ui.layout.Grid(8, 8));
    body.add(this.grid, { flex: 1 });
    this.next = new qx.ui.form.Button('▶').set({ width: 34 });
    this.next.addListener('execute', () => { this.page += 1; this.render(); });
    body.add(this.next);
    this.root.add(body, { flex: 1 });
    return this.root;
  }

  card(item, locked = false) {
    const qx = globalThis.qx;
    const resources = this.owner.resources();
    const state = this.owner.researchState(item.key);
    const researched = state.researched || (!item.credits && !item.rp && !locked);
    const creditsRemaining = Math.max(0, item.credits - resources.credits);
    const rpRemaining = Math.max(0, item.rp - resources.research);
    const card = new qx.ui.container.Composite(new qx.ui.layout.VBox(3)).set({
      width: 190, minWidth: 190, maxWidth: 190, height: 160, padding: 5,
      backgroundColor: locked ? '#aeb2b3' : '#d8ddde', textColor: '#202a2f',
      decorator: new qx.ui.decoration.Decorator(2, 'solid', locked ? '#646b6e' : '#2a9bd0')
    });
    card.add(new qx.ui.basic.Label(`${locked ? '★ ' : ''}${item.name}`).set({ font: 'bold', textAlign: 'center', textColor: '#fff', backgroundColor: locked ? '#70777a' : '#258fbe' }));
    if (item.image && !locked) card.add(new qx.ui.basic.Image(item.image).set({ width: 178, height: 55, scale: true }));
    card.add(new qx.ui.basic.Label(item.description).set({ wrap: true, font: 'small', minHeight: 30 }));
    if (locked) {
      card.add(new qx.ui.basic.Label(`Requires ${item.prerequisite}`).set({ font: 'bold', textColor: '#b00000', textAlign: 'center', marginTop: 8 }));
      return card;
    }
    if (researched) {
      card.add(new qx.ui.basic.Label('✓ Researched').set({ font: 'bold', textColor: '#8d7400', textAlign: 'right' }));
      return card;
    }
    card.add(new qx.ui.basic.Label(`Credits ${compact(item.credits)} · need ${compact(creditsRemaining)} · ${eta(creditsRemaining, resources.creditGrowthPerHour)}`).set({ wrap: true, font: 'small', textColor: '#00698d' }));
    card.add(new qx.ui.basic.Label(`RP ${compact(item.rp)} · need ${compact(rpRemaining)}`).set({ font: 'small', textColor: '#b00000' }));
    const research = new qx.ui.form.Button('Research').set({ enabled: state.available && creditsRemaining <= 0 && rpRemaining <= 0 });
    research.addListener('execute', () => { if (this.owner.performResearch(item.key)) setTimeout(() => this.render(), 250); });
    card.add(research);
    return card;
  }

  render() {
    const pages = RESEARCH_CATALOG[this.category];
    this.page = Math.max(0, Math.min(this.page, pages.length - 1));
    const resources = this.owner.resources();
    this.header.setValue(`<b>RESEARCH</b><br>⚗ ${compact(resources.research)} Research points &nbsp;&nbsp;&nbsp; ⓒ ${compact(resources.credits)} Credits`);
    this.previous.setEnabled(this.page > 0);
    this.next.setEnabled(this.page < pages.length - 1);
    for (const child of this.grid.removeAll()) child.destroy?.();
    pages[this.page].forEach((entry, column) => {
      this.grid.add(this.card(entry), { row: 0, column });
      const parentState = this.owner.researchState(entry.key);
      const parentResearched = parentState.researched || (!entry.credits && !entry.rp);
      if (entry.upgrade) this.grid.add(this.card(entry.upgrade, !parentResearched), { row: 1, column });
    });
  }

  async open() {
    if (this.owner.factionKind?.() !== 'gdi') {
      const overlay = await this.owner.prepareNative(this.category);
      this.owner.refresh?.();
      return overlay;
    }
    await this.context.windows.open({ id: 'research-eta', title: 'Research Center', content: this.build(), x: 70, y: 35, width: 760, height: 535, resizable: true, singleton: true });
    this.render();
  }
}

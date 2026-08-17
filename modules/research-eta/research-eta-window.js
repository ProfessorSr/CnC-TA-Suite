const compact = (value) => {
  const number = Number(value) || 0;
  for (const [size, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(number) >= size) return `${(number / size).toFixed(number >= size * 100 ? 0 : 2).replace(/\.0+$|(?<=\.[0-9])0$/, '')}${suffix}`;
  }
  return Math.round(number).toLocaleString();
};

const NATIVE_ART = Object.freeze({
  Militants: 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/17f51bc14d958a742c6bf2e879d7c38a.png',
  Reckoner: 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/11c43f0d7e5e0bd1fb70bc475e5a7a80.png',
  Venom: 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/230d7a45ea17bfc99f05f94bc1a96629.png',
  MilitantStealth: 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/675d40131318290e27250fbb86fa301d.png',
  ReckonerTransport: 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/ebe999ef9e89517bd248f5f5f482d473.png',
  VenomTransport: 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/925e276ebd9f246746a8aa6d9679f199.png'
});

export class ResearchEtaWindow {
  constructor({ context, owner }) {
    this.context = context;
    this.owner = owner;
    this.category = 'OFFENSE';
    this.page = 0;
    this.root = null;
    this.record = null;
  }

  factionColor() { return this.owner.factionKind?.() === 'nod' ? '#d71920' : '#168fbd'; }

  tabColor() { return this.owner.factionKind?.() === 'nod' ? '#b40c13' : '#0879a4'; }

  styleWindowChrome() {
    const win = this.record?.window;
    if (!win || win.isDisposed?.()) return;
    try {
      win.set({
        appearance: 'widget',
        decorator: null,
        padding: 0
      });
      const caption = win.getChildControl('captionbar');
      caption.exclude();
      const pane = win.getChildControl('pane');
      pane.set({ padding: 0, decorator: null });
    } catch { /* The active game skin may omit an optional child control. */ }
  }

  stylePageButton(button, enabled) {
    button.set({
      width: 26, minWidth: 26, maxWidth: 26,
      height: 52, minHeight: 52, maxHeight: 52,
      paddingTop: 0, paddingRight: 2, paddingBottom: 2, paddingLeft: 0,
      allowGrowX: false, allowGrowY: false,
      appearance: 'button-friendlist-scroll'
    });
  }

  build() {
    if (this.root && !this.root.isDisposed?.()) return this.root;
    const qx = globalThis.qx;
    this.root = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({
      padding: 0
    });
    const gridBackground = `url(${RESEARCH_ASSETS.research_grid})`;
    const applyGrid = (widget) => {
      widget.getContentElement().setStyles({ backgroundImage: gridBackground, backgroundRepeat: 'repeat' });
    };
    applyGrid(this.root);
    const titleBar = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      height: 33, minHeight: 33, maxHeight: 33
    });
    titleBar.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/230414d216581dcecaa6ff0eb8a8d213.png').set({
      width: 723, minWidth: 723, maxWidth: 723,
      height: 30, minHeight: 30, maxHeight: 30,
      scale: false
    }), { left: 3, top: 2 });
    const title = new qx.ui.basic.Label('RESEARCH').set({
      width: 700, height: 18, textAlign: 'center', textColor: '#353535', font: 'bold'
    });
    title.getContentElement().setStyles({
      fontFamily: 'Lucida Grande', fontSize: '13px', fontWeight: 'bold', lineHeight: '1.4'
    });
    titleBar.add(title, { left: 30, top: 8 });
    const close = new qx.ui.form.Button('', 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/6e8d2599d665526123be635e2c66614e.png').set({
      width: 23, height: 23,
      paddingTop: 0, paddingRight: 2, paddingBottom: 2, paddingLeft: 0,
      appearance: 'button-friendlist-scroll',
      toolTipText: 'Close'
    });
    close.addListener('pointerdown', (event) => event.stopPropagation?.());
    close.addListener('execute', () => this.record?.close?.());
    let drag = null;
    titleBar.addListener('pointerdown', (event) => {
      if (event.getTarget?.() === close) return;
      const win = this.record?.window;
      if (!win || win.isDisposed?.()) return;
      const layout = win.getLayoutProperties?.() ?? {};
      drag = {
        x: event.getDocumentLeft?.() ?? 0,
        y: event.getDocumentTop?.() ?? 0,
        left: Number(layout.left ?? win.getBounds?.()?.left ?? 0),
        top: Number(layout.top ?? win.getBounds?.()?.top ?? 0)
      };
      titleBar.capture?.();
      event.stopPropagation?.();
    });
    titleBar.addListener('pointermove', (event) => {
      if (!drag) return;
      const x = event.getDocumentLeft?.() ?? drag.x;
      const y = event.getDocumentTop?.() ?? drag.y;
      this.record?.window?.moveTo?.(drag.left + x - drag.x, drag.top + y - drag.y);
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      titleBar.releaseCapture?.();
    };
    titleBar.addListener('pointerup', endDrag);
    titleBar.addListener('losecapture', endDrag);
    this.root.add(titleBar);
    const resourceStrip = new qx.ui.container.Composite(new qx.ui.layout.HBox(0, 'center')).set({
      height: 27, minHeight: 27, maxHeight: 27
    });
    applyGrid(resourceStrip);
    this.header = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      width: 485, minWidth: 485, maxWidth: 485,
      height: 27, minHeight: 27, maxHeight: 27
    });
    this.header.getContentElement().setStyles({
      backgroundColor: '#d9dedf',
      clipPath: 'polygon(6% 0,94% 0,100% 18%,97% 42%,96% 72%,92% 100%,8% 100%,4% 72%,3% 42%,0 18%)'
    });
    this.header.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/52836c9b830c15564163419028b8f795.png').set({ width: 24, height: 24 }), { left: 36, top: 0 });
    this.researchValue = new qx.ui.basic.Label('').set({
      width: 50, height: 20, font: 'bold', textColor: '#3d3d3d'
    });
    this.researchValue.getContentElement().setStyles({ fontFamily: 'Lucida Grande', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.4' });
    this.header.add(this.researchValue, { left: 64, top: 2 });
    this.header.add(new qx.ui.basic.Label('Research points').set({ width: 93, height: 17, font: 'small', textColor: '#3d3d3d' }), { left: 118, top: 5 });
    this.header.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/a7d2f83e4fe41fc03990192217fd0330.png').set({ width: 28, height: 28 }), { left: 251, top: -2 });
    this.creditsValue = new qx.ui.basic.Label('').set({
      width: 50, height: 20, font: 'bold', textColor: '#3d3d3d'
    });
    this.creditsValue.getContentElement().setStyles({ fontFamily: 'Lucida Grande', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.4' });
    this.header.add(this.creditsValue, { left: 279, top: 2 });
    this.header.add(new qx.ui.basic.Label('Credits').set({ width: 43, height: 17, font: 'small', textColor: '#3d3d3d' }), { left: 333, top: 5 });
    resourceStrip.add(this.header);
    this.root.add(resourceStrip);
    const tabs = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      height: 35, minHeight: 35, maxHeight: 35
    });
    applyGrid(tabs);
    tabs.getContentElement().setStyle('overflow', 'visible');
    this.tabButtons = new Map();
    const tabGeometry = {
      OFFENSE: { left: 37, width: 88 },
      DEFENSE: { left: 121, width: 87 },
      SPECIAL: { left: 209, width: 83 }
    };
    for (const category of ['OFFENSE', 'DEFENSE', 'SPECIAL']) {
      const geometry = tabGeometry[category];
      const button = new qx.ui.form.Button(category).set({ font: 'bold' });
      button.addListener('execute', () => { this.category = category; this.page = 0; this.render(); });
      tabs.add(button, { left: geometry.left, top: 15 });
      this.tabButtons.set(category, { button, geometry });
    }
    this.root.add(tabs);
    const bodyShell = new qx.ui.container.Composite(new qx.ui.layout.HBox(0, 'center')).set({
      padding: 0
    });
    applyGrid(bodyShell);
    const body = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      width: 701, minWidth: 701, maxWidth: 701,
      height: 413, minHeight: 413, maxHeight: 413,
      backgroundColor: '#344149'
    });
    body.getContentElement().addClass('qx-tabview-pane');
    body.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/eacd3606702ab2855ca6cc74a6af69a8.png').set({ width: 53, height: 362 }), { left: 4, top: 43 });
    body.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/ee724c848ab73c6b4509b40d757f052c.png').set({ width: 189, height: 249 }), { left: 505, top: 4 });
    body.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/b88290cb16cd80bd548e8c1977f6399b.png').set({ width: 628, height: 376 }), { left: 34, top: 15 });
    this.previous = new qx.ui.form.Button('', 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/bc12f15831a441d3ff9952e8a4f55451.png');
    this.previous.addListener('execute', () => { this.page -= 1; this.render(); });
    body.add(this.previous, { left: 6, top: 180 });
    this.grid = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      width: 606, minWidth: 606, maxWidth: 606,
      height: 371, minHeight: 371, maxHeight: 371,
      padding: 0
    });
    body.add(this.grid, { left: 45, top: 20 });
    this.next = new qx.ui.form.Button('', 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/2f10f5bc75398b89e2e0b1a8363d17ed.png');
    this.next.addListener('execute', () => { this.page += 1; this.render(); });
    body.add(this.next, { left: 666, top: 180 });
    bodyShell.add(body);
    this.root.add(bodyShell, { flex: 1 });
    const content = this.root;
    const shell = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      width: 765, minWidth: 765, maxWidth: 765,
      height: 510, minHeight: 510, maxHeight: 510
    });
    const frameImage = (source, width, height, left, top) => {
      shell.add(new qx.ui.basic.Image(source).set({ width, height }), { left, top });
    };
    const paneOverlay = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      width: 759, height: 504
    });
    paneOverlay.getContentElement().addClass('qx-pane-menu-overlay');
    shell.add(paneOverlay, { left: 3, top: 3 });
    shell.add(content, { left: 0, top: 0, right: 0, bottom: 0 });
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/58b138df30f80d58e4eb2a061fc500f8.png', 401, 23, 320, 72);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/55dfb01a75373e496f6e3c16dd7f7b57.png', 20, 372, 6, 104);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/6fdb8613ac4fe8589cf6f97099b76581.png', 21, 360, 738, 114);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/0b3dfba257390c69098814f9fdc7800b.png', 34, 35, 731, 0);
    shell.add(close, { left: 737, top: 6 });
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/873bc74684a2ef57b2f30056b5952be1.png', 3, 446, 762, 35);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/bbc2a47391970c40b5162fc685b272f5.png', 5, 28, 760, 482);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/6050df3ec84ee110b4bfdb2d0f3e317f.png', 755, 3, 5, 507);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/b6c5a5266edd13942da54a30bf5d21d1.png', 5, 29, 0, 481);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/8592bcd9b49a201ee10f4af4c808645f.png', 3, 449, 0, 32);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/0c2003e82a170d471c75fbf00678fa9b.png', 3, 32, 0, 0);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/423ffdc3b1e1f5f4faca0923c5836044.png', 25, 5, 3, 0);
    frameImage('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/baf5187403f99fca121292aceae98453.png', 703, 3, 28, 0);
    this.root = shell;
    return shell;
  }

  card(item, locked = false) {
    const qx = globalThis.qx;
    const resources = this.owner.resources();
    const state = this.owner.researchState(item.key);
    const researched = state.researched;
    const creditsRemaining = Math.max(0, item.credits - resources.credits);
    const rpRemaining = Math.max(0, item.rp - resources.research);
    const isUpgrade = Boolean(item.prerequisite);
    const card = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
      width: isUpgrade ? 187 : 185,
      minWidth: isUpgrade ? 187 : 185,
      maxWidth: isUpgrade ? 187 : 185,
      height: isUpgrade ? 172 : 173,
      minHeight: isUpgrade ? 172 : 173,
      maxHeight: isUpgrade ? 172 : 173
    });
    const exactLabel = (value, properties, layout, styles = {}) => {
      const label = new qx.ui.basic.Label(value).set(properties);
      label.getContentElement().setStyles({
        fontFamily: 'Lucida Grande',
        lineHeight: '1.1',
        ...(properties.wrap ? { whiteSpace: 'normal', textOverflow: 'clip' } : {}),
        ...styles
      });
      card.add(label, layout);
      return label;
    };
    const parentBackground = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/b65818442dedf866f75b14a8bc385bb9.png';
    const upgradeBackground = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/ed9d74778294cfa4a9e91a790ae8b442.png';
    const upgradeHeader = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/afb54330e8a9cc98ccc3396481eca6e7.png';
    card.add(new qx.ui.basic.Image(isUpgrade ? upgradeBackground : parentBackground).set({
      width: isUpgrade ? 187 : 185, height: isUpgrade ? 172 : 173
    }), { left: 0, top: 0 });
    if (isUpgrade) {
      card.add(new qx.ui.basic.Image(upgradeHeader).set({ width: 187, height: 82 }), { left: 0, top: 0 });
    }
    const source = NATIVE_ART[item.key]
      ?? this.owner.researchImage?.(item.key, item.image)
      ?? item.image;
    if (source) {
      const image = new qx.ui.basic.Image(source).set({
        width: isUpgrade ? 173 : 185,
        height: isUpgrade ? 57 : 57,
        scale: true
      });
      if (locked) image.setOpacity?.(0.38);
      card.add(image, { left: isUpgrade ? 7 : 0, top: isUpgrade ? 25 : 21 });
    }
    exactLabel(item.name, {
      width: isUpgrade ? 130 : 170, height: 17,
      textAlign: isUpgrade ? 'left' : 'center', textColor: '#f3f3f5', font: 'bold'
    }, { left: isUpgrade ? 25 : 5, top: isUpgrade ? 7 : 5 }, { fontSize: '12px', fontWeight: 'bold', lineHeight: '1.4' });
    exactLabel(item.description, {
      width: 164, height: 40, wrap: true, textColor: '#292929'
    }, { left: 8, top: isUpgrade ? 85 : 80 }, { fontSize: '10px' });
    if (locked) {
      exactLabel(`Requires ${item.prerequisite}`, {
        width: 171, height: 38, wrap: true, font: 'bold', textColor: '#c00000', textAlign: 'center'
      }, { left: 8, top: 122 }, { fontSize: '12px', fontWeight: 'bold', lineHeight: '1.4' });
      return card;
    }
    if (researched) {
      card.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/a9b7365b1dd6829eb9a0639cc4d4824c.png').set({
        width: 34, height: 28
      }), { left: 143, top: 135 });
      return card;
    }
    const creditIcon = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/a7d2f83e4fe41fc03990192217fd0330.png';
    const researchIcon = 'https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/b868f25a38496e4e29d7a6f74352538c.png';
    const costs = new qx.ui.basic.Label(
      `<div style="height:21px;line-height:21px;margin-top:-4px;font-weight:bold;color:#AC0000"><img src="${creditIcon}" width="23" height="21" style="vertical-align:middle"><span style="vertical-align:middle">${compact(item.credits)}</span></div>`
      + `<div style="height:21px;line-height:21px;margin-top:-4px;font-weight:bold;color:#AC0000"><img src="${researchIcon}" width="23" height="21" style="vertical-align:middle"><span style="vertical-align:middle">${compact(item.rp)}</span></div>`
    ).set({ rich: true, width: 106, height: 38 });
    costs.getContentElement().setStyles({ fontFamily: 'Lucida Grande', fontSize: '12px', lineHeight: '1.4' });
    card.add(costs, { left: 4, top: 122 });
    const enabled = state.available && creditsRemaining <= 0 && rpRemaining <= 0;
    const research = new qx.ui.form.Button(isUpgrade ? 'Upgrade' : 'Research').set({
      enabled,
      appearance: 'widget', decorator: null,
      width: 80, height: 24, paddingBottom: 1
    });
    research.getContentElement().addClass(enabled
      ? 'qx-button-standard'
      : 'qx-button-standard-disabled');
    research.addListener('execute', () => { if (this.owner.performResearch(item.key)) setTimeout(() => this.render(), 250); });
    card.add(research, { left: 101, top: 136 });
    return card;
  }

  render() {
    if (!this.root || this.root.isDisposed?.()) return;
    const pages = this.owner.researchCatalog()[this.category] ?? [];
    if (!pages.length) return;
    this.page = Math.max(0, Math.min(this.page, pages.length - 1));
    const resources = this.owner.resources();
    this.researchValue.setValue(compact(resources.research));
    this.creditsValue.setValue(compact(resources.credits));
    const hasPrevious = this.page > 0;
    const hasNext = this.page < pages.length - 1;
    this.previous.setEnabled(hasPrevious);
    this.next.setEnabled(hasNext);
    this.stylePageButton(this.previous, hasPrevious);
    this.stylePageButton(this.next, hasNext);
    for (const [category, record] of this.tabButtons) {
      const { button, geometry } = record;
      const selected = category === this.category;
      button.setEnabled(true);
      button.set({
        appearance: 'widget',
        decorator: null,
        paddingTop: selected ? 3 : 2,
        paddingRight: 7,
        paddingBottom: selected ? 3 : 2,
        paddingLeft: selected ? 10 : 9,
        textColor: '#353535',
        width: geometry.width, minWidth: geometry.width, maxWidth: geometry.width,
        height: selected ? 26 : 21,
        minHeight: selected ? 26 : 21,
        maxHeight: selected ? 26 : 21
      });
      const element = button.getContentElement();
      element.removeClass('qx-tabview-page-button-top-active');
      element.removeClass('qx-tabview-page-button-top-inactive');
      element.addClass(selected
        ? 'qx-tabview-page-button-top-active'
        : 'qx-tabview-page-button-top-inactive');
      button.setLayoutProperties({ left: geometry.left, top: selected ? 10 : 15 });
    }
    for (const child of this.grid.removeAll()) child.destroy?.();
    pages[this.page].forEach((entry, column) => {
      const left = column * 202;
      this.grid.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/79ce2bd03732085b242b0796b9aa00c6.png').set({
        width: 202, height: 367
      }), { left, top: 0 });
      this.grid.add(this.card(entry), { left, top: 0 });
      const parentState = this.owner.researchState(entry.key);
      const parentResearched = parentState.researched;
      if (entry.upgrade) {
        this.grid.add(new qx.ui.basic.Image('https://eaassets-a.akamaihd.net/cncalliancesgame/cdn/data/4bdfd77f30f8a797ed44a820a6e3691d.png').set({
          width: 62, height: 20
        }), { left: left + 65, top: 172 });
        this.grid.add(this.card(entry.upgrade, !parentResearched), { left: left + 13, top: 192 });
      }
    });
  }

  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.render();
      this.record.window.open();
      this.record.window.setActive?.(true);
      this.styleWindowChrome();
      return this.record;
    }
    this.record = await this.context.windows.open({
      id: 'research-eta', title: 'RESEARCH', content: this.build(),
      x: 70, y: 35, width: 765, height: 510, resizable: false,
      singleton: true, showHelp: false, pinnable: false, lockable: false,
      sizeRevision: 'research-native-shell-v5'
    });
    this.styleWindowChrome();
    this.render();
    return this.record;
  }
}
import { RESEARCH_ASSETS } from './research-assets.generated.js';

function n(value) { return Math.round(Number(value) || 0).toLocaleString(); }
function time(seconds) {
  if (!seconds) return 'Ready';
  const h = Math.floor(seconds / 3600); const m = Math.ceil((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export class BaseIntelligenceSticker {
  constructor({ context, hub }) { this.context = context; this.hub = hub; this.record = null; }
  mode() { return this.context.moduleSettings.get('stickerMode', 'compact'); }
  render() {
    const city = this.hub.snapshot().current;
    if (!city || !this.label || this.label.isDisposed?.()) return false;
    const order = this.context.moduleSettings.get('resourceOrder', 'tiberium,crystal,power').split(',');
    const resources = order.map((key) => `${key[0].toUpperCase()} ${n(city.resources[key]?.current)}`).join(' · ');
    if (this.mode() === 'super-compact') this.label.setValue(`<b>${city.name}</b> · ${resources}`);
    else this.label.setValue(
      `<b>${city.name}</b> · Base ${city.baseLevel.toFixed(1)} · Off ${city.offenseLevel.toFixed(1)} · Def ${city.defenseLevel.toFixed(1)}<br>`
      + `${resources}<br>Repair: INF ${time(city.repair.infantry.timeSeconds)} · VEH ${time(city.repair.vehicle.timeSeconds)} · AIR ${time(city.repair.aircraft.timeSeconds)}`
    );
    return true;
  }
  build() {
    const qx = globalThis.qx;
    this.label = new qx.ui.basic.Label('').set({ rich: true, wrap: true, textColor: '#ffffff', padding: 8 });
    this.render();
    return this.label;
  }
  async open() {
    if (this.record?.window && !this.record.window.isDisposed?.() && this.label && !this.label.isDisposed?.()) {
      this.render(); this.record.window.open(); return this.record;
    }
    this.record = null;
    this.label = null;
    const compact = this.mode() === 'super-compact';
    this.record = await this.context.windows.open({ id: 'base-intelligence-sticker', title: 'Base Status', content: this.build(), x: 760, y: 80, width: compact ? 380 : 530, height: compact ? 105 : 155, resizable: true, singleton: true });
    this.record.window.setMovable?.(!this.context.moduleSettings.get('stickerLocked', false));
    this.record.window.setAlwaysOnTop?.(this.context.moduleSettings.get('stickerPinned', true));
    return this.record;
  }
  close() { this.context.windows.close?.('base-intelligence-sticker'); this.record = null; this.label = null; }
}

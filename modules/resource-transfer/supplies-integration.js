function children(widget) {
  try { return widget?.getChildren?.() ?? []; } catch { return []; }
}

function walk(root) {
  const result = [];
  const queue = root ? [root] : [];
  const seen = new Set();
  for (let index = 0; index < queue.length; index += 1) {
    const widget = queue[index];
    if (!widget || seen.has(widget)) continue;
    seen.add(widget);
    result.push(widget);
    queue.push(...children(widget));
  }
  return result;
}

export class SuppliesIntegration {
  constructor(context) {
    this.context = context;
    this.overlay = null;
    this.listenerIds = [];
    this.disabled = new Map();
  }

  getOverlay(create = false) {
    const Overlay = globalThis.webfrontend?.gui?.monetization?.ShopOverlay;
    if (!Overlay) return null;
    const existing = Overlay.$$instance ?? Overlay.__instance ?? null;
    if (existing && !existing.isDisposed?.()) return existing;
    if (!create || typeof Overlay.getInstance !== 'function') return null;
    try {
      return Overlay.getInstance() ?? null;
    } catch (error) {
      this.context.logger?.debug?.('Supplies overlay is not ready yet.', error);
      return null;
    }
  }

  install() {
    if (this.overlay && !this.overlay.isDisposed?.()) return true;
    const overlay = this.getOverlay(false);
    if (!overlay?.addListener) return false;
    this.overlay = overlay;
    this.listenerIds.push(overlay.addListener('appear', () => this.apply()));
    this.listenerIds.push(overlay.addListener('disappear', () => this.restoreFundsControls()));
    return true;
  }

  apply() {
    if (!this.install()) return false;
    if (this.context.moduleSettings.get('defaultSuppliesTab', true)) {
      try { this.overlay.set_SwitchTabByChildIndex?.(1); } catch { /* current game may expose another tab model */ }
    }
    this.restoreFundsControls();
    if (this.context.moduleSettings.get('disableFundsInSupplies', false)) {
      for (const widget of walk(this.overlay)) {
        const text = `${widget.getLabel?.() ?? ''} ${widget.getToolTipText?.() ?? ''}`.toLowerCase();
        if (!text.includes('fund')) continue;
        if (typeof widget.getEnabled !== 'function' || typeof widget.setEnabled !== 'function') continue;
        this.disabled.set(widget, widget.getEnabled());
        widget.setEnabled(false);
      }
    }
    return true;
  }

  restoreFundsControls() {
    for (const [widget, enabled] of this.disabled) {
      if (!widget?.isDisposed?.()) widget.setEnabled?.(enabled);
    }
    this.disabled.clear();
  }

  open() {
    if (!this.install()) {
      const overlay = this.getOverlay(true);
      if (!overlay?.addListener) {
        throw new Error('The Supplies interface is still loading. Try again after the game finishes opening.');
      }
      this.overlay = overlay;
      this.listenerIds.push(overlay.addListener('appear', () => this.apply()));
      this.listenerIds.push(overlay.addListener('disappear', () => this.restoreFundsControls()));
    }
    this.overlay.open?.();
    this.apply();
  }

  destroy() {
    this.restoreFundsControls();
    for (const id of this.listenerIds) {
      if (!this.overlay?.isDisposed?.()) this.overlay.removeListenerById?.(id);
    }
    this.listenerIds = [];
    this.overlay = null;
  }
}

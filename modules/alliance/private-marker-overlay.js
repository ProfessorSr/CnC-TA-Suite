export class PrivateMarkerOverlay {
  constructor({ context, hub }) { this.context = context; this.hub = hub; this.widgets = new Map(); }

  render() {
    const qx = globalThis.qx;
    const app = qx?.core?.Init?.getApplication?.();
    const desktop = app?.getDesktop?.() ?? app?.getRoot?.();
    const background = app?.getBackgroundArea?.();
    const visMain = this.hub.root()?.Vis?.VisMain?.GetInstance?.();
    const region = visMain?.get_Region?.();
    if (!qx || !desktop?.add || !visMain || !region) return;
    const gridWidth = Number(region.get_GridWidth?.() ?? 0);
    const gridHeight = Number(region.get_GridHeight?.() ?? gridWidth);
    const live = new Set();
    for (const marker of this.hub.displaySuiteMarkers()) {
      live.add(marker.id);
      let widget = this.widgets.get(marker.id);
      if (!widget || widget.isDisposed?.()) {
        widget = new qx.ui.basic.Label(`◆ ${marker.label}`).set({
          padding: 3, textColor: '#111820', backgroundColor: marker.color,
          font: 'bold', opacity: 0.9, anonymous: true, zIndex: 12,
          decorator: new qx.ui.decoration.Decorator(2, 'solid', '#ffffff'),
          toolTipText: `${marker.scope} marker · ${marker.x}:${marker.y}\n${marker.label}`
        });
        if (desktop.addAfter && background) desktop.addAfter(widget, background, { left: 0, top: 0 });
        else desktop.add(widget, { left: 0, top: 0 });
        this.widgets.set(marker.id, widget);
      }
      const left = Number(visMain.ScreenPosFromWorldPosX?.(marker.x * gridWidth));
      const top = Number(visMain.ScreenPosFromWorldPosY?.(marker.y * gridHeight));
      if (!Number.isFinite(left) || !Number.isFinite(top)) widget.exclude?.();
      else { widget.setLayoutProperties?.({ left: Math.round(left), top: Math.round(top) }); widget.show?.(); }
    }
    for (const [id, widget] of this.widgets) {
      if (live.has(id)) continue;
      widget.destroy?.(); this.widgets.delete(id);
    }
  }

  destroy() { for (const widget of this.widgets.values()) widget.destroy?.(); this.widgets.clear(); }
}

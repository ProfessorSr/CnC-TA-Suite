import { Module } from '../../core/interfaces/module.js';
import { BaseIntelligenceHub } from './base-intelligence-hub.js';
import { BaseIntelligenceHooks } from './base-intelligence-hooks.js';
import { BaseIntelligenceSticker } from './base-intelligence-sticker.js';
import { BaseIntelligenceWindow } from './base-intelligence-window.js';

const settings = Object.freeze({
  stickerMode: Object.freeze({ type: 'string', default: 'compact', enum: Object.freeze(['compact', 'super-compact']) }),
  stickerPinned: Object.freeze({ type: 'boolean', default: true }),
  stickerLocked: Object.freeze({ type: 'boolean', default: false }),
  resourceOrder: Object.freeze({ type: 'string', default: 'tiberium,crystal,power', enum: Object.freeze(['tiberium,crystal,power', 'power,tiberium,crystal', 'crystal,tiberium,power']) }),
  showRegionDetails: Object.freeze({ type: 'boolean', default: true }),
  showOnlineColors: Object.freeze({ type: 'boolean', default: true })
});

export const baseIntelligenceManifest = Object.freeze({
  id: 'base-intelligence', name: 'Base Intelligence', version: '1.0.0', apiVersion: '1.0.0', author: 'ProfessorSr',
  description: 'Owned-base overview, statistics, resources, repairs, composition, stickers, and region intelligence.',
  dependencies: Object.freeze([]), permissions: Object.freeze(['events', 'game', 'hooks', 'settings', 'windows']), settings
});

export class BaseIntelligenceModule extends Module {
  constructor() { super(baseIntelligenceManifest); this.window = null; }
  async enable(context) {
    this.context = context;
    this.hub = new BaseIntelligenceHub(context);
    this.sticker = new BaseIntelligenceSticker({ context, hub: this.hub });
    this.window = new BaseIntelligenceWindow({ context, hub: this.hub, sticker: this.sticker });
    this.hooks = new BaseIntelligenceHooks({ context, hub: this.hub });
    this.hooks.install();
    context.events.on('game:tick', () => {
      this.hooks?.install?.();
      if (this.window?.record?.window?.isVisible?.()) this.window.render();
      if (
        this.sticker?.record?.window?.isVisible?.()
        && this.sticker?.label
        && !this.sticker.label.isDisposed?.()
      ) this.sticker.render();
    });
  }
  async open(context) { if (!this.window) await this.enable(context); return this.window.open(); }
  async disable(context) {
    context?.windows?.close?.('base-intelligence'); context?.windows?.close?.('base-intelligence-sticker');
    this.hooks?.destroy?.(); this.sticker?.close?.(); this.window = null; this.sticker = null; this.hooks = null; this.hub = null; this.context = null;
  }
  async destroy(context) { await this.disable(context); }
}

export default BaseIntelligenceModule;

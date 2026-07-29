import { Module } from '../../interfaces/module.js';
import { normalizeModuleDefinition } from './moduleDefinition.js';
import { DeclarativeRenderer } from './declarativeRenderer.js';

export class DeclarativeModule extends Module {
  constructor(definition) {
    const normalized = normalizeModuleDefinition(definition);
    super(normalized.manifest);
    this.definition = normalized;
  }

  async enable(context) { this.context = context; }

  async open(context = this.context) {
    if (!this.context) await this.enable(context);
    if (this.record?.window && !this.record.window.isDisposed?.()) {
      this.record.window.open(); this.record.window.setActive?.(true);
      await this.renderer?.refresh?.(true);
      return this.record;
    }
    this.renderer = new DeclarativeRenderer({ definition: this.definition, context: this.context, owner: this });
    const window = this.definition.window;
    this.record = await this.context.windows.open({
      id: this.id, title: window.title, content: this.renderer.build(),
      x: window.x, y: window.y, width: window.width, height: window.height,
      resizable: window.resizable, singleton: window.singleton
    });
    return this.record;
  }

  async disable(context = this.context) {
    context?.windows?.close?.(this.id);
    this.record = null; this.renderer = null; this.context = null;
  }
}

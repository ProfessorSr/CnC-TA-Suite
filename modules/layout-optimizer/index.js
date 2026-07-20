import { Module } from '../../core/interfaces/module.js';
import { LayoutOptimizer } from './layout-optimizer.js';
import { LayoutOptimizerHub } from './layout-optimizer-hub.js';
import { LayoutOptimizerWindow } from './layout-optimizer-window.js';

const settings = Object.freeze({});

export const layoutOptimizerManifest = Object.freeze({
  id: 'layout-optimizer',
  name: 'Base Layout Optimizer',
  version: '1.0.0',
  apiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Design, compare, rank, and optionally apply optimized base layouts.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['game', 'notifications', 'settings', 'windows']),
  settings
});

export class LayoutOptimizerModule extends Module {
  constructor() {
    super(layoutOptimizerManifest);
    this.window = null;
  }

  async enable(context) {
    const hub = new LayoutOptimizerHub(context);
    this.window = new LayoutOptimizerWindow({
      context,
      hub,
      optimize: (snapshot, options) => LayoutOptimizer.optimize(snapshot, options)
    });
  }

  async open(context) {
    if (!this.window) await this.enable(context);
    return this.window.open();
  }

  async disable(context) {
    context?.windows?.close?.('layout-optimizer');
    this.window = null;
  }

  async destroy(context) { await this.disable(context); }
}

export default LayoutOptimizerModule;

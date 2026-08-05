import { Module } from '../../core/interfaces/module.js';
import { ContextActionsPanel } from './context-actions-panel.js';
import { ContextActionsWindow } from './context-actions-window.js';
import { StrategicMapPlanner } from './strategic-map-planner.js';

const actionSettings = Object.freeze({
  showBaseInformation: Object.freeze({ type: 'boolean', default: true }),
  showWarRoom: Object.freeze({ type: 'boolean', default: true }),
  showTargetInfo: Object.freeze({ type: 'boolean', default: false }),
  showScanNearby: Object.freeze({ type: 'boolean', default: true }),
  showViewLayout: Object.freeze({ type: 'boolean', default: true }),
  showCopyCoordinates: Object.freeze({ type: 'boolean', default: true }),
  showRepairManager: Object.freeze({ type: 'boolean', default: true }),
  showUpgradeManager: Object.freeze({ type: 'boolean', default: true }),
  showLayoutOptimizer: Object.freeze({ type: 'boolean', default: true }),
  showResourceTransfer: Object.freeze({ type: 'boolean', default: true }),
  showPlanMove: Object.freeze({ type: 'boolean', default: true }),
  showPlanRuin: Object.freeze({ type: 'boolean', default: true }),
  showPlanRuinFor: Object.freeze({ type: 'boolean', default: true }),
  showPlanLevel: Object.freeze({ type: 'boolean', default: true }),
  showPlanRemove: Object.freeze({ type: 'boolean', default: true })
});

export const contextActionsManifest = Object.freeze({
  id: 'context-actions',
  name: 'Context Actions',
  version: '0.3.0',
  apiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Adds configurable Suite actions to native map-object menus.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['events', 'game', 'hooks', 'modules', 'notifications', 'settings', 'storage', 'windows']),
  settings: actionSettings
});

export class ContextActionsModule extends Module {
  constructor() {
    super(contextActionsManifest);
    this.context = null;
    this.panel = null;
    this.window = null;
    this.hookInstalled = false;
    this.hookId = 'context-actions:region-city-menu';
  }

  clientRoot() {
    return this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib;
  }

  installHook() {
    if (this.hookInstalled) return true;
    const prototype = globalThis.webfrontend?.gui?.region?.RegionCityMenu?.prototype;
    const original = prototype?.showMenu;
    if (typeof original !== 'function') return false;
    const module = this;
    function showMenuWithSuiteActions(selected, ...args) {
      const result = original.call(this, selected, ...args);
      try {
        module.panel?.attach?.(this, selected, module.clientRoot());
      } catch (error) {
        module.context?.logger?.warn?.('Unable to attach contextual Suite actions.', error);
      }
      return result;
    }
    prototype.showMenu = showMenuWithSuiteActions;
    this.context.hooks.register(this.hookId, () => {
      if (prototype.showMenu === showMenuWithSuiteActions) prototype.showMenu = original;
    }, { replace: true });
    this.hookInstalled = true;
    return true;
  }

  async enable(context) {
    this.context = context;
    this.window = new ContextActionsWindow({ context });
    this.strategicPlanner = new StrategicMapPlanner(context);
    this.panel = new ContextActionsPanel({
      context,
      openOptions: () => this.window.open(),
      strategicPlanner: this.strategicPlanner
    });
    this.installHook();
    context.events.on('game:tick', () => this.installHook());
  }

  async open(context) {
    if (!this.window) await this.enable(context);
    return this.window.open();
  }

  async disable(context) {
    context?.windows?.close?.('context-actions');
    await this.strategicPlanner?.destroy?.();
    context?.hooks?.uninstall?.(this.hookId);
    this.panel?.destroy?.();
    this.hookInstalled = false;
    this.panel = null;
    this.window = null;
    this.strategicPlanner = null;
    this.context = null;
  }

  async destroy(context) { await this.disable(context); }
}

export default ContextActionsModule;

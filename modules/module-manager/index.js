import { Module } from '../../core/interfaces/module.js';
import { buildModuleManagerWindow } from './moduleManagerWindow.js';

function getViewportWidth() {
  const qx = globalThis.qx;

  if (
    qx?.bom?.Viewport &&
    typeof qx.bom.Viewport.getWidth === 'function'
  ) {
    return qx.bom.Viewport.getWidth();
  }

  return 1024;
}

export class ModuleManagerModule extends Module {
  constructor() {
    super({
      id: 'module-manager',
      name: 'Module Manager',
      version: '0.1.0',
      apiVersion: '1.0.0',
      author: 'ProfessorSr',
      description:
        'Lists installed modules and allows them to be enabled or disabled at runtime.',
      permissions: [
        'modules',
        'settings',
        'windows',
        'notifications'
      ],
      settingsKey: 'moduleManager'
    });

    this.context = null;
  }

  async enable(context) {
    this.context = context;
  }

  async disable() {
    this.context?.windows?.close('module-manager');
    this.context = null;
  }

  async unload() {
    this.context?.windows?.close('module-manager');
    this.context = null;
  }

  async open(context = this.context) {
    if (!context) {
      return null;
    }

    const viewportWidth = getViewportWidth();
    const x = Math.max(24, viewportWidth - 470);

    return context.windows.open({
      id: 'module-manager',
      title: 'Module Manager',
      content: buildModuleManagerWindow(context),
      x,
      y: 116,
      width: 430,
      height: 520,
      resizable: true,
      singleton: true
    });
  }
}

export default ModuleManagerModule;

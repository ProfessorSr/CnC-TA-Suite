import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowManager } from '../../core/windows/windowManager.js';
import { buildLauncherWindow } from '../../modules/launcher/launcherWindow.js';
import { LauncherModule } from '../../modules/launcher/launcher.js';
import { buildSuiteStatusWindow } from '../../modules/suite-status/suiteStatusWindow.js';

class Widget {
  constructor() { this.children = []; }
  set() { return this; }
  setUserData() {}
  setToolTipText() {}
  addListener() {}
  add(child) { this.children.push(child); }
}

class Composite extends Widget {}
class Label extends Widget {}
class Button extends Widget {}
class VBox {}
class HBox {}

function installQxMock() {
  globalThis.qx = {
    core: { Init: {}, },
    ui: {
      core: { Widget },
      container: { Composite },
      basic: { Label },
      form: { Button },
      layout: { VBox, HBox }
    }
  };
}

test('launcher and suite status builders return Qooxdoo widgets', () => {
  installQxMock();
  const manager = new WindowManager({
    eventBus: {},
    storage: {},
    settings: {},
    logger: {}
  });
  const context = {
    modules: { open() {} },
    notifications: { show() {} },
    diagnostics: {
      snapshot: () => ({
        game: { ready: true, compatibility: { compatible: true }, services: {}, objects: {} },
        monitor: { running: true },
        cache: null,
        eventBus: null,
        hooks: [],
        observers: []
      }),
      health: () => ({ healthy: true })
    }
  };

  assert.equal(manager.isWidget(buildLauncherWindow(context)), true);
  assert.equal(manager.isWidget(buildSuiteStatusWindow(context)), true);

  delete globalThis.qx;
});

test('launcher does not open automatically when its module starts', async () => {
  let opened = false;
  const launcher = new LauncherModule();

  await launcher.start({
    windows: {
      async open() { opened = true; }
    }
  });

  assert.equal(opened, false);
});

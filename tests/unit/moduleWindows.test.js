import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowManager } from '../../core/windows/windowManager.js';
import { buildLauncherWindow } from '../../modules/launcher/launcherWindow.js';
import { LauncherModule } from '../../modules/launcher/launcher.js';
import { buildSuiteStatusWindow } from '../../modules/suite-status/suiteStatusWindow.js';
import { buildNextMCVWindow } from '../../modules/next-mcv/nextMCVWindow.js';

class Widget {
  constructor() { this.children = []; }
  set() { return this; }
  setValue(value) { this.value = value; }
  setUserData() {}
  setToolTipText() {}
  addListener() {}
  addListenerOnce(_name, listener) { this.onceListener = listener; }
  setLayoutProperties() {}
  add(child) { this.children.push(child); }
  removeAll() { const children = this.children; this.children = []; return children; }
  destroy() { this.disposed = true; }
  isDisposed() { return Boolean(this.disposed); }
  setRich(value) { this.rich = value; }
}

class Composite extends Widget {}
class Label extends Widget {}
class Atom extends Widget { setLabel(value) { this.value = value; } }
class Button extends Widget {}
class Scroll extends Widget {}
class GroupBox extends Widget {}
class Page extends Widget {}
class TabView extends Widget {}
class VBox {}
class HBox {}

function installQxMock() {
  globalThis.qx = {
    core: { Init: {}, },
    ui: {
      core: { Widget },
      container: { Composite, Scroll },
      basic: { Label, Atom },
      form: { Button },
      groupbox: { GroupBox },
      tabview: { Page, TabView },
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

test('Next MCV window uses Qooxdoo widgets available in the game runtime', () => {
  installQxMock();
  const context = {
    hub: {
      player: {
        credits: { current: 50, growthPerHour: 10 },
        research: { current: 25 },
        nextMCV: { creditsRequired: 100, researchRequired: 100 }
      }
    },
    logger: { warn() {} }
  };

  const content = buildNextMCVWindow(context);
  assert.equal(content instanceof Widget, true);
  content.onceListener();

  const embedded = buildNextMCVWindow(context, { embedded: true });
  assert.equal(embedded instanceof Widget, true);
  assert.equal(embedded.children[0].value, undefined);
  embedded.onceListener();
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

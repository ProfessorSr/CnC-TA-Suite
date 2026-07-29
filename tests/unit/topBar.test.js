import test from 'node:test';
import assert from 'node:assert/strict';
import { TopBarService } from '../../core/ui/topBar.js';

class Widget {
  constructor(label = '') {
    this.label = label;
    this.children = [];
    this.parent = null;
    this.disposed = false;
  }
  getLabel() { return this.label; }
  getChildren() { return this.children; }
  getLayoutParent() { return this.parent; }
  add(child) { child.parent = this; this.children.push(child); }
  set() { return this; }
  setAppearance() {}
  setUserData() {}
  addListener() {}
  isDisposed() { return this.disposed; }
  destroy() { this.disposed = true; }
}

class Button extends Widget {}

class Timer {
  constructor() { Timer.latest = this; }
  addListener(_name, listener) { this.listener = listener; }
  start() { this.running = true; }
  stop() { this.running = false; }
  dispose() {}
  tick() { this.listener(); }
}

test('registered top-bar links retry until the game navigation exists', (t) => {
  const desktop = new Widget();
  globalThis.qx = {
    core: { Init: { getApplication: () => ({ getDesktop: () => desktop }) } },
    event: { Timer },
    ui: { core: { Widget }, form: { Button } }
  };
  t.after(() => { delete globalThis.qx; });

  const service = new TopBarService({ retryInterval: 1, retryLimit: 3 });
  service.registerLink({ id: 'status', label: 'Status' });

  assert.equal(service.host, null);
  assert.equal(Timer.latest.running, true);

  const navigation = new Widget();
  navigation.add(new Widget('Reports'));
  navigation.add(new Widget('Messages'));
  navigation.add(new Widget('Alliance'));
  desktop.add(navigation);
  Timer.latest.tick();

  assert.equal(service.host, navigation);
  assert.equal(navigation.children.at(-1).getLabel(), 'Status');
  assert.equal(service.timer, null);
});

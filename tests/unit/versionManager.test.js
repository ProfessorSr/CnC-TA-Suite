import test from 'node:test';
import assert from 'node:assert/strict';
import { VersionManager } from '../../core/game/compatibility/versionManager.js';

function createLogger() {
  return {
    info() {},
    debug() {}
  };
}

test('VersionManager reports an explicit server version when available', () => {
  const server = { get_Version: () => '25.3.1' };
  const clientLibManager = {
    root: { Data: {} },
    getServer: () => server,
    getMainData: () => null,
    call(target, names) {
      for (const name of names) {
        if (typeof target?.[name] === 'function') return target[name]();
      }
      return undefined;
    }
  };

  const result = new VersionManager({
    clientLibManager,
    logger: createLogger()
  }).detect();

  assert.equal(result.known, true);
  assert.equal(result.normalized, '25.3.1');
  assert.equal(result.display, '25.3.1');
  assert.equal(result.source, 'explicit');
});

test('VersionManager creates a stable runtime fingerprint when version is hidden', () => {
  const server = {};
  const clientLibManager = {
    root: { Data: {}, Vis: {} },
    getServer: () => server,
    getMainData: () => null,
    call: () => undefined
  };

  const manager = new VersionManager({
    clientLibManager,
    logger: createLogger()
  });

  const first = manager.detect();
  const second = manager.detect();

  assert.equal(first.known, false);
  assert.equal(first.normalized, 'unknown');
  assert.match(first.runtimeFingerprint, /^runtime-[0-9a-f]{8}$/);
  assert.equal(first.runtimeFingerprint, second.runtimeFingerprint);
  assert.equal(first.source, 'runtime-fingerprint');
  assert.match(first.display, /^Unknown \(runtime-[0-9a-f]{8}\)$/);
});

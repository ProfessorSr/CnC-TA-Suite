import test from 'node:test';
import assert from 'node:assert/strict';
import { getQxApplication, waitForGameUi } from '../../core/bootstrap/gameUiReady.js';

test('waitForGameUi waits until the Qooxdoo application is available', async () => {
  const host = {};
  const application = {};

  setTimeout(() => {
    host.qx = {
      core: {
        Init: {
          getApplication: () => application
        }
      }
    };
  }, 5);

  assert.equal(getQxApplication(host), null);
  assert.equal(
    await waitForGameUi({ host, timeout: 100, interval: 1 }),
    application
  );
});

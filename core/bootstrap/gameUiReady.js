import { waitFor } from '../utils/timers.js';

export function getQxApplication(host = globalThis) {
  return host.qx?.core?.Init?.getApplication?.() ?? null;
}

export async function waitForGameUi({
  host = globalThis,
  timeout = 60000,
  interval = 250
} = {}) {
  return waitFor(
    () => getQxApplication(host),
    {
      timeout,
      interval,
      description: 'Qooxdoo game UI'
    }
  );
}

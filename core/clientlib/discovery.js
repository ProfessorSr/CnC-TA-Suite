import { waitFor } from '../utils/timers.js';

export async function discoverClientLib() {
  return waitFor(
    () => window.ClientLib,
    { timeout: 60000, interval: 300, description: 'ClientLib' }
  );
}

export async function discoverQxApplication() {
  return waitFor(
    () => window.qx?.core?.Init?.getApplication?.(),
    { timeout: 60000, interval: 300, description: 'qx application' }
  );
}

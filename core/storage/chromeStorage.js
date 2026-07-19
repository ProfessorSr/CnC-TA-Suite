const CHANNEL = 'cnc-ta-suite-storage';

export class ChromeStorageAdapter {
  constructor({ timeout = 5000 } = {}) {
    this.timeout = timeout;
  }

  request(operation, key, value) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error(`Chrome storage request timed out: ${operation}`));
      }, this.timeout);

      function onMessage(event) {
        const data = event.data;
        if (event.source !== window ||
            !data ||
            data.channel !== CHANNEL ||
            data.direction !== 'from-extension' ||
            data.requestId !== requestId) return;

        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        data.ok ? resolve(data.result) : reject(new Error(data.error || 'Storage request failed.'));
      }

      window.addEventListener('message', onMessage);
      window.postMessage({
        channel: CHANNEL,
        direction: 'to-extension',
        requestId,
        operation,
        key,
        value
      }, '*');
    });
  }

  get(key) { return this.request('get', key); }
  set(key, value) { return this.request('set', key, value); }
  remove(key) { return this.request('remove', key); }
  clear() { return this.request('clear'); }
}

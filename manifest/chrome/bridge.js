(() => {
  'use strict';

  const CHANNEL = 'cnc-ta-suite-storage';
  const injectedAttribute = 'data-cnc-ta-suite-injected';

  function respond(requestId, ok, result, error) {
    window.postMessage({
      channel: CHANNEL,
      direction: 'from-extension',
      requestId,
      ok,
      result,
      error
    }, '*');
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.direction !== 'to-extension') return;

    const { requestId, operation, key, value } = data;

    try {
      let result = null;
      switch (operation) {
        case 'get':
          result = await chrome.storage.local.get(key);
          result = result[key];
          break;
        case 'set':
          await chrome.storage.local.set({ [key]: value });
          result = true;
          break;
        case 'remove':
          await chrome.storage.local.remove(key);
          result = true;
          break;
        case 'clear':
          await chrome.storage.local.clear();
          result = true;
          break;
        default:
          throw new Error(`Unsupported storage operation: ${operation}`);
      }
      respond(requestId, true, result, null);
    } catch (error) {
      respond(requestId, false, null, error instanceof Error ? error.message : String(error));
    }
  });

  function inject() {
    if (document.documentElement.hasAttribute(injectedAttribute)) return;
    document.documentElement.setAttribute(injectedAttribute, 'true');

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = chrome.runtime.getURL('manifest/chrome/suite.css');
    (document.head || document.documentElement).appendChild(css);

    const script = document.createElement('script');
    script.type = 'module';
    script.src = chrome.runtime.getURL('manifest/chrome/suite.js');
    script.dataset.extensionId = chrome.runtime.id;
    script.addEventListener('load', () => script.remove());
    (document.head || document.documentElement).appendChild(script);
  }

  if (document.documentElement) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
})();

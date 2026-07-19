export function observeElement(
  selector,
  callback,
  root = document.documentElement,
  { once = false } = {}
) {
  let lastElement = null;

  const inspect = () => {
    const element = root.querySelector?.(selector)
      ?? document.querySelector(selector);

    if (!element || element === lastElement) return;
    lastElement = element;
    callback(element);
    if (once) observer.disconnect();
  };

  const observer = new MutationObserver(inspect);
  inspect();
  observer.observe(root, { childList: true, subtree: true });

  return () => observer.disconnect();
}

export class ObserverRegistry {
  constructor(logger) {
    this.logger = logger;
    this.observers = new Map();
  }

  register(id, dispose, options = {}) {
    if (typeof dispose !== 'function') {
      throw new TypeError(`Observer disposer must be a function: ${id}`);
    }

    if (this.observers.has(id)) {
      if (!options.replace) throw new Error(`Observer already registered: ${id}`);
      this.remove(id);
    }

    this.observers.set(id, dispose);
    return () => this.remove(id);
  }

  remove(id) {
    const dispose = this.observers.get(id);
    if (!dispose) return false;

    try {
      dispose();
    } catch (error) {
      this.logger.warn(`Observer removal failed: ${id}`, error);
    } finally {
      this.observers.delete(id);
    }

    return true;
  }

  clear() {
    for (const id of [...this.observers.keys()]) this.remove(id);
  }

  snapshot() {
    return Object.freeze([...this.observers.keys()]);
  }
}

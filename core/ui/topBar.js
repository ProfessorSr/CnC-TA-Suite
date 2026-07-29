const DEFAULT_RETRY_INTERVAL = 500;
const DEFAULT_RETRY_LIMIT = 120;

function getQx() {
  const qx = globalThis.qx;

  if (!qx?.ui?.core?.Widget) {
    throw new Error(
      '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
    );
  }

  return qx;
}

function widgetLabel(widget) {
  if (!widget || typeof widget.getLabel !== 'function') return '';
  return String(widget.getLabel() ?? '').replace(/^\(\d+\)\s*/, '').trim();
}

function childWidgets(widget) {
  if (!widget || typeof widget.getChildren !== 'function') return [];

  try {
    return widget.getChildren() ?? [];
  } catch {
    return [];
  }
}

function walkWidgets(root) {
  const result = [];
  const queue = root ? [root] : [];
  const visited = new Set();

  for (let i = 0; i < queue.length; i++) {
    const widget = queue[i];
    if (!widget || visited.has(widget)) continue;

    visited.add(widget);
    result.push(widget);
    queue.push(...childWidgets(widget));
  }

  return result;
}

function scoreNavigationHost(widget) {
  const children = childWidgets(widget);
  if (children.length < 3) return 0;

  const labels = new Set(children.map(widgetLabel).filter(Boolean));
  const expected = [
    'Reports',
    'Messages',
    'Alliance',
    'Forum',
    'Research',
    'Supplies',
    'Ranking'
  ];

  return expected.reduce(
    (score, label) => score + (labels.has(label) ? 1 : 0),
    0
  );
}

export class TopBarService {
  constructor({ logger, retryInterval = DEFAULT_RETRY_INTERVAL, retryLimit = DEFAULT_RETRY_LIMIT } = {}) {
    this.logger = logger;
    this.retryInterval = retryInterval;
    this.retryLimit = retryLimit;
    this.links = new Map();
    this.host = null;
    this.timer = null;
    this.attempts = 0;
  }

  getApplicationRoot() {
    const qx = getQx();
    const application = qx.core.Init.getApplication();

    return application?.getDesktop?.() ?? application?.getRoot?.() ?? null;
  }

  findNavigationHost() {
    const root = this.getApplicationRoot();
    if (!root) return null;

    let best = null;
    let bestScore = 0;

    for (const widget of walkWidgets(root)) {
      const score = scoreNavigationHost(widget);
      if (score > bestScore) {
        best = widget;
        bestScore = score;
      }
    }

    return bestScore >= 3 ? best : null;
  }

  createButton(definition) {
    const qx = getQx();
    const button = new qx.ui.form.Button(definition.label);
    
    button.set({
      focusable: true,
      keepActive: true,
      toolTipText: definition.title || definition.label
    });
    button.setAppearance('button');

    button.setUserData('cncSuiteTopBarId', definition.id);

    button.addListener('execute', async () => {
      try {
        await definition.onExecute?.();
      } catch (error) {
        this.logger?.error?.(
          `Top-bar action failed: ${definition.id}`,
          error
        );
      }
    });

    return button;
  }

  registerLink({ id, label, onExecute, order = 100, title } = {}) {
    if (!id) throw new TypeError('Top-bar link id is required.');
    if (!label) throw new TypeError(`Top-bar link label is required: ${id}`);

    this.removeLink(id);

    const definition = {
      id,
      label,
      onExecute,
      order,
      title,
      widget: null
    };

    this.links.set(id, definition);
    this.start();

    return () => this.removeLink(id);
  }

  createLink(label, moduleId, context) {
    return this.registerLink({
      id: moduleId,
      label,
      onExecute: () => context.modules.open(moduleId)
    });
  }

  removeLink(id) {
    const definition = this.links.get(id);
    if (!definition) return false;

    const widget = definition.widget;
    if (widget && !widget.isDisposed?.()) {
      widget.destroy();
      definition.widget = null;
    }

    this.links.delete(id);
    return true;
  }

  attach() {
  if (this.host?.isDisposed?.()) {
    this.host = null;
  }

  const host = this.host ?? this.findNavigationHost();

  if (!host || typeof host.add !== 'function') {
    return false;
  }

  this.host = host;

    const definitions = [...this.links.values()].sort(
      (left, right) => left.order - right.order
    );

    for (const definition of definitions) {
      const parent = definition.widget?.getLayoutParent?.();

    if (definition.widget && !definition.widget.isDisposed?.()) {
      if (parent === host) {
          continue;
      }

      definition.widget.destroy();
      definition.widget = null;
}
      definition.widget = this.createButton(definition);
      host.add(definition.widget);
    }

    return true;
  }

  start() {
    if (this.attach()) return true;
    if (this.timer) return false;

    const qx = getQx();
    this.attempts = 0;
    this.timer = new qx.event.Timer(this.retryInterval);

    this.timer.addListener('interval', () => {
      this.attempts += 1;

      if (this.attach() || this.attempts >= this.retryLimit) {
        if (this.attempts >= this.retryLimit && !this.host) {
          this.logger?.warn?.(
            'Unable to locate the game navigation bar for suite links.'
          );
        }

        this.stopTimer();
      }
    });

    this.timer.start();
    return false;
  }

  stopTimer() {
    if (!this.timer) return;

    this.timer.stop();
    this.timer.dispose();
    this.timer = null;
  }

  stop() {
    this.stopTimer();

    for (const definition of this.links.values()) {
      const widget = definition.widget;
      if (widget && !widget.isDisposed?.()) {
        widget.destroy();
      }
      definition.widget = null;
    }

    this.host = null;
  }
}

export default TopBarService;

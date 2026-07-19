import { Events } from '../events/eventTypes.js';

export class WindowManager {
  constructor({ eventBus, storage, settings, logger }) {
    this.eventBus = eventBus;
    this.storage = storage;
    this.settings = settings;
    this.logger = logger;
    this.windows = new Map();
  }

  getQx() {
    const qx = globalThis.qx;

    if (!qx?.core?.Init) {
      throw new Error(
        '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
      );
    }

    return qx;
  }

  getWindowParent() {
    const qx = this.getQx();
    const application = qx.core.Init.getApplication();

    if (!application) {
      throw new Error(
        '[CnC-TA-Suite] Unable to access the Qooxdoo application.'
      );
    }

    if (typeof application.getDesktop === 'function') {
      const desktop = application.getDesktop();

      if (desktop) {
        return desktop;
      }
    }

    if (typeof application.getRoot === 'function') {
      const root = application.getRoot();

      if (root) {
        return root;
      }
    }

    throw new Error(
      '[CnC-TA-Suite] Unable to find the game desktop or root widget.'
    );
  }

  isWidget(content) {
    const qx = this.getQx();

    return (
      content instanceof qx.ui.core.Widget ||
      (
        content &&
        typeof content.getContentElement === 'function' &&
        typeof content.addListener === 'function'
      )
    );
  }

  createContentWidget(content) {
    const qx = this.getQx();

    if (this.isWidget(content)) {
      return content;
    }

    if (typeof content === 'string') {
      const label = new qx.ui.basic.Label(content);

      label.set({
        rich: true,
        wrap: true
      });

      return label;
    }

    if (content == null) {
      return new qx.ui.container.Composite(
        new qx.ui.layout.Grow()
      );
    }

    throw new TypeError(
      '[CnC-TA-Suite] Window content must be a string or Qooxdoo widget.'
    );
  }

  async open({
    id,
    title,
    content,
    x = 24,
    y = 64,
    width = 360,
    height = 400,
    resizable = true,
    singleton = true
  }) {
    if (!id) {
      throw new Error('[CnC-TA-Suite] Window id is required.');
    }

    if (singleton && this.windows.has(id)) {
      const existing = this.windows.get(id);

      if (
        existing.window &&
        !existing.window.isDisposed?.()
      ) {
        existing.window.open();
        existing.window.setActive(true);
        existing.window.focus();

        return existing;
      }

      this.windows.delete(id);
    }

    const qx = this.getQx();
    const parent = this.getWindowParent();

    const rememberPositions = this.settings.get(
      'windows.rememberPositions',
      true
    );

    const saved = rememberPositions
      ? await this.storage.get(`window:${id}`, null)
      : null;

    const win = new qx.ui.window.Window(title || id);

    win.setLayout(new qx.ui.layout.Grow());

    win.set({
      width: saved?.width ?? width,
      height: saved?.height ?? height,
      showMinimize: false,
      showMaximize: false,
      allowMinimize: false,
      allowMaximize: false,
      allowClose: true,
      modal: false,
      textColor: '#ffffff',
      resizableTop: resizable,
      resizableRight: resizable,
      resizableBottom: resizable,
      resizableLeft: resizable
    });

    if (typeof win.setResizable === 'function') {
      win.setResizable(
        resizable,
        resizable,
        resizable,
        resizable
      );
    }

    const body = this.createContentWidget(content);
    body.set?.({ textColor: '#ffffff' });
    win.add(body);

    parent.add(win);

    const position = {
      x: saved?.x ?? x,
      y: saved?.y ?? y
    };

    win.moveTo(position.x, position.y);

    let persistenceTimer = null;

    const record = {
      id,
      window: win,
      element: win,
      body,
      persistenceTimer: null,
      close: () => this.close(id),
      listenerIds: {}
    };

    this.windows.set(id, record);

    const persist = () => {
      if (!rememberPositions || win.isDisposed?.()) {
        return;
      }

      clearTimeout(persistenceTimer);

      persistenceTimer = setTimeout(() => {
        const bounds = win.getBounds();
        const layout = win.getLayoutProperties();

        if (!bounds) {
          return;
        }

        this.storage.set(`window:${id}`, {
          x: Math.round(layout.left ?? bounds.left ?? position.x),
          y: Math.round(layout.top ?? bounds.top ?? position.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height)
        }).catch((error) => {
          this.logger?.warn?.(
            `Failed to save position for window "${id}".`,
            error
          );
        });
      }, 100);

      record.persistenceTimer = persistenceTimer;
    };

    record.listenerIds.move = win.addListener('move', persist);
    record.listenerIds.resize = win.addListener('resize', persist);
    record.listenerIds.close = win.addListener('close', () => {
      this.destroyRecord(id, record);
    });

    win.open();
    win.setActive(true);
    win.focus();

    this.eventBus.emit(Events.WINDOW_OPENED, { id });

    return record;
  }

  destroyRecord(id, record) {
    if (this.windows.get(id) !== record) {
      return;
    }

    const win = record.window;

    if (record.persistenceTimer) {
      clearTimeout(record.persistenceTimer);
      record.persistenceTimer = null;
    }

    if (win && !win.isDisposed?.()) {
      if (record.listenerIds?.close) {
        win.removeListenerById(record.listenerIds.close);
      }

      if (record.listenerIds?.move) {
        win.removeListenerById(record.listenerIds.move);
      }

      if (record.listenerIds?.resize) {
        win.removeListenerById(record.listenerIds.resize);
      }

      win.destroy();
    }

    this.windows.delete(id);
    this.eventBus.emit(Events.WINDOW_CLOSED, { id });
  }

  close(id) {
    const record = this.windows.get(id);

    if (!record) {
      return;
    }

    const win = record.window;

    if (!win || win.isDisposed?.()) {
      this.destroyRecord(id, record);
      return;
    }

    win.close();
  }

  closeAll() {
    for (const id of [...this.windows.keys()]) {
      this.close(id);
    }
  }
}

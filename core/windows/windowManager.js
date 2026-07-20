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
    singleton = true,
    showMinimize = false,
    compactSize = {},
    autoHide = false,
    pinnable = true,
    lockable = true
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
    const resolvedCompactSize = {
      width: compactSize.width ?? Math.min(width, 420),
      height: compactSize.height ?? Math.min(height, 240)
    };

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
      showMinimize,
      showMaximize: false,
      allowMinimize: showMinimize,
      allowMaximize: false,
      allowClose: true,
      modal: false,
      textColor: '#ffffff',
      resizableTop: resizable,
      resizableRight: resizable,
      resizableBottom: resizable,
      resizableLeft: resizable
    });

    const windowState = {
      pinned: Boolean(saved?.pinned),
      locked: Boolean(saved?.locked),
      compact: Boolean(saved?.compact),
      autoHide: Boolean(saved?.autoHide ?? autoHide)
    };
    if (windowState.compact) {
      win.setWidth(resolvedCompactSize.width);
      win.setHeight(resolvedCompactSize.height);
    }
    win.setAlwaysOnTop?.(windowState.pinned);
    win.setMovable?.(!windowState.locked);

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
      state: windowState,
      listenerIds: {}
    };

    record.setPinned = (value) => {
      if (!pinnable) return false;
      windowState.pinned = Boolean(value);
      win.setAlwaysOnTop?.(windowState.pinned);
      persist();
      return windowState.pinned;
    };
    record.setLocked = (value) => {
      if (!lockable) return false;
      windowState.locked = Boolean(value);
      win.setMovable?.(!windowState.locked);
      win.setResizable?.(!windowState.locked && resizable, !windowState.locked && resizable, !windowState.locked && resizable, !windowState.locked && resizable);
      persist();
      return windowState.locked;
    };
    record.setCompact = (value) => {
      windowState.compact = Boolean(value);
      if (windowState.compact) {
        record.expandedSize = win.getBounds?.();
        win.setWidth(resolvedCompactSize.width);
        win.setHeight(resolvedCompactSize.height);
      } else {
        win.setWidth(record.expandedSize?.width ?? width);
        win.setHeight(record.expandedSize?.height ?? height);
      }
      persist();
      return windowState.compact;
    };
    record.setAutoHide = (value) => { windowState.autoHide = Boolean(value); persist(); return windowState.autoHide; };

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
          height: Math.round(bounds.height),
          visible: win.isVisible?.() ?? true,
          ...windowState
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
    record.listenerIds.activate = win.addListener('activate', () => {
      if (record.autoHideTimer) { clearTimeout(record.autoHideTimer); record.autoHideTimer = null; }
      win.show?.();
    });
    record.listenerIds.deactivate = win.addListener('deactivate', () => {
      if (!windowState.autoHide) return;
      clearTimeout(record.autoHideTimer);
      record.autoHideTimer = setTimeout(() => win.exclude?.(), 350);
    });
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
    if (record.autoHideTimer) clearTimeout(record.autoHideTimer);

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
      if (record.listenerIds?.activate) win.removeListenerById(record.listenerIds.activate);
      if (record.listenerIds?.deactivate) win.removeListenerById(record.listenerIds.deactivate);

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

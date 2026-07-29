const NOTIFICATION_SPACING = 55;
const NOTIFICATION_MARGIN = 20;

export class NotificationService {
  constructor() {
    const qx = globalThis.qx;

    if (!qx?.core?.Init) {
      throw new Error(
        '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
      );
    }

    const app = qx.core.Init.getApplication();

    if (!app) {
      throw new Error(
        '[CnC-TA-Suite] Qooxdoo application is not available.'
      );
    }

    this.qx = qx;

    this.root =
      typeof app.getDesktop === 'function'
        ? (app.getDesktop() ?? app.getRoot())
        : app.getRoot();

    if (!this.root) {
      throw new Error(
        '[CnC-TA-Suite] Qooxdoo root widget is not available.'
      );
    }

    this.notifications = new Set();

    this.rootResizeListenerId = this.root.addListener(
      'resize',
      () => this.reposition()
    );
  }

  show(message, { duration = 3500 } = {}) {
    const popup = new this.qx.ui.popup.Popup(
      new this.qx.ui.layout.Grow()
    );

    popup.set({
      autoHide: false,
      keepActive: true
    });

    popup.add(
      new this.qx.ui.basic.Label(message).set({
        rich: true,
        wrap: true
      })
    );

    popup.addListener('click', () => {
      this.close(popup);
    });

    this.root.add(popup);

    this.notifications.add(popup);

    this.positionPopup(
      popup,
      this.notifications.size - 1
    );

    popup.show();

    const timer = setTimeout(() => {
      this.close(popup);
    }, duration);

    popup.setUserData('timer', timer);

    return popup;
  }

  close(popup) {
    if (!popup || popup.isDisposed?.()) {
      return;
    }

    const timer = popup.getUserData('timer');

    if (timer) {
      clearTimeout(timer);
      popup.setUserData('timer', null);
    }

    this.notifications.delete(popup);

    popup.destroy();

    this.reposition();
  }

  reposition() {
    let index = 0;

    for (const popup of this.notifications) {
      if (!popup || popup.isDisposed?.()) {
        continue;
      }

      this.positionPopup(popup, index);
      index++;
    }
  }

  positionPopup(popup, index) {
    const bounds = this.root.getBounds();

    if (!bounds) {
      return;
    }

    popup.placeToPoint({
      left: bounds.width - NOTIFICATION_MARGIN,
      top: NOTIFICATION_MARGIN + (index * NOTIFICATION_SPACING)
    });
  }

  clear() {
    for (const popup of [...this.notifications]) {
      this.close(popup);
    }
  }

  destroy() {
    this.clear();

    if (
      this.root &&
      !this.root.isDisposed?.() &&
      this.rootResizeListenerId
    ) {
      this.root.removeListenerById(
        this.rootResizeListenerId
      );
    }

    this.rootResizeListenerId = null;
    this.notifications.clear();

    this.root = null;
    this.qx = null;
  }
}
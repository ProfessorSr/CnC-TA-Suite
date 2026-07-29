export class UIService {
  constructor({
    windowManager,
    notifications,
    topBar,
    dialogs
  }) {
    this.windows = windowManager;
    this.notifications = notifications;
    this.topBar = topBar;
    this.dialogs = dialogs;
  }

  openWindow(options) {
    return this.windows.open(options);
  }

  closeWindow(id) {
    return this.windows.close(id);
  }

  notify(message, options) {
    return this.notifications.show(message, options);
  }

  addTopBarLink(definitionOrLabel, moduleId, context) {
    if (typeof definitionOrLabel === 'object') {
      return this.topBar.registerLink(definitionOrLabel);
    }

    return this.topBar.createLink(
      definitionOrLabel,
      moduleId,
      context
    );
  }

  removeTopBarLink(id) {
    return this.topBar.removeLink(id);
  }

  showDialog(optionsOrId, options = {}) {
    if (typeof optionsOrId === 'object') {
      return this.dialogs.show(optionsOrId);
    }

    return this.dialogs.show({
      id: optionsOrId,
      ...options
    });
  }
}

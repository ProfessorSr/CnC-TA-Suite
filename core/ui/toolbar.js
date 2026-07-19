function getQx() {
  const qx = globalThis.qx;

  if (!qx?.ui) {
    throw new Error(
      '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
    );
  }

  return qx;
}

export function createToolbar(items = []) {
  const qx = getQx();

  const toolbar = new qx.ui.toolbar.ToolBar();

  for (const item of items) {
    if (!item) {
      continue;
    }

    if (item === 'separator') {
      toolbar.add(new qx.ui.toolbar.Separator());
      continue;
    }

    if (item instanceof qx.ui.core.Widget) {
      toolbar.add(item);
      continue;
    }

    throw new TypeError(
      '[CnC-TA-Suite] Toolbar items must be Qooxdoo widgets or "separator".'
    );
  }

  return toolbar;
}
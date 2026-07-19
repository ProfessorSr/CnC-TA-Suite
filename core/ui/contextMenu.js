export function showContextMenu(x, y, items) {
  const qx = globalThis.qx;

  if (!qx?.ui?.menu?.Menu) {
    throw new Error(
      '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
    );
  }

  const menu = new qx.ui.menu.Menu();

  for (const item of items) {
    const button = new qx.ui.menu.Button(item.label);

    button.addListener('execute', () => {
      try {
        item.onClick?.();
      } finally {
        menu.exclude();
      }
    });

    menu.add(button);
  }

  menu.moveTo(x, y);
  menu.open();

  return menu;
}
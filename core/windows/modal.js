export function showModal({
  title,
  content,
  actions = []
}) {
  const win = new qx.ui.window.Window(title);

  win.set({
    modal: true,
    showMinimize: false,
    showMaximize: false,
    allowClose: false,
    resizable: false,
    layout: new qx.ui.layout.VBox(10),
    width: 420
  });

  if (typeof content === 'string') {
    win.add(new qx.ui.basic.Label(content).set({
      rich: true,
      wrap: true
    }));
  } else {
    win.add(content);
  }

  const buttons = new qx.ui.container.Composite(
    new qx.ui.layout.HBox(10)
  );

  buttons.add(new qx.ui.core.Spacer(), { flex: 1 });

  for (const action of actions) {
    const button = new qx.ui.form.Button(action.label);

    button.addListener("execute", () => {
      action.onClick?.();
      win.close();
      win.destroy();
    });

    buttons.add(button);
  }

  win.add(buttons);

  const root = qx.core.Init.getApplication().getRoot();
  root.add(win);

  win.center();
  win.open();

  return () => {
    if (!win.isDisposed()) {
      win.close();
      win.destroy();
    }
  };
}
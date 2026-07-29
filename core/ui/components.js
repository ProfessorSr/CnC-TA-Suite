function getQx() {
  const qx = globalThis.qx;

  if (!qx?.ui) {
    throw new Error(
      '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
    );
  }

  return qx;
}

export function button(label, onClick, { accent = false, title } = {}) {
  const qx = getQx();
  const widget = new qx.ui.form.Button(label);

  if (title) {
    widget.setToolTipText(title);
  }

  widget.setUserData('accent', Boolean(accent));

  if (typeof onClick === 'function') {
    widget.addListener('execute', onClick);
  }

  return widget;
}

export function statusRow(label, value, ok = true) {
  const qx = getQx();

  const row = new qx.ui.container.Composite(
    new qx.ui.layout.HBox(8)
  );

  row.set({
    allowGrowX: true
  });

  const labelWidget = new qx.ui.basic.Label(String(label ?? ''));
  const valueWidget = new qx.ui.basic.Label(String(value ?? ''));

  valueWidget.set({
    font: ok ? 'bold' : null,
    textAlign: 'right'
  });

  valueWidget.setUserData('ok', Boolean(ok));

  row.add(labelWidget, { flex: 1 });
  row.add(valueWidget);

  return row;
}
function getQx() {
  const qx = globalThis.qx;

  if (!qx?.ui) {
    throw new Error(
      '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
    );
  }

  return qx;
}

export function checkbox(label, checked = false, onChange) {
  const qx = getQx();

  const widget = new qx.ui.form.CheckBox(label);

  widget.set({
    value: Boolean(checked)
  });

  if (typeof onChange === 'function') {
    widget.addListener('changeValue', (event) => {
      onChange(event.getData());
    });
  }

  return widget;
}
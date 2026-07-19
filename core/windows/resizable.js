export function makeResizable(windowWidget, onResize) {
  if (!windowWidget || windowWidget.isDisposed?.()) {
    return () => {};
  }

  windowWidget.set({
    resizable: true,
    useResizeFrame: true
  });

  const listenerId = windowWidget.addListener('resize', () => {
    const bounds = windowWidget.getBounds();

    if (!bounds) {
      return;
    }

    onResize?.({
      width: bounds.width,
      height: bounds.height
    });
  });

  return () => {
    if (!windowWidget.isDisposed?.()) {
      windowWidget.removeListenerById(listenerId);
    }
  };
}
export function makeDraggable(windowWidget, onMove) {
  if (!windowWidget || windowWidget.isDisposed?.()) {
    return () => {};
  }

  const listenerId = windowWidget.addListener("move", () => {
    onMove?.({
      x: windowWidget.getLayoutProperties().left ?? 0,
      y: windowWidget.getLayoutProperties().top ?? 0
    });
  });

  return () => {
    if (!windowWidget.isDisposed()) {
      windowWidget.removeListenerById(listenerId);
    }
  };
}
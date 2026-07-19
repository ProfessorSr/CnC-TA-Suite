import { element } from '../utils/dom.js';

export function makeResizable(windowElement, onResize) {
  const handle = element('div', { className: 'cnc-suite-resize-handle' });
  windowElement.append(handle);

  let start = null;

  function move(event) {
    if (!start) return;
    const width = Math.max(260, start.width + event.clientX - start.x);
    const height = Math.max(140, start.height + event.clientY - start.y);
    windowElement.style.width = `${width}px`;
    windowElement.style.height = `${height}px`;
    onResize?.({ width, height });
  }

  function up() {
    start = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  }

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    start = {
      x: event.clientX,
      y: event.clientY,
      width: windowElement.offsetWidth,
      height: windowElement.offsetHeight
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

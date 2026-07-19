import { clamp } from '../utils/helpers.js';

export function makeDraggable(windowElement, handle, onMove) {
  let active = false;
  let offsetX = 0;
  let offsetY = 0;

  function pointerMove(event) {
    if (!active) return;
    const maxX = Math.max(0, window.innerWidth - windowElement.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - windowElement.offsetHeight);
    const x = clamp(event.clientX - offsetX, 0, maxX);
    const y = clamp(event.clientY - offsetY, 0, maxY);
    windowElement.style.left = `${x}px`;
    windowElement.style.top = `${y}px`;
    onMove?.({ x, y });
  }

  function pointerUp() {
    active = false;
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerup', pointerUp);
  }

  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    active = true;
    const rect = windowElement.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerUp);
  });
}

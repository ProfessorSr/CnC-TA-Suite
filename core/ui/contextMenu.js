import { element, ensureRoot } from '../utils/dom.js';

export function showContextMenu(x, y, items) {
  const menu = element('div', { className: 'cnc-suite-menu cnc-suite-window__body' });
  menu.style.position = 'fixed';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.background = 'var(--cnc-panel)';
  menu.style.border = '1px solid var(--cnc-border)';
  menu.style.borderRadius = '8px';

  for (const item of items) {
    const button = element('button', { className: 'cnc-suite-button', text: item.label });
    button.addEventListener('click', () => {
      item.onClick?.();
      menu.remove();
    });
    menu.append(button);
  }

  ensureRoot().append(menu);
  const dismiss = () => {
    menu.remove();
    document.removeEventListener('pointerdown', dismiss, true);
  };
  setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 0);
  return menu;
}

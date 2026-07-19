import { element, ensureRoot } from '../utils/dom.js';

export function showModal({ title, content, actions = [] }) {
  const backdrop = element('div', { className: 'cnc-suite-modal-backdrop' });
  const modal = element('div', { className: 'cnc-suite-modal' });
  modal.append(
    element('h2', { text: title }),
    typeof content === 'string' ? element('p', { text: content }) : content
  );

  const actionRow = element('div', { className: 'cnc-suite-grid' });
  for (const action of actions) {
    const button = element('button', {
      className: `cnc-suite-button ${action.primary ? 'cnc-suite-button--accent' : ''}`,
      text: action.label
    });
    button.addEventListener('click', () => {
      action.onClick?.();
      backdrop.remove();
    });
    actionRow.append(button);
  }

  modal.append(actionRow);
  backdrop.append(modal);
  ensureRoot().append(backdrop);
  return () => backdrop.remove();
}

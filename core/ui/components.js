import { element } from '../utils/dom.js';

export function button(label, onClick, { accent = false, title } = {}) {
  const node = element('button', {
    className: `cnc-suite-button ${accent ? 'cnc-suite-button--accent' : ''}`,
    text: label,
    attributes: { type: 'button', title }
  });
  node.addEventListener('click', onClick);
  return node;
}

export function statusRow(label, value, ok = true) {
  return element('li', {
    children: [
      element('span', { text: label }),
      element('span', {
        className: ok ? 'cnc-suite-status-ok' : '',
        text: value
      })
    ]
  });
}

import { element } from '../utils/dom.js';

export function checkbox(label, checked, onChange) {
  const input = element('input', { attributes: { type: 'checkbox' } });
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange?.(input.checked));
  return element('label', {
    children: [input, document.createTextNode(` ${label}`)]
  });
}

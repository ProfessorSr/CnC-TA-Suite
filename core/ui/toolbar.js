import { element } from '../utils/dom.js';

export function createToolbar(items = []) {
  return element('div', {
    className: 'cnc-suite-grid',
    children: items
  });
}

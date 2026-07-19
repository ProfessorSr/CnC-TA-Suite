import { element, ensureRoot } from '../utils/dom.js';

export class NotificationService {
  constructor() {
    this.container = element('div', { className: 'cnc-suite-notifications' });
    ensureRoot().append(this.container);
  }

  show(message, { duration = 3500 } = {}) {
    const item = element('div', {
      className: 'cnc-suite-notification',
      text: message
    });
    this.container.append(item);
    const timer = setTimeout(() => item.remove(), duration);
    item.addEventListener('click', () => {
      clearTimeout(timer);
      item.remove();
    });
    return item;
  }
}

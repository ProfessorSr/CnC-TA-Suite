import { element, ensureRoot } from '../utils/dom.js';
import { makeDraggable } from './draggable.js';
import { makeResizable } from './resizable.js';
import { Events } from '../events/eventTypes.js';

export class WindowManager {
  constructor({ eventBus, storage, settings, logger }) {
    this.eventBus = eventBus;
    this.storage = storage;
    this.settings = settings;
    this.logger = logger;
    this.windows = new Map();
    this.root = ensureRoot();
  }

  async open({
    id,
    title,
    content,
    x = 24,
    y = 64,
    width = 360,
    height,
    resizable = true,
    singleton = true
  }) {
    if (singleton && this.windows.has(id)) {
      const existing = this.windows.get(id);
      existing.element.style.display = '';
      existing.element.focus();
      return existing;
    }

    const saved = this.settings.get('windows.rememberPositions', true)
      ? await this.storage.get(`window:${id}`, null)
      : null;

    const win = element('section', {
      className: 'cnc-suite-window',
      attributes: { tabindex: '0', 'data-window-id': id }
    });
    win.style.left = `${saved?.x ?? x}px`;
    win.style.top = `${saved?.y ?? y}px`;
    win.style.width = `${saved?.width ?? width}px`;
    if (saved?.height ?? height) win.style.height = `${saved?.height ?? height}px`;

    const header = element('header', { className: 'cnc-suite-window__header' });
    const titleNode = element('div', { className: 'cnc-suite-window__title', text: title });
    const actions = element('div', { className: 'cnc-suite-window__actions' });
    const close = element('button', {
      className: 'cnc-suite-button cnc-suite-icon-button',
      text: '×',
      attributes: { type: 'button', title: 'Close' }
    });

    const body = element('div', { className: 'cnc-suite-window__body' });
    if (typeof content === 'string') body.textContent = content;
    else if (content) body.append(content);

    close.addEventListener('click', () => this.close(id));
    actions.append(close);
    header.append(titleNode, actions);
    win.append(header, body);
    this.root.append(win);

    const persist = () => {
      if (!this.settings.get('windows.rememberPositions', true)) return;
      const rect = win.getBoundingClientRect();
      this.storage.set(`window:${id}`, {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    };

    makeDraggable(win, header, persist);
    if (resizable) makeResizable(win, persist);

    const record = { id, element: win, body, close: () => this.close(id) };
    this.windows.set(id, record);
    this.eventBus.emit(Events.WINDOW_OPENED, { id });
    return record;
  }

  close(id) {
    const record = this.windows.get(id);
    if (!record) return;
    record.element.remove();
    this.windows.delete(id);
    this.eventBus.emit(Events.WINDOW_CLOSED, { id });
  }

  closeAll() {
    for (const id of [...this.windows.keys()]) this.close(id);
  }
}

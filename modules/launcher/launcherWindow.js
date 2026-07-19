import { element } from '../../core/utils/dom.js';
import { button } from '../../core/ui/components.js';

export function buildLauncherWindow(context) {
  const content = element('div', { className: 'cnc-suite-grid' });

  content.append(
    element('div', {
      text: 'CnC-TA-Suite',
      attributes: { style: 'font-size:18px;font-weight:800;' }
    }),
    element('div', {
      className: 'cnc-suite-muted',
      text: 'Core framework launcher'
    }),
    button('Suite Status', () => context.modules.modules.get('suite-status')?.open(context), { accent: true }),
    button('Show Notification', () => context.notifications.show('Core services are operational.'))
  );

  return content;
}

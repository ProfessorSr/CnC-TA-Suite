import { button } from '../../core/ui/components.js';

export function buildLauncherWindow(context) {
  const qx = globalThis.qx;
  const content = new qx.ui.container.Composite(
    new qx.ui.layout.VBox(10)
  );

  const heading = new qx.ui.basic.Label('CnC-TA-Suite');
  heading.set({ font: 'bold', rich: true });

  const description = new qx.ui.basic.Label('Core framework launcher');
  description.set({ wrap: true });

  content.add(heading);
  content.add(description);
  content.add(
    button(
      'Show Notification',
      () => context.notifications.show('Core services are operational.')
    )
  );

  return content;
}

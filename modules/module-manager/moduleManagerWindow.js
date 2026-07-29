import { moduleStatus } from '../../core/modules/modulePresentation.js';

const PROTECTED_MODULES = new Set(['module-manager']);

function getQx() {
  const qx = globalThis.qx;

  if (!qx?.ui) {
    throw new Error(
      '[CnC-TA-Suite] Qooxdoo is not available. The game UI may not be ready.'
    );
  }

  return qx;
}

function enabledState(state) {
  return state === 'enabled';
}

function moduleDescription(module) {
  return (
    module.manifest?.description ||
    module.description ||
    'No description provided.'
  );
}

function moduleAuthor(module) {
  return module.manifest?.author || module.author || 'Unknown author';
}

function moduleVersion(module) {
  return module.manifest?.version || module.version || '0.0.0';
}

function moduleUpdated(module) {
  return module.manifest?.lastUpdated || module.lastUpdated || 'Unknown date';
}

function canOpenModule(module) {
  return (
    module.manifest?.window === true ||
    typeof module.open === 'function' ||
    typeof module.openWindow === 'function'
  );
}

async function openModule(context, module) {
  if (typeof context.modules.open === 'function') {
    await context.modules.open(module.id);
    return;
  }

  if (typeof module.openWindow === 'function') {
    await module.openWindow(context);
    return;
  }

  if (typeof module.open === 'function') {
    await module.open(context);
  }
}

function closeOpenModuleWindows(context, module) {
  const windows = context.windows?.windows;
  const ids = windows ? [...windows.keys()].filter((id) =>
    id === module.id || id.startsWith(`${module.id}-`)
  ) : [];
  for (const id of ids) context.windows.close?.(id);
  if (ids.length) return true;
  const nativeWindows = [
    module?.scannerWindow?.window,
    module?.scannerWindow?.layoutWindow?.window,
    module?.record?.window,
    module?.window?.record?.window
  ].filter((window) => window && !window.isDisposed?.() && window.isVisible?.() !== false);
  for (const window of nativeWindows) window.close?.();
  return nativeWindows.length > 0;
}

function createModuleRow(context, module, refresh) {
  const qx = getQx();

  const state = context.modules.getState(module.id) ?? 'registered';
  const isEnabled = enabledState(state);
  const isProtected = PROTECTED_MODULES.has(module.id);
  const moduleName = module.name || module.id;
  const supportsOpen = canOpenModule(module);

  const row = new qx.ui.container.Composite(
    new qx.ui.layout.VBox(5)
  );

  row.set({
    padding: 8
  });

  row.setUserData('moduleId', module.id);

  const header = new qx.ui.container.Composite(
    new qx.ui.layout.HBox(8)
  );

  row.add(header);

  const information = new qx.ui.container.Composite(
    new qx.ui.layout.VBox(2)
  );

  header.add(information, { flex: 1 });

  const nameLabel = new qx.ui.basic.Label(moduleName);

  nameLabel.set({
    font: 'bold',
    toolTipText: moduleDescription(module)
  });

  information.add(nameLabel);

  const metadataLabel = new qx.ui.basic.Label(
    `${moduleVersion(module)} · ${moduleAuthor(module)} · Updated ${moduleUpdated(module)}`
    + ` · UI ${module.definition?.uiSchemaVersion ?? 'legacy'} (${module.definition?.renderer ?? 'unregistered'})`
  );

  information.add(metadataLabel);

  const actions = new qx.ui.container.Composite(
    new qx.ui.layout.HBox(5)
  );

  header.add(actions);

  const enabledCheckbox = new qx.ui.form.CheckBox('Enabled');

  enabledCheckbox.set({
    value: isEnabled,
    enabled: !isProtected,
    toolTipText: isProtected
      ? `${moduleName} must remain enabled while managing modules.`
      : `${isEnabled ? 'Disable' : 'Enable'} ${moduleName}`
  });

  actions.add(enabledCheckbox);

  let changingState = false;

  enabledCheckbox.addListener('changeValue', async (event) => {
    if (changingState) {
      return;
    }

    const shouldEnable = event.getData();

    changingState = true;
    enabledCheckbox.setEnabled(false);

    try {
      await context.modules.setEnabled(module.id, shouldEnable);

      context.notifications?.show?.(
        `${moduleName} ${shouldEnable ? 'enabled' : 'disabled'}.`
      );

      refresh();
    } catch (error) {
      console.error(
        '[CnC-TA-Suite] Failed to change module state.',
        error
      );

      enabledCheckbox.setValue(!shouldEnable);
    } finally {
      changingState = false;

      if (!enabledCheckbox.isDisposed()) {
        enabledCheckbox.setEnabled(!isProtected);
      }
    }
  });

  if (supportsOpen) {
    const openButton = new qx.ui.form.Button('Open');

    openButton.set({
      enabled: isEnabled,
      toolTipText: `Open ${moduleName}`
    });

    actions.add(openButton);

    openButton.addListener('execute', async () => {
      openButton.setEnabled(false);

      try {
        if (!closeOpenModuleWindows(context, module)) await openModule(context, module);
      } catch (error) {
        console.error(
          `[CnC-TA-Suite] Failed to open module "${module.id}".`,
          error
        );

        context.notifications?.show?.(
          `Unable to open ${moduleName}.`
        );
      } finally {
        if (!openButton.isDisposed()) {
          const currentState =
            context.modules.getState(module.id) ?? 'registered';

          openButton.setEnabled(enabledState(currentState));
        }
      }
    });
  }

  const descriptionLabel = new qx.ui.basic.Label(
    moduleDescription(module)
  );

  descriptionLabel.set({
    wrap: true,
    rich: false,
    toolTipText: moduleDescription(module)
  });

  row.add(descriptionLabel);

  const visibleState = moduleStatus(state);
  const stateLabel = new qx.ui.basic.Label(
    `Status: ${visibleState.label}${isProtected ? ' · Required' : ''}`
  );
  stateLabel.set({ textColor: visibleState.color });

  row.add(stateLabel);

  const separator = new qx.ui.core.Widget();

  separator.set({
    height: 1,
    allowGrowX: true
  });

  row.add(separator);

  return row;
}

export function buildModuleManagerWindow(context) {
  const qx = getQx();

  const mainContainer = new qx.ui.container.Composite(
    new qx.ui.layout.VBox(10)
  );

  mainContainer.set({
    padding: 10,
    allowGrowX: true,
    allowGrowY: true
  });

  const summaryLabel = new qx.ui.basic.Label(
    'Enable, disable, and open installed CnC-TA-Suite modules. ' +
    'Changes take effect immediately and are saved for the next page load.'
  );

  summaryLabel.set({
    wrap: true,
    rich: false
  });

  mainContainer.add(summaryLabel);

  const scroll = new qx.ui.container.Scroll();

  scroll.set({
    allowGrowX: true,
    allowGrowY: true
  });

  mainContainer.add(scroll, { flex: 1 });

  const moduleList = new qx.ui.container.Composite(
    new qx.ui.layout.VBox(4)
  );

  moduleList.set({
    allowGrowX: true,
    padding: 2
  });

  scroll.add(moduleList);

  const render = () => {
    if (moduleList.isDisposed()) {
      return;
    }

    const oldRows = moduleList.removeAll();

for (const row of oldRows) {
  row.destroy();
}

    const installedModules = Array.from(
      context.modules.registry.values()
    ).sort((left, right) =>
      (left.name || left.id).localeCompare(
        right.name || right.id
      )
    );

    for (const module of installedModules) {
      moduleList.add(
        createModuleRow(context, module, render)
      );
    }
  };

  render();

  return mainContainer;
}

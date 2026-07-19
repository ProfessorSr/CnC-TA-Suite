import { Module } from '../../core/interfaces/module.js';

export const sampleManifest = Object.freeze({
  id: 'sample',
  name: 'Sample Module',
  version: '0.1.0',
  apiVersion: '1.0.0',
  author: 'CnC-TA-Suite',
  description: 'Reference module demonstrating the v0.4 module lifecycle, settings, permissions, and event helpers.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['events', 'notifications', 'settings']),
  settings: Object.freeze({
    showNotificationOnEnable: Object.freeze({
      type: 'boolean',
      default: true
    }),
    message: Object.freeze({
      type: 'string',
      default: 'Sample module enabled.'
    })
  })
});

export class SampleModule extends Module {
  constructor() {
    super(sampleManifest);
    this.enabledAt = null;
  }

  async initialize(context) {
    context.logger.debug?.('Sample module initialized.');
  }

  async load(context) {
    context.logger.debug?.('Sample module loaded.');
  }

  async enable(context) {
    this.enabledAt = Date.now();

    context.events.emit('sample:enabled', {
      id: this.id,
      enabledAt: this.enabledAt
    });

    const shouldNotify = context.moduleSettings?.get('showNotificationOnEnable', true) ?? true;
    if (shouldNotify && context.notifications?.show) {
      const message = context.moduleSettings?.get('message', 'Sample module enabled.')
        ?? 'Sample module enabled.';
      context.notifications.show(message);
    }

    context.logger.info?.('Sample module enabled.');
  }

  async disable(context) {
    context.events.emit('sample:disabled', {
      id: this.id,
      disabledAt: Date.now()
    });

    this.enabledAt = null;
    context.logger.info?.('Sample module disabled.');
  }

  async unload(context) {
    context.logger.debug?.('Sample module unloaded.');
  }

  async destroy(context) {
    context.logger.debug?.('Sample module destroyed.');
  }
}

export default SampleModule;

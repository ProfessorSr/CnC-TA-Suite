export const SETTINGS_SCHEMA = Object.freeze({
  'general.enabled': 'boolean',
  'general.logLevel': ['debug', 'info', 'warn', 'error'],
  'general.showLauncherOnStartup': 'boolean',
  'theme.name': 'string',
  'theme.compact': 'boolean',
  'windows.rememberPositions': 'boolean',
  'modules.launcher': 'boolean',
  'modules.suiteStatus': 'boolean'
});

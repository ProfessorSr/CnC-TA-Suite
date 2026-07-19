export const Events = Object.freeze({
  SUITE_BOOTSTRAP_STARTED: 'suite:bootstrap-started',
  SUITE_READY: 'suite:ready',
  SUITE_ERROR: 'suite:error',

  GAME_DISCOVERY_STARTED: 'game:discovery-started',
  GAME_DISCOVERED: 'game:discovered',
  GAME_COMPATIBILITY_CHECKED: 'game:compatibility-checked',
  GAME_READY: 'game:ready',
  GAME_ERROR: 'game:error',
  GAME_CONNECTION_LOST: 'game:connection-lost',
  GAME_CONNECTION_RESTORED: 'game:connection-restored',
  GAME_STATE_INITIALIZED: 'game:state-initialized',
  GAME_TICK: 'game:tick',

  PLAYER_CHANGED: 'game:player-changed',
  CITY_CHANGED: 'game:city-changed',
  WORLD_CHANGED: 'game:world-changed',
  ALLIANCE_CHANGED: 'game:alliance-changed',
  SELECTION_CHANGED: 'game:selection-changed',
  BATTLE_ENTERED: 'game:battle-entered',
  BATTLE_EXITED: 'game:battle-exited',

  SETTINGS_CHANGED: 'settings:changed',
  THEME_CHANGED: 'theme:changed',
  WINDOW_OPENED: 'window:opened',
  WINDOW_CLOSED: 'window:closed',
  MODULE_REGISTERED: 'module:registered',
  MODULE_STARTED: 'module:started',
  MODULE_STOPPED: 'module:stopped'
});

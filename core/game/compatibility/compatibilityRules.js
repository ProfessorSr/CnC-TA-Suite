export const COMPATIBILITY_RULES = Object.freeze([
  {
    id: 'clientlib-main-data',
    required: true,
    test: ({ clientLib }) =>
      typeof clientLib?.Data?.MainData?.GetInstance === 'function',
    message: 'ClientLib MainData API is unavailable.'
  },
  {
    id: 'qx-application',
    required: true,
    test: ({ application }) => Boolean(application),
    message: 'qooxdoo application instance is unavailable.'
  },
  {
    id: 'server-object',
    required: true,
    test: ({ clientLib }) =>
      Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_Server?.()),
    message: 'Game server object is unavailable.'
  },
  {
    id: 'player-object',
    required: false,
    test: ({ clientLib }) =>
      Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_Player?.()),
    message: 'Player object is not ready.'
  },
  {
    id: 'world-object',
    required: false,
    test: ({ clientLib }) =>
      Boolean(clientLib?.Data?.MainData?.GetInstance?.()?.get_World?.()),
    message: 'World object is not ready.'
  }
]);

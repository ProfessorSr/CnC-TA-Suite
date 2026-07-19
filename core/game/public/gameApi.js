export function createGameApi(gameIntegration) {
  const service = (name) => gameIntegration.getService(name);

  return Object.freeze({
    get ready() {
      return gameIntegration.ready;
    },

    get version() {
      return gameIntegration.version?.normalized ?? 'unknown';
    },

    player: Object.freeze({
      current: (options) => service('player').current(options),
      raw: () => service('player').raw(),
      refresh: () => service('player').current({ refresh: true })
    }),

    city: Object.freeze({
      current: () => service('city').current(),
      all: () => service('city').all(),
      find: (id) => service('city').find(id)
    }),

    world: Object.freeze({
      info: () => service('world').snapshot(),
      distance: (a, b) => service('world').distance(a, b)
    }),

    alliance: Object.freeze({
      current: () => service('alliance').current()
    }),

    base: Object.freeze({
      selected: () => service('base').selected(),
      level: () => service('base').level()
    }),

    battle: Object.freeze({
      isActive: () => service('battle').isActive(),
      state: () => service('battle').getState(),
      target: () => service('battle').getTarget(),
      attacker: () => service('battle').getFormation('attacker'),
      defender: () => service('battle').getFormation('defender')
    }),

    selection: Object.freeze({
      current: () => service('selection').current(),
      type: () => service('selection').getType(),
      clear: () => service('selection').clear(),
      snapshot: () => service('selection').snapshot()
    }),

    objects: Object.freeze({
      get: (id) => service('battleObjects').get(id),
      register: (id, object, metadata) =>
        service('battleObjects').register(id, object, metadata),
      remove: (id) => service('battleObjects').remove(id),
      snapshot: () => service('battleObjects').snapshot()
    }),

    cache: Object.freeze({
      invalidate: (key) => service('cache').invalidate(key),
      clear: () => service('cache').clear(),
      snapshot: () => service('cache').snapshot()
    })
  });
}

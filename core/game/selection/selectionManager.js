export class SelectionManager {
  constructor({ clientLib, qx, objectDiscovery, cache, logger }) {
    this.clientLib = clientLib;
    this.qx = qx;
    this.objectDiscovery = objectDiscovery;
    this.cache = cache;
    this.logger = logger;
  }

  getVisMain() {
    const application = this.qx.getApplication();

    return this.objectDiscovery.findFirst(application, [
      (value) => value?.getVisMain?.(),
      (value) => value?.get_VisMain?.(),
      (value) => value?.getDesktop?.()?.getVisMain?.()
    ]);
  }

  current() {
    return this.cache.get('selection:current', () => {
      const visMain = this.getVisMain();

      return this.objectDiscovery.findFirst(visMain, [
        (value) => value?.get_SelectedObject?.(),
        (value) => value?.get_SelectedEntity?.(),
        (value) => value?.get_Selection?.()
      ]);
    }, { ttl: 150 }) ?? null;
  }

  getType(value = this.current()) {
    if (!value) return 'none';
    return value.constructor?.name
      ?? this.clientLib.call(value, ['get_Type', 'get_ObjectType'])
      ?? typeof value;
  }

  getId(value = this.current()) {
    return this.clientLib.call(value, [
      'get_Id',
      'get_BaseId',
      'get_CityId',
      'get_ObjectId'
    ]) ?? null;
  }

  snapshot() {
    const value = this.current();
    return Object.freeze({
      value,
      id: this.getId(value),
      type: this.getType(value),
      selected: Boolean(value)
    });
  }

  clear() {
    const visMain = this.getVisMain();
    const methods = ['set_SelectedObject', 'set_SelectedEntity'];

    for (const name of methods) {
      if (typeof visMain?.[name] !== 'function') continue;
      visMain[name](null);
      this.invalidate();
      return true;
    }

    return false;
  }

  invalidate() {
    this.cache.invalidate('selection');
  }
}

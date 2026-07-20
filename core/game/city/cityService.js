export class CityService {
  constructor({ clientLib, cache, objectDiscovery, logger, performance }) {
    this.clientLib = clientLib;
    this.cache = cache;
    this.objectDiscovery = objectDiscovery;
    this.logger = logger;
    this.performance = performance;
  }

  manager() {
    return this.clientLib.getCities();
  }

  currentRaw() {
    return this.cache.get('city:current:raw', () =>
      this.clientLib.call(this.manager(), [
        'get_CurrentOwnCity',
        'get_CurrentCity'
      ]), { ttl: 400 }) ?? null;
  }

  allRaw() {
    return this.cache.get('city:all:raw', () => {
      const collection = this.clientLib.call(this.manager(), [
        'get_AllCities',
        'get_AllOwnCities',
        'get_Cities'
      ]);

      if (!collection) return [];
      if (Array.isArray(collection)) return collection;

      const values = [];
      if (typeof collection.forEach === 'function') {
        collection.forEach((value) => values.push(value));
        return values;
      }

      if (typeof collection === 'object') {
        for (const value of Object.values(collection)) {
          if (value && typeof value === 'object') values.push(value);
        }
      }

      return values;
    }, { ttl: 1500 }) ?? [];
  }

  describe(raw) {
    if (!raw) return null;

    return Object.freeze({
      raw,
      id: this.clientLib.call(raw, ['get_Id', 'get_CityId']) ?? null,
      name: this.clientLib.call(raw, ['get_Name', 'get_CityName']) ?? null,
      level: this.clientLib.call(raw, ['get_LvlBase', 'get_Level']) ?? null,
      x: this.clientLib.call(raw, ['get_PosX', 'get_X', 'get_CoordX']) ?? null,
      y: this.clientLib.call(raw, ['get_PosY', 'get_Y', 'get_CoordY']) ?? null,
      ownerId: this.clientLib.call(raw, ['get_PlayerId', 'get_OwnerId']) ?? null,
      ownerName: this.clientLib.call(raw, ['get_PlayerName', 'get_OwnerName']) ?? null
    });
  }

  current() {
    return this.describe(this.currentRaw());
  }

  all() {
    const operation = () => this.allRaw().map((city) => this.describe(city)).filter(Boolean);
    return this.performance?.measure?.('city.normalize-all', operation) ?? operation();
  }

  find(id) {
    const normalized = String(id);
    return this.all().find((city) => String(city.id) === normalized) ?? null;
  }

  invalidate() {
    this.cache.invalidate('city');
  }
}

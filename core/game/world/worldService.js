export class WorldService {
  constructor({ clientLib, cache, logger }) {
    this.clientLib = clientLib;
    this.cache = cache;
    this.logger = logger;
  }

  raw() {
    return this.cache.get('world:raw', () => this.clientLib.getWorld(), {
      ttl: 1000
    }) ?? null;
  }

  snapshot() {
    return this.cache.get('world:snapshot', () => {
      const world = this.raw();
      const server = this.clientLib.getServer();
      if (!world && !server) return null;

      return Object.freeze({
        raw: world,
        id: this.clientLib.call(server, ['get_WorldId', 'get_Id']) ?? null,
        name: this.clientLib.call(server, ['get_Name', 'get_WorldName']) ?? null,
        season: this.clientLib.call(server, ['get_Season']) ?? null,
        width: this.clientLib.call(world, ['get_WorldWidth', 'get_Width']) ?? null,
        height: this.clientLib.call(world, ['get_WorldHeight', 'get_Height']) ?? null,
        serverTime: this.clientLib.call(server, ['get_ServerTime', 'get_Time']) ?? null
      });
    }, { ttl: 5000 }) ?? null;
  }

  distance(a, b) {
    if (!a || !b) return null;
    const ax = Number(a.x);
    const ay = Number(a.y);
    const bx = Number(b.x);
    const by = Number(b.y);
    if (![ax, ay, bx, by].every(Number.isFinite)) return null;
    return Math.hypot(bx - ax, by - ay);
  }

  invalidate() {
    this.cache.invalidate('world');
  }
}

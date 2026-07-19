export class WorldService {
  constructor(clientLib) {
    this.clientLib = clientLib;
  }

  getWorld() {
    return this.clientLib.getMainData()?.get_World?.() || null;
  }
}

export class BaseService {
  constructor({ clientLib, cache, city, selection, logger }) {
    this.clientLib = clientLib;
    this.cache = cache;
    this.city = city;
    this.selection = selection;
    this.logger = logger;
  }

  selectedRaw() {
    return this.selection.current() ?? this.city.currentRaw();
  }

  describe(raw = this.selectedRaw()) {
    if (!raw) return null;

    return Object.freeze({
      raw,
      id: this.clientLib.call(raw, ['get_Id', 'get_BaseId', 'get_CityId']) ?? null,
      name: this.clientLib.call(raw, ['get_Name', 'get_BaseName']) ?? null,
      level: this.clientLib.call(raw, ['get_LvlBase', 'get_BaseLevel', 'get_Level']) ?? null,
      x: this.clientLib.call(raw, ['get_PosX', 'get_X', 'get_CoordX']) ?? null,
      y: this.clientLib.call(raw, ['get_PosY', 'get_Y', 'get_CoordY']) ?? null,
      ownerId: this.clientLib.call(raw, ['get_PlayerId', 'get_OwnerId']) ?? null,
      ownerName: this.clientLib.call(raw, ['get_PlayerName', 'get_OwnerName']) ?? null,
      allianceId: this.clientLib.call(raw, ['get_AllianceId']) ?? null,
      type: this.clientLib.call(raw, ['get_Type', 'get_CityType', 'get_BaseType'])
        ?? raw.constructor?.name
        ?? null
    });
  }

  selected() {
    return this.describe();
  }

  level() {
    return this.selected()?.level ?? null;
  }

  invalidate() {
    this.cache.invalidate('base');
  }
}

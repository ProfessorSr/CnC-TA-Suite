export class UnitModel {
  constructor(raw, { clientLib } = {}) {
    this.raw = raw ?? null;
    this.clientLib = clientLib ?? null;
  }

  read(names) {
    if (!this.raw) return null;
    if (this.clientLib) return this.clientLib.call(this.raw, names) ?? null;

    for (const name of names) {
      if (typeof this.raw?.[name] === 'function') {
        try { return this.raw[name](); } catch { /* ignored */ }
      }
    }
    return null;
  }

  get id() { return this.read(['get_Id', 'get_UnitId']); }
  get typeId() {
    return this.raw?.get_UnitGameData_Obj?.()?.get_Id?.()
      ?? this.read(['get_UnitGameDataId', 'get_UnitType'])
      ?? null;
  }
  get name() {
    return this.raw?.get_UnitGameData_Obj?.()?.get_Name?.()
      ?? this.read(['get_Name'])
      ?? null;
  }
  get level() { return this.read(['get_CurrentLevel', 'get_Lvl', 'get_Level']); }
  get health() { return this.read(['get_HitpointsPercent', 'get_HealthPercent']); }
  get x() { return this.read(['get_CoordX', 'get_X', 'get_FormationCol']); }
  get y() { return this.read(['get_CoordY', 'get_Y', 'get_FormationRow']); }
  get row() { return this.read(['get_FormationRow']) ?? this.y; }
  get column() { return this.read(['get_FormationCol']) ?? this.x; }
  get isAlive() { return this.health === null || this.health > 0; }

  toJSON() {
    return Object.freeze({
      id: this.id,
      typeId: this.typeId,
      name: this.name,
      level: this.level,
      health: this.health,
      x: this.x,
      y: this.y,
      row: this.row,
      column: this.column,
      isAlive: this.isAlive
    });
  }
}

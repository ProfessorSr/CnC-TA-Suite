import { UnitModel } from './unitModel.js';

function collect(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;

  const values = [];
  if (typeof collection.forEach === 'function') {
    collection.forEach((value) => values.push(value));
    return values;
  }

  if (typeof collection.get_Units === 'function') {
    return collect(collection.get_Units());
  }

  if (typeof collection === 'object') {
    for (const value of Object.values(collection)) {
      if (value && typeof value === 'object') values.push(value);
    }
  }

  return values;
}

export class FormationModel {
  constructor(units = [], options = {}) {
    this.units = collect(units)
      .filter(Boolean)
      .map((unit) => unit instanceof UnitModel ? unit : new UnitModel(unit, options));
  }

  static fromCollection(collection, options = {}) {
    return new FormationModel(collection, options);
  }

  get size() { return this.units.length; }

  at(row, column) {
    return this.units.find(
      (unit) => Number(unit.row) === Number(row)
        && Number(unit.column) === Number(column)
    ) ?? null;
  }

  rows() {
    const grouped = new Map();

    for (const unit of this.units) {
      const row = Number(unit.row ?? -1);
      if (!grouped.has(row)) grouped.set(row, []);
      grouped.get(row).push(unit);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, units]) => Object.freeze({
        row,
        units: Object.freeze(
          units.sort((a, b) => Number(a.column ?? 0) - Number(b.column ?? 0))
        )
      }));
  }

  toJSON() {
    return Object.freeze({
      size: this.size,
      units: Object.freeze(this.units.map((unit) => unit.toJSON()))
    });
  }
}

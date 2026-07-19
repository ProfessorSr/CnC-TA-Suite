import { UnitModel } from '../../core/game/battle/unitModel.js';

export function runUnitModelTest() {
  const raw = {
    get_Id: () => 5,
    get_CurrentLevel: () => 31,
    get_CoordX: () => 2,
    get_CoordY: () => 1,
    get_HitpointsPercent: () => 75
  };

  const unit = new UnitModel(raw);

  if (unit.id !== 5) throw new Error('Unit id mismatch.');
  if (unit.level !== 31) throw new Error('Unit level mismatch.');
  if (unit.row !== 1 || unit.column !== 2) {
    throw new Error('Unit coordinates mismatch.');
  }

  return true;
}

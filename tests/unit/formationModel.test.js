import { FormationModel } from '../../core/game/battle/formationModel.js';

export function runFormationModelTest() {
  const formation = new FormationModel([
    { get_Id: () => 1, get_CoordX: () => 2, get_CoordY: () => 0 },
    { get_Id: () => 2, get_CoordX: () => 0, get_CoordY: () => 0 }
  ]);

  if (formation.size !== 2) {
    throw new Error('Formation size mismatch.');
  }

  if (formation.rows()[0].units[0].id !== 2) {
    throw new Error('Formation units were not sorted by column.');
  }

  return true;
}

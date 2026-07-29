export const WAR_ROOM_COMPANION_SETTINGS_KEY = 'module:war-room:companion-windows:v1';

export const DEFAULT_WAR_ROOM_COMPANION_SETTINGS = Object.freeze({
  formationControls: true,
  compactSimulationOutcome: true,
  compactAttackPlanner: false
});

export function normalizeWarRoomCompanionSettings(value = {}) {
  return {
    formationControls: value?.formationControls !== false,
    compactSimulationOutcome: value?.compactSimulationOutcome !== false,
    compactAttackPlanner: value?.compactAttackPlanner !== false
  };
}

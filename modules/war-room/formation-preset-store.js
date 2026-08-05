export const FORMATION_PRESET_KEY = 'module:war-room:formation-presets:v1';

const LOCAL_MIRROR_KEY = `cnc-ta-suite:${FORMATION_PRESET_KEY}`;

export function formationTargetMatches(saved, current) {
  if (!saved || !current) return false;
  if (saved.id != null && current.id != null && String(saved.id) === String(current.id)) return true;
  const savedX = Number(saved.x), savedY = Number(saved.y);
  const currentX = Number(current.x), currentY = Number(current.y);
  return Number.isFinite(savedX) && Number.isFinite(savedY)
    && Number.isFinite(currentX) && Number.isFinite(currentY)
    && savedX === currentX && savedY === currentY;
}

function normalizePreset(preset) {
  if (!preset?.id || preset?.attackerId == null || preset?.target?.id == null) return null;
  return {
    id: String(preset.id),
    name: String(preset.name || 'Formation'),
    attackerId: preset.attackerId,
    attackerName: String(preset.attackerName || 'Attacking base'),
    target: {
      id: preset.target.id,
      name: String(preset.target.name || 'Target'),
      x: Number(preset.target.x || 0),
      y: Number(preset.target.y || 0),
      version: Number(preset.target.version || 0)
    },
    updatedAt: Number(preset.updatedAt || 0),
    units: (Array.isArray(preset.units) ? preset.units : []).map((unit) => ({
      entityId: unit.entityId,
      mdbId: unit.mdbId,
      name: String(unit.name || 'Unit'),
      level: Number(unit.level || 0),
      x: Number(unit.x || 0),
      y: Number(unit.y || 0),
      enabled: unit.enabled !== false,
      transporterId: unit.transporterId ?? null,
      garrisonId: unit.garrisonId ?? null
    }))
  };
}

function normalizeList(value) {
  return (Array.isArray(value) ? value : []).map(normalizePreset).filter(Boolean);
}

function localRead() {
  try { return normalizeList(JSON.parse(globalThis.localStorage?.getItem(LOCAL_MIRROR_KEY) ?? '[]')); }
  catch { return []; }
}

function localWrite(presets) {
  try { globalThis.localStorage?.setItem(LOCAL_MIRROR_KEY, JSON.stringify(presets)); }
  catch { /* Extension storage remains authoritative when localStorage is unavailable. */ }
}

export async function loadFormationPresets(storage) {
  const remote = normalizeList(await storage?.get?.(FORMATION_PRESET_KEY, []));
  const merged = new Map([...remote, ...localRead()]
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .map((preset) => [preset.id, preset]));
  const presets = [...merged.values()];
  localWrite(presets);
  if (presets.length !== remote.length) await storage?.set?.(FORMATION_PRESET_KEY, presets);
  return presets;
}

export async function saveFormationPresets(storage, value) {
  const presets = normalizeList(value);
  localWrite(presets);
  await storage?.set?.(FORMATION_PRESET_KEY, presets);
  return presets;
}

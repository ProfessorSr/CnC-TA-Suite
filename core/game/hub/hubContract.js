export const HUB_API_VERSION = '1.0.0';

export function validateHubSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') errors.push('Snapshot must be an object.');
  if (snapshot?.schemaVersion !== HUB_API_VERSION) errors.push(`Expected Hub schema ${HUB_API_VERSION}.`);
  if (typeof snapshot?.ready !== 'boolean') errors.push('Snapshot ready must be boolean.');
  if (!Number.isFinite(snapshot?.generatedAt)) errors.push('Snapshot generatedAt must be numeric.');
  if (!snapshot?.player || typeof snapshot.player !== 'object') errors.push('Snapshot player record is required.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

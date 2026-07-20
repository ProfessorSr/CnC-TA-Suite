export const KNOWN_CLIENT_BUILDS = Object.freeze({
  'runtime-37af0914': Object.freeze({ status: 'verified', verifiedAt: '2026-07-20', adapterVersion: '1.0.0', notes: 'Initial stabilization baseline.' })
});

export function assessClientBuild({ normalized, runtimeFingerprint }, registry = KNOWN_CLIENT_BUILDS) {
  const key = normalized && normalized !== 'unknown' && registry[normalized] ? normalized : runtimeFingerprint;
  const record = registry[key] ?? null;
  return Object.freeze({
    key,
    known: Boolean(record),
    status: record?.status ?? 'unverified',
    migrationRequired: !record || record.status !== 'verified',
    record
  });
}

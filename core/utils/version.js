export const SUITE_VERSION = '1.0.0';

export function parseVersion(version) {
  const [major = 0, minor = 0, patch = 0] = String(version).split('.').map(Number);
  return { major, minor, patch };
}

export function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  return av.major - bv.major || av.minor - bv.minor || av.patch - bv.patch;
}

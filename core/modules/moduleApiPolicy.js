export const SUITE_MODULE_API_VERSION = '1.0.0';

function major(version) { return Number(String(version).split('.')[0]); }

export function apiCompatibility(requested, supported) {
  const compatible = major(requested) === major(supported);
  return Object.freeze({ requested, supported, compatible, deprecated: compatible && requested !== supported });
}

export function moduleApiCompatibility(apiVersion) {
  return apiCompatibility(apiVersion, SUITE_MODULE_API_VERSION);
}

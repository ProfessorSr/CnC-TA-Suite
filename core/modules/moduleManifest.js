const ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
import { apiCompatibility, moduleApiCompatibility } from './moduleApiPolicy.js';
import { HUB_API_VERSION } from '../game/hub/hubContract.js';

function asStringArray(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`Module manifest "${field}" must be an array of non-empty strings.`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}

export class ModuleManifest {
  static normalize(module) {
    if (!module || typeof module !== 'object') {
      throw new TypeError('Module must be an object.');
    }

    const source = module.manifest ?? module;
    const id = source.id ?? module.id;
    const name = source.name ?? module.name ?? id;
    const version = source.version ?? module.version ?? '0.0.0';
    const apiVersion = source.apiVersion ?? module.apiVersion ?? '1.1.0';
    const hubApiVersion = source.hubApiVersion ?? module.hubApiVersion ?? '1.0.0';
    const dependencies = asStringArray(source.dependencies ?? module.dependencies, 'dependencies');
    const permissions = asStringArray(source.permissions ?? module.permissions, 'permissions');
    const settings = source.settings ?? module.settingsSchema ?? {};
    const lastUpdated = source.lastUpdated ?? module.lastUpdated ?? '2026-07-20';
    const manual = source.manual ?? module.manual ?? null;

    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      throw new TypeError('Module manifest "id" must be a lowercase identifier using letters, numbers, dots, underscores, or hyphens.');
    }
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('Module manifest "name" must be a non-empty string.');
    }
    if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
      throw new TypeError(`Module "${id}" has an invalid semantic version: ${version}`);
    }
    if (typeof apiVersion !== 'string' || !VERSION_PATTERN.test(apiVersion)) {
      throw new TypeError(`Module "${id}" has an invalid API version: ${apiVersion}`);
    }
    if (typeof hubApiVersion !== 'string' || !VERSION_PATTERN.test(hubApiVersion)) {
      throw new TypeError(`Module "${id}" has an invalid Hub API version: ${hubApiVersion}`);
    }
    const suiteApiCompatibility = moduleApiCompatibility(apiVersion);
    if (!suiteApiCompatibility.compatible) {
      throw new TypeError(`Module "${id}" requires Suite API ${apiVersion}; this Suite supports ${suiteApiCompatibility.supported}.`);
    }
    const hubCompatibility = apiCompatibility(hubApiVersion, HUB_API_VERSION);
    if (!hubCompatibility.compatible) {
      throw new TypeError(`Module "${id}" requires Hub API ${hubApiVersion}; this Suite publishes ${HUB_API_VERSION}.`);
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new TypeError(`Module "${id}" settings must be an object.`);
    }
    if (typeof lastUpdated !== 'string' || !DATE_PATTERN.test(lastUpdated)) {
      throw new TypeError(`Module "${id}" has an invalid last-updated date: ${lastUpdated}`);
    }

    return Object.freeze({
      id,
      name: name.trim(),
      version,
      apiVersion,
      hubApiVersion,
      apiCompatibility: suiteApiCompatibility,
      hubCompatibility,
      author: typeof source.author === 'string' ? source.author.trim() : '',
      lastUpdated,
      description: typeof source.description === 'string' ? source.description.trim() : '',
      dependencies: Object.freeze(dependencies),
      permissions: Object.freeze(permissions),
      settings: Object.freeze({ ...settings }),
      manual: manual ? Object.freeze({ ...manual, id }) : null
    });
  }

  static validate(module) {
    try {
      return { valid: true, manifest: this.normalize(module), errors: [] };
    } catch (error) {
      return { valid: false, manifest: null, errors: [error.message] };
    }
  }
}

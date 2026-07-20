import { assessClientBuild } from './clientBuildRegistry.js';

function firstPresent(candidates) {
  return candidates.find(
    (value) => value !== undefined
      && value !== null
      && String(value).trim() !== ''
  );
}

function safeRead(getter) {
  try {
    return getter();
  } catch {
    return undefined;
  }
}

function hashRuntime(value) {
  let hash = 0x811c9dc5;

  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class VersionManager {
  constructor({ clientLibManager, logger }) {
    this.clientLibManager = clientLibManager;
    this.logger = logger;
  }

  getDocument() {
    return typeof document === 'undefined' ? null : document;
  }

  getWindow() {
    return typeof window === 'undefined' ? null : window;
  }

  detectExplicitVersion(server) {
    const page = this.getDocument();
    const host = this.getWindow();
    const mainData = this.clientLibManager.getMainData();

    const candidates = [
      this.clientLibManager.call(server, [
        'get_Version',
        'get_ServerVersion',
        'get_Revision',
        'get_BuildVersion',
        'get_BuildNumber'
      ]),
      this.clientLibManager.call(mainData, [
        'get_Version',
        'get_ClientVersion',
        'get_BuildVersion',
        'get_Revision'
      ]),
      safeRead(() => server?.Version),
      safeRead(() => server?.version),
      safeRead(() => server?.Revision),
      safeRead(() => server?.revision),
      safeRead(() => host?.ClientLib?.Version),
      safeRead(() => host?.ClientLib?.version),
      safeRead(() => host?.ClientLib?.Data?.MainData?.Version),
      safeRead(() => page?.querySelector('meta[name="version"]')?.content),
      safeRead(() => page?.querySelector('meta[name="build"]')?.content),
      safeRead(() => page?.documentElement?.dataset?.version),
      safeRead(() => page?.documentElement?.dataset?.build)
    ];

    return firstPresent(candidates);
  }

  createRuntimeFingerprint(server) {
    const page = this.getDocument();
    const host = this.getWindow();
    const root = this.clientLibManager.root;

    const qxVersion = firstPresent([
      safeRead(() => host?.qx?.core?.Environment?.get?.('qx.version')),
      safeRead(() => host?.qx?.version),
      safeRead(() => host?.qx?.$$environment?.['qx.version'])
    ]);

    const scriptSignals = safeRead(() =>
      [...(page?.scripts ?? [])]
        .map((script) => script.src)
        .filter(Boolean)
        .filter((src) => /clientlib|index\.aspx|load|runtime/i.test(src))
        .map((src) => src.split('?')[0].split('/').pop())
        .sort()
        .join(',')
    ) ?? '';

    const signals = [
      root ? 'clientlib:present' : 'clientlib:missing',
      `clientlib-keys:${Object.keys(root ?? {}).sort().join(',')}`,
      `server-type:${server?.constructor?.name ?? 'unknown'}`,
      `qx:${qxVersion ?? 'unknown'}`,
      `scripts:${scriptSignals}`
    ];

    return `runtime-${hashRuntime(signals.join('|'))}`;
  }

  detect() {
    const server = this.clientLibManager.getServer();
    const raw = this.detectExplicitVersion(server);
    const known = raw !== undefined && raw !== null;
    const normalized = known ? String(raw).trim() : 'unknown';
    const runtimeFingerprint = this.createRuntimeFingerprint(server);

    const detected = {
      raw: raw ?? null,
      normalized,
      known,
      source: known ? 'explicit' : 'runtime-fingerprint',
      runtimeFingerprint,
      display: known
        ? normalized
        : `Unknown (${runtimeFingerprint})`
    };
    const result = Object.freeze({ ...detected, support: assessClientBuild(detected) });

    this.logger.info('Game version detected.', result);
    return result;
  }
}

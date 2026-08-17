import { Module } from '../../core/interfaces/module.js';
import { RESEARCH_CATALOGS } from './research-catalog.js';

const CREDIT_ICON = 'a7d2f83e4fe41fc03990192217fd0330.png';
const ETA_ATTRIBUTE = 'data-cnc-ta-research-credit-eta';

export const researchEtaManifest = Object.freeze({
  id: 'research-eta',
  name: 'Research ETA',
  version: '0.5.0',
  apiVersion: '1.0.0',
  hubApiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Adds compact live credit ETAs to the game\'s native Research window.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['game', 'notifications', 'windows']),
  settings: Object.freeze({})
});

function plainText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseResourceAmount(value) {
  const text = plainText(value);
  const match = text.match(/(?:^|\s)([\d][\d.,\s]*)([KMBTQ])?(?:\s|$)/i);
  if (!match) return null;
  let digits = match[1].replace(/\s/g, '');
  const suffix = String(match[2] ?? '').toUpperCase();
  if (suffix) {
    const decimalAt = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
    digits = decimalAt >= 0
      ? `${digits.slice(0, decimalAt).replace(/[.,]/g, '')}.${digits.slice(decimalAt + 1).replace(/[.,]/g, '')}`
      : digits;
  } else digits = digits.replace(/[.,]/g, '');
  const number = Number(digits);
  if (!Number.isFinite(number)) return null;
  return number * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 }[suffix] ?? 1);
}

export function researchResourceProgress(current, required, growthPerHour = 0) {
  const have = Math.max(0, Number(current) || 0);
  const need = Math.max(0, Number(required) || 0);
  const remaining = Math.max(0, need - have);
  const rate = Math.max(0, Number(growthPerHour) || 0);
  return Object.freeze({
    current: have,
    required: need,
    remaining,
    ready: need > 0 && remaining === 0,
    etaSeconds: remaining === 0 ? 0 : rate > 0 ? Math.ceil((remaining / rate) * 3600) : null
  });
}

export function formatResearchCreditEta(seconds) {
  if (seconds === 0) return 'now';
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  let remaining = Math.max(60, Math.ceil(seconds));
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.max(1, Math.ceil(remaining / 60));
  if (days) return `${days}d${hours}h`;
  if (hours) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

export function normalizeResearchFaction(value, enumSources = []) {
  const numeric = Number(value);
  for (const source of enumSources) {
    for (const [name, enumValue] of Object.entries(source ?? {})) {
      if (Number(enumValue) !== numeric) continue;
      const normalized = String(name).replace(/[^a-z]/gi, '').toLowerCase();
      if (normalized === 'nod' || normalized.endsWith('nod') || normalized.startsWith('nod')) return 'nod';
      if (normalized === 'gdi' || normalized.endsWith('gdi') || normalized.startsWith('gdi')) return 'gdi';
    }
  }
  const text = String(value ?? '');
  if (/\bnod\b/i.test(text)) return 'nod';
  if (/\bgdi\b/i.test(text)) return 'gdi';
  if (numeric === 1) return 'gdi';
  if (numeric === 2) return 'nod';
  return 'unknown';
}

export class ResearchEtaModule extends Module {
  constructor() {
    super(researchEtaManifest);
    this.context = null;
    this.observer = null;
    this.refreshTimer = null;
  }

  resources() {
    const snapshot = this.context?.hub?.snapshot?.() ?? {};
    return {
      credits: Number(snapshot.player?.credits?.current ?? 0),
      research: Number(snapshot.player?.research?.current ?? 0),
      creditGrowthPerHour: Number(snapshot.player?.credits?.growthPerHour ?? 0)
    };
  }

  factionKind() {
    const services = this.context?.hub?.game?.services;
    const player = services?.tryGet?.('player')?.raw?.();
    const root = services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib ?? {};
    const value = player?.get_Faction?.() ?? player?.get_FactionType?.()
      ?? this.context?.hub?.snapshot?.()?.player?.faction;
    return normalizeResearchFaction(value, [
      root?.Base?.EFactionType,
      root?.Base?.EFaction,
      root?.Data?.EPlayerFaction,
      root?.Data?.PlayerFaction
    ]);
  }

  static parseAmount(value) { return parseResourceAmount(value); }

  researchCatalog() {
    return RESEARCH_CATALOGS[this.factionKind()] ?? RESEARCH_CATALOGS.gdi;
  }

  researchItem(key) {
    try {
      const services = this.context?.hub?.game?.services;
      const clientLib = services?.tryGet?.('clientLib');
      const player = services?.tryGet?.('player')?.raw?.();
      const base = clientLib?.root?.Base ?? globalThis.ClientLib?.Base;
      const enumValues = base?.ETechName ?? {};
      const normalized = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
      const enumKey = Object.keys(enumValues).find((name) => {
        const candidate = name.replace(/^Research_/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        return candidate === normalized || candidate.endsWith(normalized);
      });
      if (!enumKey || !player) return null;
      const faction = player.get_Faction?.() ?? player.get_FactionType?.();
      const techId = base.Tech.GetTechIdFromTechNameAndFaction(enumValues[enumKey], faction);
      const research = player.get_PlayerResearch?.() ?? player.get_Research?.();
      const item = research?.GetResearchItemFomMdbId?.(techId)
        ?? research?.GetResearchItemFromMdbId?.(techId) ?? null;
      return { item, research, techId, enumKey };
    } catch { return null; }
  }

  researchState(key) {
    const item = this.researchItem(key)?.item;
    let level = 0;
    for (const name of ['get_CurrentLevel', 'get_Level', 'get_CurrentLvl']) {
      try {
        const value = Number(item?.[name]?.());
        if (Number.isFinite(value)) { level = value; break; }
      } catch { /* Guarded game model. */ }
    }
    return { researched: level > 0, available: Boolean(item), level };
  }

  researchImage(key, fallback = null) {
    const item = this.researchItem(key)?.item;
    for (const target of [item, item?.get_MdbUnit?.(), item?.get_Unit?.(), item?.get_Data?.()]) {
      for (const method of ['get_Icon', 'get_IconPath', 'get_Image', 'get_ImagePath', 'get_Art']) {
        try {
          const value = target?.[method]?.();
          if (typeof value !== 'string' || !value.trim()) continue;
          const manager = globalThis.qx?.util?.ResourceManager?.getInstance?.();
          return manager?.toUri?.(value) ?? value;
        } catch { /* Try the next model field. */ }
      }
    }
    return fallback;
  }

  performResearch(key) {
    const record = this.researchItem(key);
    for (const [target, methods, argument] of [
      [record?.item, ['Research', 'research', 'ExecuteResearch'], undefined],
      [record?.research, ['ResearchItem', 'ResearchTech', 'StartResearch'], record?.techId]
    ]) {
      for (const method of methods) {
        try {
          if (typeof target?.[method] !== 'function') continue;
          argument === undefined ? target[method]() : target[method](argument);
          return true;
        } catch { /* Try the next supported game-model action. */ }
      }
    }
    return false;
  }

  refreshNativeResearchEtas() {
    const root = globalThis.document;
    if (!root?.querySelectorAll) return;
    const { credits, creditGrowthPerHour } = this.resources();
    for (const icon of root.querySelectorAll(`img[src*="${CREDIT_ICON}"]`)) {
      if (!icon.closest?.('.qx-tabview-pane')) continue;
      const width = Number(icon.getAttribute?.('width') ?? icon.width ?? 0);
      const height = Number(icon.getAttribute?.('height') ?? icon.height ?? 0);
      if (width !== 23 || height !== 21) continue;
      const row = icon.parentElement;
      const amount = row?.querySelector?.('span');
      if (!row || !amount) continue;
      row.style.whiteSpace = 'nowrap';
      const required = parseResourceAmount(amount.textContent);
      if (required == null) continue;
      const progress = researchResourceProgress(credits, required, creditGrowthPerHour);
      const text = formatResearchCreditEta(progress.etaSeconds);
      let eta = row.querySelector?.(`[${ETA_ATTRIBUTE}]`);
      if (!eta) {
        eta = root.createElement('span');
        eta.setAttribute(ETA_ATTRIBUTE, '');
        eta.style.cssText = 'margin-left:2px;font-size:8px;font-weight:normal;line-height:21px;vertical-align:middle;color:#3d3d3d;white-space:nowrap;';
        amount.insertAdjacentElement('afterend', eta);
      }
      if (eta.textContent !== text) eta.textContent = text;
    }
  }

  startNativeResearchEtas() {
    this.stopNativeResearchEtas();
    this.refreshNativeResearchEtas();
    const Observer = globalThis.MutationObserver;
    if (Observer && globalThis.document?.body) {
      let queued = false;
      this.observer = new Observer(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          this.refreshNativeResearchEtas();
        });
      });
      this.observer.observe(globalThis.document.body, { childList: true, subtree: true });
    }
    this.refreshTimer = globalThis.setInterval?.(() => this.refreshNativeResearchEtas(), 5000) ?? null;
  }

  stopNativeResearchEtas() {
    this.observer?.disconnect?.();
    this.observer = null;
    if (this.refreshTimer != null) globalThis.clearInterval?.(this.refreshTimer);
    this.refreshTimer = null;
    globalThis.document?.querySelectorAll?.(`[${ETA_ATTRIBUTE}]`)?.forEach?.((node) => node.remove());
  }

  async enable(context) {
    this.context = context;
    this.context?.windows?.close?.('research-eta');
    this.startNativeResearchEtas();
  }

  async open(context = this.context) {
    this.context = context;
    this.refreshNativeResearchEtas();
    return null;
  }

  async disable() {
    this.stopNativeResearchEtas();
    this.context?.windows?.close?.('research-eta');
    this.context = null;
  }

  async destroy() { await this.disable(); }
}

export default ResearchEtaModule;

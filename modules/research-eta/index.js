import { Module } from '../../core/interfaces/module.js';
import { ResearchEtaWindow } from './research-eta-window.js';

export const researchEtaManifest = Object.freeze({
  id: 'research-eta',
  name: 'Research ETA',
  version: '0.2.0',
  apiVersion: '1.0.0',
  hubApiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Adds current resource progress and credit accumulation time to native Research items.',
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
    const lastComma = digits.lastIndexOf(',');
    const lastDot = digits.lastIndexOf('.');
    const decimalAt = Math.max(lastComma, lastDot);
    digits = decimalAt >= 0
      ? `${digits.slice(0, decimalAt).replace(/[.,]/g, '')}.${digits.slice(decimalAt + 1).replace(/[.,]/g, '')}`
      : digits;
  } else {
    digits = digits.replace(/[.,]/g, '');
  }
  const number = Number(digits);
  if (!Number.isFinite(number)) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 }[suffix] ?? 1;
  return number * multiplier;
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
  // Current ClientLib worlds use 1 for GDI and 2 for NOD. Enum discovery
  // above remains authoritative when a future build publishes named values.
  if (numeric === 1) return 'gdi';
  if (numeric === 2) return 'nod';
  return 'unknown';
}

function compact(value) {
  const number = Number(value) || 0;
  for (const [size, suffix] of [[1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(number) < size) continue;
    return `${(number / size).toFixed(number >= size * 100 ? 0 : 1).replace(/\.0$/, '')}${suffix}`;
  }
  return Math.round(number).toLocaleString();
}

function duration(seconds) {
  if (seconds == null) return 'ETA unavailable';
  if (seconds <= 0) return 'Ready';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function shortDuration(seconds) {
  if (seconds == null) return '?';
  if (seconds <= 0) return '✓';
  if (seconds >= 86400) return `${Math.ceil(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`;
  return `${Math.max(1, Math.ceil(seconds / 60))}m`;
}

function children(widget) {
  try { return widget?.getChildren?.() ?? []; } catch { return []; }
}

function descendants(widget) {
  const result = [];
  const queue = [...children(widget)];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    result.push(current);
    queue.push(...children(current));
  }
  return result;
}

function widgetText(widget) {
  try { return plainText(widget?.getValue?.() ?? widget?.getLabel?.() ?? ''); }
  catch { return ''; }
}

function widgetSource(widget) {
  try {
    return String(widget?.getSource?.() ?? widget?.getIcon?.() ?? widget?.getToolTipText?.() ?? '').toLowerCase();
  } catch { return ''; }
}

function resourceKind(label) {
  let parent = label?.getLayoutParent?.();
  for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.getLayoutParent?.()) {
    const siblings = children(parent).filter((widget) => widget !== label && !widget?.__suiteResearchEta);
    const evidence = siblings.map((widget) => `${widgetSource(widget)} ${widgetText(widget)}`).join(' ').toLowerCase();
    const credits = /(?:icn_res_dollar|\bcredits?\b|\bgold\b)/.test(evidence);
    const research = /(?:icn_res_research|research\s*points?|\brp\b)/.test(evidence);
    if (credits !== research) return { kind: credits ? 'credits' : 'research', parent };
  }
  return null;
}

function widgetTop(widget) {
  try {
    const location = widget?.getContentLocation?.();
    if (Number.isFinite(Number(location?.top))) return Number(location.top);
    return Number(widget?.getBounds?.()?.top ?? 0);
  } catch { return 0; }
}

function researchCostPairs(overlay) {
  const pairs = [];
  const claimed = new Set();
  const numericLabels = descendants(overlay).filter((widget) =>
    !widget?.__suiteResearchEtaCost
    && typeof widget?.getValue === 'function'
    && parseResourceAmount(widget.getValue?.()) > 0
  );
  for (const candidate of numericLabels) {
    if (claimed.has(candidate)) continue;
    let parent = candidate?.getLayoutParent?.();
    for (let depth = 0; parent && depth < 7; depth += 1, parent = parent.getLayoutParent?.()) {
      const subtree = descendants(parent);
      const hasCardAction = subtree.some((widget) => typeof widget?.execute === 'function');
      if (!hasCardAction) continue;
    const amounts = descendants(parent)
      .filter((widget) => !widget?.__suiteResearchEtaCost && typeof widget?.getValue === 'function')
      .map((widget) => ({ widget, amount: parseResourceAmount(widget.getValue?.()), top: widgetTop(widget) }))
      .filter((entry) => entry.amount > 0)
      .sort((left, right) => left.top - right.top);
    // The native research card shown by current game builds has exactly two
      // resource rows: Credits above RP. Requiring exactly two prevents the
      // account totals in the overlay header from being mistaken for a card.
      if (amounts.length !== 2 || amounts[0].top === amounts[1].top) continue;
      pairs.push(amounts);
      claimed.add(amounts[0].widget);
      claimed.add(amounts[1].widget);
      break;
    }
  }
  return pairs;
}

export class ResearchEtaModule extends Module {
  constructor() {
    super(researchEtaManifest);
    this.context = null;
    this.timer = null;
    this.costLabels = new Map();
    this.window = null;
  }

  overlay() {
    const direct = globalThis.webfrontend?.gui?.research?.ResearchOverlay?.getInstance?.();
    if (direct) return direct;
    const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
    return Object.values(registry).find((widget) =>
      /ResearchOverlay/i.test(String(widget?.classname ?? widget?.constructor?.classname ?? widget?.constructor?.name ?? ''))
    ) ?? null;
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
    const record = this.researchItem(key);
    const item = record?.item;
    let level = 0;
    for (const name of ['get_CurrentLevel', 'get_Level', 'get_CurrentLvl']) {
      try {
        const value = Number(item?.[name]?.());
        if (Number.isFinite(value)) { level = value; break; }
      } catch { /* Guarded game model. */ }
    }
    return { researched: level > 0, available: Boolean(item), level };
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
        } catch { /* Try the next supported research action. */ }
      }
    }
    return false;
  }

  async prepareNative(category = 'OFFENSE') {
    let overlay = this.overlay();
    if (!overlay || overlay.isDisposed?.()) {
      const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
      const researchButton = Object.values(registry).find((widget) =>
        /^Research$/i.test(String(widget?.getLabel?.() ?? '').replace(/^\(\d+\)\s*/, '').trim())
        && typeof widget?.execute === 'function'
      );
      researchButton?.execute?.();
      await new Promise((resolve) => setTimeout(resolve, 150));
      overlay = this.overlay();
    } else overlay.show?.();
    if (!overlay) throw new Error('The native Research page is unavailable.');
    const categoryButton = descendants(overlay).find((widget) =>
      String(widget?.getLabel?.() ?? '').trim().toUpperCase() === String(category).toUpperCase()
      && typeof widget?.execute === 'function'
    );
    categoryButton?.execute?.();
    await new Promise((resolve) => setTimeout(resolve, 80));
    return overlay;
  }

  decorateCost(label, required, kind, available) {
    // Keep the native RP row unchanged. The requested contextual addition
    // belongs only to the Credits requirement row.
    if (!label || kind !== 'credits' || !(required > 0)) return false;
    let record = this.costLabels.get(label);
    if (!record) {
      record = { original: label.getValue?.(), required, kind, updating: false, display: null, listenerId: null };
      this.costLabels.set(label, record);
      label.__suiteResearchEtaCost = kind;
      record.listenerId = label.addListener?.('changeValue', (event) => {
        if (record.updating) return;
        const nativeValue = event.getData?.();
        if (nativeValue === record.display) return;
        const nativeRequired = parseResourceAmount(nativeValue);
        if (!(nativeRequired > 0)) return;
        record.original = nativeValue;
        record.required = nativeRequired;
        // Qooxdoo dispatches changeValue synchronously. Re-applying here means
        // the native-only value never survives to the next paint, eliminating
        // the alternating/flashing display.
        this.decorateCost(label, nativeRequired, kind, this.resources());
      });
    }
    const current = kind === 'credits' ? available.credits : available.research;
    const progress = researchResourceProgress(
      current,
      required,
      kind === 'credits' ? available.creditGrowthPerHour : 0
    );
    // Add remaining Credits and ETA on the left while preserving the exact
    // native Credit requirement at the far right of the same native label.
    record.display = `Need ${compact(progress.remaining)} · ${shortDuration(progress.etaSeconds)} · ${plainText(record.original)}`;
    record.updating = true;
    try { label.setValue?.(record.display); }
    finally { record.updating = false; }
    label.setToolTipText?.(
      `${kind === 'credits' ? 'Credits' : 'Research Points'}: ${Math.round(progress.current).toLocaleString()} gained / `
      + `${Math.round(progress.required).toLocaleString()} needed · ${Math.round(progress.remaining).toLocaleString()} remaining`
      + (kind === 'credits' ? ` · ${duration(progress.etaSeconds)}` : '')
    );
    return true;
  }

  refresh() {
    const overlay = this.overlay();
    if (!overlay || overlay.isDisposed?.() || overlay.getVisibility?.() === 'excluded') return;
    const available = this.resources();
    for (const [label, record] of [...this.costLabels]) {
      if (label.isDisposed?.()) {
        this.costLabels.delete(label);
        continue;
      }
      this.decorateCost(label, record.required, record.kind, available);
    }
    // Pair costs within each individual card. The upper value is always the
    // native Credit requirement; the lower RP requirement remains untouched.
    for (const [credits] of researchCostPairs(overlay)) {
      this.decorateCost(credits.widget, credits.amount, 'credits', available);
    }
  }

  async enable(context) {
    this.context = context;
    this.window = new ResearchEtaWindow({ context, owner: this });
  }

  async open(context = this.context) {
    if (!this.window) this.window = new ResearchEtaWindow({ context, owner: this });
    return this.window.open();
  }

  async disable() {
    clearInterval(this.timer);
    this.timer = null;
    for (const [label, record] of this.costLabels) {
      try {
        if (!label.isDisposed?.()) {
          if (record.listenerId) label.removeListenerById?.(record.listenerId);
          label.setValue?.(record.original);
        }
        delete label.__suiteResearchEtaCost;
      } catch { /* Native Research rows may already be disposed. */ }
    }
    this.costLabels.clear();
    this.context?.windows?.close?.('research-eta');
    this.window = null;
    this.context = null;
  }

  async destroy() { await this.disable(); }
}

export default ResearchEtaModule;

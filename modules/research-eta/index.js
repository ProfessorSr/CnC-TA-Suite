import { Module } from '../../core/interfaces/module.js';
import { RESEARCH_CATALOGS } from './research-catalog.js';
import { buildResearchTrackerWindow } from './research-tracker-window.js';

const CREDIT_ICON = 'a7d2f83e4fe41fc03990192217fd0330.png';
const RESEARCH_ICON = 'b868f25a38496e4e29d7a6f74352538c.png';
const ETA_ATTRIBUTE = 'data-cnc-ta-research-credit-eta';
const TRACK_ATTRIBUTE = 'data-cnc-ta-research-track';
const TRACKED_RESEARCH_KEY = 'module:research-eta:tracked-item:v1';
const TRACKER_OPEN_KEY = 'module:research-eta:tracker-open:v1';

export const researchEtaManifest = Object.freeze({
  id: 'research-eta',
  name: 'Research ETA',
  version: '0.6.1',
  apiVersion: '1.0.0',
  hubApiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Adds live Credit ETAs and a selected-item progress tracker to the native Research window.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['game', 'notifications', 'storage', 'windows']),
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

export function researchCatalogItems(catalog) {
  const found = [];
  for (const pages of Object.values(catalog ?? {})) {
    for (const page of pages ?? []) for (const entry of page ?? []) {
      found.push(entry);
      if (entry?.upgrade) found.push(entry.upgrade);
    }
  }
  return found;
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
    this.trackedResearch = null;
    this.trackerOpen = false;
    this.closingForLifecycle = false;
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

  matchResearchItem(text) {
    const normalized = plainText(text).toUpperCase();
    return researchCatalogItems(this.researchCatalog())
      .filter((item) => normalized.includes(String(item.name).toUpperCase()))
      .sort((left, right) => right.name.length - left.name.length)[0] ?? null;
  }

  async setTrackedResearch(item) {
    this.trackedResearch = item ? {
      key: String(item.key), name: String(item.name),
      credits: Number(item.credits) || 0, research: Number(item.research) || 0
    } : null;
    await this.context?.storage?.set?.(TRACKED_RESEARCH_KEY, this.trackedResearch);
    this.refreshNativeResearchEtas();
    this.trackerController?.refresh?.();
  }

  async loadTrackedResearch() {
    const [stored, open] = await Promise.all([
      this.context?.storage?.get?.(TRACKED_RESEARCH_KEY, null),
      this.context?.storage?.get?.(TRACKER_OPEN_KEY, false)
    ]);
    if (stored?.key && stored?.name) this.trackedResearch = stored;
    this.trackerOpen = Boolean(open);
  }

  async setTrackerOpen(value) {
    this.trackerOpen = Boolean(value);
    await this.context?.storage?.set?.(TRACKER_OPEN_KEY, this.trackerOpen);
  }

  trackerSnapshot() {
    return { item: this.trackedResearch, resources: this.resources(), updatedAt: Date.now() };
  }

  async openTracker() {
    const built = buildResearchTrackerWindow(this.context, this);
    this.trackerController = built.controller;
    const record = await this.context.windows.open({
      id: 'research-eta', title: 'Research Tracker', content: built.content,
      x: 410, y: 80, width: 360, height: 330,
      resizable: true, singleton: true, showMinimize: true
    });
    await this.setTrackerOpen(true);
    if (!record.researchTrackerPersistenceInstalled) {
      record.researchTrackerPersistenceInstalled = true;
      record.window?.addListener?.('close', () => {
        if (this.closingForLifecycle) return;
        void this.setTrackerOpen(false).catch((error) =>
          this.context?.logger?.warn?.('Research Tracker visibility could not be saved.', error));
      });
    }
    built.controller.refresh();
    return record;
  }

  nativeResearchCard(icon) {
    const pane = icon?.closest?.('.qx-tabview-pane');
    const origin = icon?.getBoundingClientRect?.();
    if (!pane || !origin) return null;
    const catalog = researchCatalogItems(this.researchCatalog());
    let best = null;
    for (const node of pane.querySelectorAll?.('span,div') ?? []) {
      const text = plainText(node.textContent).toUpperCase();
      if (!text || text.length > 80) continue;
      const item = catalog
        .filter((candidate) => text === String(candidate.name).toUpperCase()
          || text.startsWith(`${String(candidate.name).toUpperCase()} `))
        .sort((left, right) => right.name.length - left.name.length)[0];
      if (!item) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect) continue;
      const dx = Math.abs((rect.left + rect.width / 2) - (origin.left + origin.width / 2));
      const above = origin.top - rect.top;
      if (dx > 130 || above < -20 || above > 190) continue;
      const score = dx + Math.abs(above) * 0.35;
      if (!best || score < best.score) best = { item, score };
    }
    const researchIcons = [...(pane.querySelectorAll?.(`img[src*="${RESEARCH_ICON}"]`) ?? [])];
    const researchIcon = researchIcons.sort((left, right) => {
      const a = left.getBoundingClientRect?.() ?? {};
      const b = right.getBoundingClientRect?.() ?? {};
      const distance = (rect) => Math.abs((rect.left ?? 0) - origin.left)
        + Math.abs((rect.top ?? 0) - origin.top);
      return distance(a) - distance(b);
    })[0] ?? null;
    return best ? { node: pane, item: best.item, researchIcon } : null;
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
    for (const control of root.querySelectorAll(`[${TRACK_ATTRIBUTE}]`)) {
      if (!control.suiteOwnerIcon?.isConnected) control.remove();
    }
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
        eta.style.cssText = 'margin-left:2px;font-size:9px;font-weight:normal;line-height:21px;vertical-align:middle;color:#3d3d3d;white-space:nowrap;';
        amount.insertAdjacentElement('afterend', eta);
      }
      if (eta.textContent !== text) eta.textContent = text;
      const card = this.nativeResearchCard(icon);
      if (!card) continue;
      const researchAmount = card.researchIcon?.parentElement?.querySelector?.('span');
      const tracked = {
        key: card.item.key,
        name: card.item.name,
        credits: required,
        research: parseResourceAmount(researchAmount?.textContent) ?? Number(card.item.rp) ?? 0
      };
      let control = icon.suiteResearchTrackControl;
      if (control && !control.isConnected) control = null;
      if (!control) {
        control = root.createElement('label');
        control.setAttribute(TRACK_ATTRIBUTE, '');
        control.title = 'Track this item and open Research Tracker';
        control.setAttribute('aria-label', 'Track this research item');
        control.style.cssText = 'position:fixed;z-index:2147483647;display:flex;width:14px;height:14px;align-items:center;justify-content:center;pointer-events:auto;background:rgba(220,225,226,.94);border-radius:2px;box-sizing:border-box;cursor:pointer;';
        const checkbox = root.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'position:relative;z-index:2147483647;display:block;pointer-events:auto;width:12px;height:12px;margin:0;cursor:pointer;';
        control.append(checkbox);
        control.suiteOwnerIcon = icon;
        icon.suiteResearchTrackControl = control;
        root.body.append(control);
        for (const eventName of ['pointerdown', 'mousedown']) {
          control.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
          });
        }
        control.addEventListener('pointerup', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const checked = String(this.trackedResearch?.key ?? '')
            !== String(control.suiteTrackedResearch?.key ?? '');
          checkbox.checked = checked;
          void this.setTrackedResearch(checked ? control.suiteTrackedResearch : null)
            .then(() => checked ? this.openTracker() : null)
            .catch((error) => this.context?.logger?.warn?.('Research tracking selection failed.', error));
        });
        control.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        });
      }
      const iconRect = icon.getBoundingClientRect?.();
      if (iconRect) {
        control.style.left = `${Math.round(iconRect.left + 88)}px`;
        control.style.top = `${Math.round(iconRect.top + 3)}px`;
        control.style.display = iconRect.width > 0 && iconRect.height > 0 ? 'flex' : 'none';
      }
      control.suiteTrackedResearch = tracked;
      const checkbox = control.querySelector?.('input');
      if (checkbox) checkbox.checked = String(this.trackedResearch?.key ?? '') === String(tracked.key);
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
    // The native Research window can move without changing its DOM. Refresh
    // overlay positions once per second so checkboxes stay anchored to cards.
    this.refreshTimer = globalThis.setInterval?.(() => this.refreshNativeResearchEtas(), 1000) ?? null;
  }

  stopNativeResearchEtas() {
    this.observer?.disconnect?.();
    this.observer = null;
    if (this.refreshTimer != null) globalThis.clearInterval?.(this.refreshTimer);
    this.refreshTimer = null;
    globalThis.document?.querySelectorAll?.(`[${ETA_ATTRIBUTE}],[${TRACK_ATTRIBUTE}]`)?.forEach?.((node) => node.remove());
  }

  async enable(context) {
    this.context = context;
    this.closingForLifecycle = true;
    this.context?.windows?.close?.('research-eta');
    this.closingForLifecycle = false;
    await this.loadTrackedResearch();
    this.startNativeResearchEtas();
    if (this.trackedResearch && this.trackerOpen) {
      try { await this.openTracker(); }
      catch (error) { this.context?.logger?.warn?.('Research Tracker could not be restored.', error); }
    }
  }

  async open(context = this.context) {
    this.context = context;
    this.refreshNativeResearchEtas();
    return this.openTracker();
  }

  async disable() {
    this.stopNativeResearchEtas();
    this.closingForLifecycle = true;
    this.context?.windows?.close?.('research-eta');
    this.closingForLifecycle = false;
    this.trackerController = null;
    this.context = null;
  }

  async destroy() { await this.disable(); }
}

export default ResearchEtaModule;

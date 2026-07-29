import { Module } from '../../core/interfaces/module.js';
import { BattleSimulator } from './battle-simulator.js';
import { CombatStats } from './combat-stats.js';
import { WarRoomHub } from './war-room-hub.js';
import { WarRoomWindow } from './war-room-window.js';
import { AttackControlsPalette } from './attack-controls-palette.js';
import { AttackSetupCompactLayout } from './attack-setup-compact-layout.js';
import { FormationTargetHighlighter } from './formation-target-highlighter.js';
import {
  DEFAULT_WAR_ROOM_COMPANION_SETTINGS,
  WAR_ROOM_COMPANION_SETTINGS_KEY,
  normalizeWarRoomCompanionSettings
} from './companion-settings.js';

export const warRoomManifest = Object.freeze({
  id: 'war-room',
  name: 'War Room',
  version: '0.8.0',
  apiVersion: '1.0.0',
  hubApiVersion: '1.0.0',
  author: 'ProfessorSr',
  lastUpdated: '2026-07-22',
  description: 'Unified attack planning, native simulation, reports, army, target, and combat analysis.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze([
    'events', 'game', 'hooks', 'modules', 'notifications', 'storage', 'windows'
  ]),
  settings: Object.freeze({})
});

export class WarRoomModule extends Module {
  constructor() {
    super(warRoomManifest);
    // Preserve metadata fields that predate the base Module constructor but
    // are part of the current normalized manifest contract.
    this.manifest = warRoomManifest;
    this.title = 'War Room';
    this.category = 'Combat';
    this.settingsKey = 'warRoom';
    this.window = null;
    this.context = null;
    this.attackSetupActive = false;
    this.attackTargetId = null;
    this.unsubscribeTick = null;
    this.unsubscribeSelection = null;
    this.palette = null;
    this.compactLayout = null;
    this.highlighter = null;
    this.companionSettings = { ...DEFAULT_WAR_ROOM_COMPANION_SETTINGS };
    this.unsubscribeCompanionSettings = null;
    this.unsubscribeNativeSimulationRequest = null;
    this.nativeSimulationPanel = null;
  }

  findNativeSimulationResultsPanel() {
    if (this.nativeSimulationPanel && !this.nativeSimulationPanel.isDisposed?.()) {
      let outer = this.nativeSimulationPanel;
      for (
        let candidate = outer.getLayoutParent?.();
        candidate;
        candidate = candidate.getLayoutParent?.()
      ) {
        const width = Number(candidate.getWidth?.() ?? candidate.getBounds?.()?.width ?? 0);
        const height = Number(candidate.getHeight?.() ?? candidate.getBounds?.()?.height ?? 0);
        if (width >= 175 && width <= 240 && height >= 780) outer = candidate;
      }
      this.nativeSimulationPanel = outer;
      return outer;
    }
    const qx = globalThis.qx;
    const Widget = qx?.ui?.core?.Widget;
    const nativeTops = [...(globalThis.document?.querySelectorAll?.('.qx-pane-sim-top') ?? [])];
    for (const nativeTop of nativeTops) {
      if (nativeTop.closest?.('[data-cnc-ta-war-room-history-window]')) continue;
      let element = nativeTop;
      let outerWidget = null;
      for (let depth = 0; element && depth < 12; depth += 1, element = element.parentElement) {
        const bounds = element.getBoundingClientRect?.();
        const width = Number(bounds?.width ?? Number.parseInt(element.style?.width ?? '', 10));
        const height = Number(bounds?.height ?? Number.parseInt(element.style?.height ?? '', 10));
        if (width < 175 || width > 240 || height < 780) continue;
        const direct = Widget?.getWidgetByElement?.(element);
        if (direct) outerWidget = direct;
      }
      if (outerWidget) {
        this.nativeSimulationPanel = outerWidget;
        return outerWidget;
      }
    }
    const registry = qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
    const widgets = Object.values(registry);
    const tops = widgets.filter((widget) => {
      if (!widget || widget.isDisposed?.()) return false;
      const decorator = String(widget.getDecorator?.() ?? '');
      const element = widget.getContentElement?.().getDomElement?.();
      if (element?.closest?.('[data-cnc-ta-war-room-history-window]')) return false;
      return decorator === 'pane-sim-top' || element?.classList?.contains?.('qx-pane-sim-top');
    });
    for (const top of tops) {
      let candidate = top;
      let outerWidget = null;
      for (let depth = 0; candidate && depth < 12; depth += 1) {
        const width = Number(candidate.getWidth?.() ?? candidate.getBounds?.()?.width ?? 0);
        const height = Number(candidate.getHeight?.() ?? candidate.getBounds?.()?.height ?? 0);
        if (width >= 175 && width <= 240 && height >= 780) {
          outerWidget = candidate;
        }
        candidate = candidate.getLayoutParent?.() ?? null;
      }
      if (outerWidget) {
        this.nativeSimulationPanel = outerWidget;
        return outerWidget;
      }
    }
    return null;
  }

  openNativeSimulationResults() {
    const reveal = () => {
      const panel = this.findNativeSimulationResultsPanel();
      if (!panel) return false;
      panel.show?.();
      panel.open?.();
      panel.setVisibility?.('visible');
      panel.setZIndex?.(100002);
      return true;
    };

    if (reveal()) return true;
    for (const delay of [0, 100, 300, 750]) globalThis.setTimeout(reveal, delay);
    return false;
  }

  async toggleNativeSimulationResults() {
    const panel = this.findNativeSimulationResultsPanel();
    if (!panel) {
      const api = globalThis.ClientLib?.API?.Battleground?.GetInstance?.();
      if (typeof api?.SimulateBattle !== 'function') {
        throw new Error('The native game simulator is unavailable.');
      }
      // Opening the native panel does not require consuming its report event.
      // Some builds display the result normally but publish no callback data.
      api.SimulateBattle();
      this.openNativeSimulationResults();
      return true;
    }
    if (panel.isVisible?.()) {
      panel.exclude?.();
      return false;
    }
    panel.show?.();
    panel.open?.();
    panel.setVisibility?.('visible');
    panel.setZIndex?.(100002);
    return true;
  }

  async enable(context) {
    this.context = context;
    this.companionSettings = normalizeWarRoomCompanionSettings(
      await context.storage?.get?.(WAR_ROOM_COMPANION_SETTINGS_KEY, DEFAULT_WAR_ROOM_COMPANION_SETTINGS)
    );
    this.unsubscribeCompanionSettings?.();
    this.unsubscribeCompanionSettings = context.eventBus?.on?.('war-room:companion-settings-changed', (settings) => {
      this.companionSettings = normalizeWarRoomCompanionSettings(settings);
      if (!this.companionSettings.formationControls) this.palette?.setVisible?.(false);
    });
    this.unsubscribeNativeSimulationRequest?.();
    this.unsubscribeNativeSimulationRequest = context.eventBus?.on?.(
      'war-room:show-native-simulation',
      () => this.openNativeSimulationResults()
    );
    const sharedHub = new WarRoomHub(context);
    this.highlighter = new FormationTargetHighlighter({ context, hub: sharedHub });
    this.highlighter.install();
    void this.highlighter.refresh().catch((error) => {
      context.logger?.warn?.('Saved-formation map highlights could not be loaded.', error);
    });
    this.unsubscribeTick?.();
    this.unsubscribeTick = context.eventBus?.on?.('game:tick', () => {
      const hub = this.window?.hub ?? this.palette?.hub ?? new WarRoomHub(context);
      const snapshot = hub.snapshot();
      this.highlighter?.setAttackerId?.(snapshot.attacker?.id);
      const active = hub.isAttackSetupOpen(snapshot);
      this.palette ??= new AttackControlsPalette({
        context,
        hub,
        onSimulate: () => {
          this.ensureInitialized(context);
          this.openNativeSimulationResults();
          return this.window?.captureCurrentFormation?.();
        },
        onOpenPlanner: () => {
          this.ensureInitialized(context);
          this.window?.initializeCompanions?.();
          this.window?.toggleCompanion?.('planner');
        },
        onOpenResults: () => {
          this.ensureInitialized(context);
          return this.toggleNativeSimulationResults();
        }
      });
      this.compactLayout ??= new AttackSetupCompactLayout({ context, hub });
      this.palette.setVisible(active && this.companionSettings.formationControls);
      if (active) {
        this.compactLayout.install();
        this.compactLayout.enforce();
      }
      else this.compactLayout.uninstall();
      const ready = Boolean(active && snapshot.target?.id && snapshot.attacker?.id && snapshot.units?.length);
      const targetId = ready ? String(snapshot.target.id) : null;
      if (ready && (!this.attackSetupActive || targetId !== this.attackTargetId)) {
        this.ensureInitialized(context);
        this.window?.initializeCompanions?.();
        this.window?.setAttackCompanionsVisible?.(true);
      } else if (!ready && this.attackSetupActive) {
        this.window?.setAttackCompanionsVisible?.(false);
      }
      this.attackSetupActive = ready;
      this.attackTargetId = targetId;
      this.highlighter?.install?.();
    });
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = context.events?.on?.('game:selection-changed', () => {
      this.palette?.handleSelectionChanged?.();
    });
    context.events?.on?.('war-room:formation-presets-changed', () => {
      void this.highlighter?.refresh?.().catch((error) => {
        context.logger?.warn?.('Saved-formation map highlights could not be refreshed.', error);
      });
    });
  }

  ensureInitialized(context) {
    if (this.window) return;
    const hub = new WarRoomHub(context);
    const stats = new CombatStats(context.storage);
    void stats.load().then(() => this.window?.refreshAll?.()).catch((error) => {
      context.logger?.warn?.('War Room combat history failed to load.', error);
    });
    this.window = new WarRoomWindow({
      context,
      hub,
      stats,
      simulator: new BattleSimulator(hub)
    });
    this.window.initializeCompanions?.();
  }

  async open(context, page = null) {
    this.ensureInitialized(context);
    const record = await this.window.open();
    if (page) this.window.showPage?.(page);
    return record;
  }

  async disable(context) {
    this.unsubscribeTick?.();
    this.unsubscribeTick = null;
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;
    this.unsubscribeCompanionSettings?.();
    this.unsubscribeCompanionSettings = null;
    this.unsubscribeNativeSimulationRequest?.();
    this.unsubscribeNativeSimulationRequest = null;
    this.palette?.destroy?.();
    this.palette = null;
    this.compactLayout?.uninstall?.();
    this.compactLayout = null;
    this.highlighter?.destroy?.();
    this.highlighter = null;
    context?.windows?.close?.('war-room');
    this.window?.destroy?.();
    this.window = null;
    this.context = null;
    this.nativeSimulationPanel = null;
    this.attackSetupActive = false;
    this.attackTargetId = null;
    this.companionSettings = { ...DEFAULT_WAR_ROOM_COMPANION_SETTINGS };
  }

  async destroy(context) {
    await this.disable(context);
  }
}

export default WarRoomModule;

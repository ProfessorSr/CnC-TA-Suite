import { WarRoomCalculator } from '../war-room/war-room-calculator.js';
import {
  greedyCandidate, orderWeakestFirst, scoreMaximumResearch, stageCells, totalGreedySimulations
} from './super-simulator-optimizer.js';

const wait = (milliseconds) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
const unitId = (unit) => String(unit.entityId ?? unit.id ?? unit.mdbId);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const duration = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600), minutes = Math.floor((value % 3600) / 60), remainder = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
};
const remaining = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;

export class SuperSimulatorWindow {
  constructor({ context, hub }) {
    this.context = context;
    this.hub = hub;
    this.root = null;
    this.sequence = 0;
    this.running = false;
    this.paused = false;
    this.viewRequested = false;
    this.original = null;
    this.finalUnits = null;
  }

  build() {
    if (this.root && !this.root.isDisposed?.()) return this.root;
    const qx = globalThis.qx;
    const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(8)).set({ padding: 10 });
    root.add(new qx.ui.basic.Label(
      '<b>Greedy one-troop optimizer</b><br>Hides all troops, tests every legal cell for the lowest troop, locks its best cell, then repeats for the next troop.'
    ).set({ rich: true, wrap: true }));
    const controls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    controls.add(new qx.ui.basic.Label('Goal: Maximum Research Points (RP)').set({ font: 'bold' }), { flex: 1 });
    this.startButton = new qx.ui.form.Button('Start');
    this.startButton.addListener('execute', () => this.running ? this.stop() : void this.start());
    controls.add(this.startButton);
    this.pauseButton = new qx.ui.form.Button('Pause').set({ enabled: false });
    this.pauseButton.addListener('execute', () => this.togglePause());
    controls.add(this.pauseButton);
    this.viewButton = new qx.ui.form.Button('View Sim').set({ enabled: false });
    this.viewButton.addListener('execute', () => this.requestView());
    controls.add(this.viewButton);
    this.restoreButton = new qx.ui.form.Button('Restore Original').set({ enabled: false });
    this.restoreButton.addListener('execute', () => this.restore());
    controls.add(this.restoreButton);
    root.add(controls);
    this.summary = new qx.ui.basic.Label('Open an attack setup to calculate the run.').set({ rich: true, wrap: true, backgroundColor: '#dce7ea', padding: 8 });
    root.add(this.summary);
    this.progress = new qx.ui.basic.Label('0%').set({
      textAlign: 'center', font: 'bold', height: 18,
      backgroundColor: '#dce7ea', textColor: '#145a70'
    });
    root.add(this.progress);
    const results = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    this.liveStats = new qx.ui.basic.Label(
      '<b>Current candidate</b><br><span style="color:#52636b">Run Super Simulator to see native battle statistics.</span>'
    ).set({ rich: true, wrap: true, selectable: true, padding: 8, width: 205, minWidth: 205,
      backgroundColor: '#d9ece1', textColor: '#17262d' });
    const liveScroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto', width: 220, minWidth: 220 });
    liveScroll.add(this.liveStats); results.add(liveScroll);
    this.bestStats = new qx.ui.basic.Label(
      '<b>Best so far</b><br><span style="color:#52636b">Waiting for the first completed simulation.</span>'
    ).set({ rich: true, wrap: true, selectable: true, padding: 8, width: 205, minWidth: 205,
      backgroundColor: '#d9ece1', textColor: '#17262d' });
    const bestScroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto', width: 220, minWidth: 220 });
    bestScroll.add(this.bestStats); results.add(bestScroll);
    this.activity = new qx.ui.basic.Label('<b>Super Simulator</b><br>Waiting.').set({
      rich: true, wrap: true, selectable: true, padding: 8,
      backgroundColor: '#d9ece1', textColor: '#17262d'
    });
    const activityScroll = new qx.ui.container.Scroll().set({ scrollbarX: 'off', scrollbarY: 'auto' });
    activityScroll.add(this.activity); results.add(activityScroll, { flex: 1 });
    root.add(results, { flex: 1 });
    this.root = root;
    this.refreshEstimate();
    return root;
  }

  setProgress(value) {
    const percent = Math.max(0, Math.min(100, Math.floor(Number(value) || 0)));
    this.progress?.setValue?.(`${percent}% complete`);
    this.progress?.setBackgroundColor?.(percent >= 100 ? '#b9dfc3' : '#dce7ea');
  }

  renderLiveStats(analysis) {
    if (!analysis || !this.liveStats) return;
    const defender = analysis.defenderBreakdown ?? {};
    const loot = analysis.lootResources ?? {};
    const repairs = analysis.repairTimeByGroup ?? {};
    const snapshot = this.hub.snapshot();
    const attacks = snapshot.attackEstimate ?? {};
    const fullRepairs = Number(attacks.fullyRepairableAttacks ?? Infinity);
    const repairLimit = Number.isFinite(fullRepairs)
      ? `${fullRepairs} with full repairs<br>(+1 not fully repairable)` : 'Not repair-time limited';
    const outcomeColor = /victory/i.test(String(analysis.outcome ?? '')) ? '#19733a' : '#b32323';
    this.liveStats.setValue(
      '<b>Current candidate</b><br><br>'
      + `<b>Duration:</b> ${duration(analysis.durationSeconds)}<br>`
      + `<b>Outcome:</b> <span style="color:${outcomeColor}"><b>${escapeHtml(analysis.outcome ?? 'Unknown')}</b></span><br><br>`
      + '<b>Defender</b><br>'
      + `<b>Target State:</b> ${remaining(analysis.defenderRemaining)}<br>`
      + `&nbsp;&nbsp;Structures: ${remaining(defender.structures?.remainingPercent)}<br>`
      + `&nbsp;&nbsp;Defense Units: ${remaining(defender.defense?.remainingPercent)}<br>`
      + `<span style="color:#d18800">CY</span> ${remaining(analysis.cyRemaining)}<br>`
      + `<span style="color:#d05050">DF</span> ${remaining(analysis.dfRemaining)}<br>`
      + `<span style="color:#438cca">HQ</span> ${remaining(analysis.defenseHqRemaining)}<br><br>`
      + '<b>Loot</b><br>'
      + `<span style="color:#0877ad">RP</span> <b>${Math.round(loot.research ?? 0).toLocaleString()}</b><br>`
      + `Crystal ${Math.round(loot.crystal ?? 0).toLocaleString()}<br>`
      + `Tiberium ${Math.round(loot.tiberium ?? 0).toLocaleString()}<br>`
      + `Credits ${Math.round(loot.credits ?? 0).toLocaleString()}<br>`
      + `<b>Total: ${Math.round(analysis.loot ?? 0).toLocaleString()}</b><br><br>`
      + '<b>Own Repair</b><br>'
      + `Air: ${duration(repairs.aircraft)}<br>Vehicle: ${duration(repairs.vehicle)}<br>Infantry: ${duration(repairs.infantry)}<br>`
      + `<b>Total: ${duration(analysis.repairSeconds)}</b><br><br>`
      + '<b>Possible Attacks</b><br>'
      + `CP: ${Math.round(Number(attacks.commandPointAttacks ?? 0))}<br>RT: ${repairLimit}`
    );
  }

  renderBestStats(best, completed, total) {
    if (!best?.analysis || !this.bestStats) return;
    const analysis = best.analysis;
    const loot = analysis.lootResources ?? {};
    const repairs = analysis.repairTimeByGroup ?? {};
    const outcomeColor = /victory/i.test(String(analysis.outcome ?? '')) ? '#19733a' : '#b32323';
    this.bestStats.setValue(
      '<b>Best so far</b><br><br>'
      + `<b>Troop:</b> ${escapeHtml(best.troop?.name ?? 'Unknown')}<br>`
      + `<b>Position:</b> ${best.cell.x + 1}:${best.cell.y + 1}<br>`
      + `<b>Checked after:</b> ${completed}/${total}<br><br>`
      + `<b>RP:</b> <span style="color:#0877ad"><b>${Math.round(best.score.research).toLocaleString()}</b></span><br>`
      + `<b>Total loot:</b> ${Math.round(analysis.loot ?? 0).toLocaleString()}<br>`
      + `Crystal: ${Math.round(loot.crystal ?? 0).toLocaleString()}<br>`
      + `Tiberium: ${Math.round(loot.tiberium ?? 0).toLocaleString()}<br>`
      + `Credits: ${Math.round(loot.credits ?? 0).toLocaleString()}<br><br>`
      + `<b>Outcome:</b> <span style="color:${outcomeColor}"><b>${escapeHtml(analysis.outcome ?? 'Unknown')}</b></span><br>`
      + `<b>Target State:</b> ${remaining(analysis.defenderRemaining)}<br>`
      + `<b>Own State:</b> ${remaining(analysis.ownRemaining)}<br>`
      + `<b>Repair:</b> ${duration(analysis.repairSeconds)}<br>`
      + `<span style="color:#52636b">Air ${duration(repairs.aircraft)} · Vehicle ${duration(repairs.vehicle)} · Infantry ${duration(repairs.infantry)}</span>`
    );
  }

  refreshEstimate() {
    if (!this.summary) return;
    const snapshot = this.hub.snapshot();
    const count = snapshot.units?.length ?? 0;
    const simulations = totalGreedySimulations(count);
    const minutes = Math.ceil(simulations * 3.35 / 60);
    this.summary.setValue(count
      ? `<b>${count} troops · ${simulations} simulations</b><br>Estimated minimum runtime: about ${minutes} minutes. Lowest level is tested first; ties use health and name.`
      : 'Open a target attack setup with an offensive formation first.');
  }

  stop() {
    this.sequence += 1;
    this.running = false;
    this.paused = false;
    this.startButton?.setLabel?.('Start');
    this.pauseButton?.setEnabled?.(false);
    this.pauseButton?.setLabel?.('Pause');
    this.viewButton?.setEnabled?.(false);
    this.activity?.setValue?.('<b>Stopped.</b><br>The current partially optimized formation remains visible. Use Restore Original if desired.');
  }

  togglePause(force = null) {
    if (!this.running) return;
    this.paused = force == null ? !this.paused : Boolean(force);
    this.pauseButton.setLabel(this.paused ? 'Resume' : 'Pause');
    if (this.paused) this.activity.setValue(`${this.activity.getValue?.() ?? ''}<br><br><b>Paused after the current simulation.</b>`);
  }

  requestView() {
    if (!this.running) return;
    this.viewRequested = true;
    this.togglePause(true);
  }

  async pauseCheckpoint(runId) {
    if (this.viewRequested) {
      this.viewRequested = false;
      this.context.eventBus?.emit?.('war-room:show-native-simulation');
      try { globalThis.ClientLib?.API?.Battleground?.GetInstance?.()?.SimulateBattle?.(); } catch { /* Native viewer is optional. */ }
    }
    while (this.paused && runId === this.sequence) await wait(150);
  }

  restore() {
    if (!this.original) return;
    try {
      this.hub.applyFormation(this.original);
      this.activity.setValue('<b>Original formation restored.</b>');
    } catch (error) {
      this.context.notifications?.show?.(`Could not restore formation: ${error?.message ?? error}`, { level: 'error' });
    }
  }

  async start() {
    const runId = ++this.sequence;
    let snapshot;
    try {
      snapshot = this.hub.snapshot();
      this.original = this.hub.captureFormation();
      if (!snapshot.units?.length) throw new Error('Open a target attack setup with an offensive formation first.');
    } catch (error) {
      this.context.notifications?.show?.(error?.message ?? String(error), { level: 'error' });
      return;
    }
    this.running = true;
    this.paused = false;
    this.startButton.setLabel('Stop');
    this.pauseButton.set({ enabled: true, label: 'Pause' });
    this.viewButton.setEnabled(true);
    this.restoreButton.setEnabled(true);
    this.setProgress(0);
    this.bestStats?.setValue?.(
      '<b>Best so far</b><br><span style="color:#52636b">Waiting for the first completed simulation.</span>'
    );
    const ordered = orderWeakestFirst(snapshot.units);
    const locked = new Map();
    const total = totalGreedySimulations(ordered.length);
    let completed = 0;
    let finalUnits = snapshot.units.map((unit) => ({ ...unit, enabled: false }));
    let finalResponse = null;
    let bestOverall = null;
    try {
      for (let troopIndex = 0; troopIndex < ordered.length; troopIndex += 1) {
        if (runId !== this.sequence) return;
        const troop = ordered[troopIndex];
        let stageBest = null;
        const cells = stageCells(locked);
        for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
          if (runId !== this.sequence) return;
          await this.pauseCheckpoint(runId);
          if (runId !== this.sequence) return;
          const cell = cells[cellIndex];
          const candidate = greedyCandidate({ units: snapshot.units, orderedUnits: ordered, locked, activeUnit: troop, cell });
          this.activity.setValue(
            `<b>Troop ${troopIndex + 1}/${ordered.length}: ${troop.name}</b> (level ${troop.level ?? '?'})<br>`
            + `Testing column ${cell.x + 1}, row ${cell.y + 1} · ${cellIndex + 1}/${cells.length}<br>`
            + `${completed}/${total} total simulations complete`
            + (stageBest
              ? `<br><br><b>Best cell so far:</b> ${stageBest.cell.x + 1}:${stageBest.cell.y + 1}`
                + `<br><b>Best RP:</b> ${Math.round(stageBest.score.research).toLocaleString()}`
              : '')
          );
          this.hub.applyRecommendedFormation(candidate);
          // Leave enough time for the native formation grid and battle setup
          // to publish the move before requesting its result.
          await wait(500);
          let response;
          try { response = await this.hub.simulateFormation(candidate); }
          catch (error) {
            this.context.logger?.warn?.('Super Simulator candidate was rejected.', { troop: troop.name, cell, error: error?.message ?? error });
            completed += 1;
            this.setProgress(completed / total * 100);
            if (completed < total) await wait(3100);
            continue;
          }
          const analysis = WarRoomCalculator.analyzeNativeSimulation(
            response, { ...snapshot, units: candidate }, `${troop.name} at ${cell.x + 1}:${cell.y + 1}`
          );
          this.renderLiveStats(analysis);
          const scored = scoreMaximumResearch(analysis);
          if (!stageBest || scored.score < stageBest.score.score) stageBest = { cell, units: candidate, score: scored, response };
          completed += 1;
          if (!bestOverall || scored.score < bestOverall.score.score) {
            bestOverall = { cell, troop, units: candidate, score: scored, response, analysis };
            this.renderBestStats(bestOverall, completed, total);
          }
          this.setProgress(completed / total * 100);
          await this.pauseCheckpoint(runId);
          if (runId !== this.sequence) return;
          if (completed < total) await wait(3100);
        }
        if (!stageBest) throw new Error(`Every position was rejected for ${troop.name}.`);
        locked.set(unitId(troop), stageBest.cell);
        finalUnits = stageBest.units;
        finalResponse = stageBest.response;
        this.hub.applyRecommendedFormation(finalUnits);
      }
      this.finalUnits = finalUnits.map((unit) => ({ ...unit, enabled: true }));
      this.hub.applyRecommendedFormation(this.finalUnits);
      // The last cell tested is not necessarily the winning cell. Keep the
      // native response paired with the final winning formation so Current
      // live view describes the formation that remains applied in the game.
      if (finalResponse) {
        this.renderLiveStats(WarRoomCalculator.analyzeNativeSimulation(
          finalResponse, { ...snapshot, units: this.finalUnits }, 'Final formation'
        ));
      }
      this.setProgress(100);
      this.activity.setValue(`<b>Complete.</b><br>${ordered.length} troops locked after ${completed} native simulations. The final formation is active in the attack setup.`);
    } catch (error) {
      if (runId === this.sequence) {
        this.activity.setValue(`<b>Super Simulator stopped on an error:</b><br>${error?.message ?? error}`);
        this.context.notifications?.show?.(`Super Simulator: ${error?.message ?? error}`, { level: 'error' });
      }
    } finally {
      if (runId === this.sequence) {
        this.running = false;
        this.paused = false;
        this.startButton.setLabel('Start');
        this.pauseButton.set({ enabled: false, label: 'Pause' });
        this.viewButton.setEnabled(false);
      }
    }
  }

  async open() {
    const record = await this.context.windows.open({ id: 'super-simulator', title: 'Super Simulator', content: this.build(), x: 80, y: 55, width: 700, height: 500, resizable: true, singleton: true });
    this.refreshEstimate();
    return record;
  }
}

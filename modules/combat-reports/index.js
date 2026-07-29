import { Module } from '../../core/interfaces/module.js';
import { normalizeReport, filterReports, aggregateReports, targetTrends } from './report-analytics.js';

function call(target, names, ...args) { for (const name of names) { try { if (typeof target?.[name] === 'function') { const value = target[name](...args); if (value != null) return value; } } catch {} } return null; }
function values(collection) { const source = collection?.d ?? collection?.l ?? collection ?? []; return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean); }

export class CombatReportsModule extends Module {
  constructor() { super({ id: 'combat-reports', name: 'Combat Reports', version: '0.1.0', apiVersion: '1.0.0', author: 'ProfessorSr', description: 'Filter, aggregate, trend, and export combat report history.', permissions: ['game', 'storage', 'windows'], settings: {} }); }
  async enable(context) { this.context = context; }
  read() {
    const root = this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib;
    const main = root?.Data?.MainData?.GetInstance?.(); const manager = call(main, ['get_Reports', 'get_ReportData']);
    const raw = values(call(manager, ['get_AllReports', 'get_Reports', 'get_ReportHeaders']) ?? manager);
    return raw.map((report) => normalizeReport({
      ...report, id: call(report, ['get_Id']) ?? report.Id, at: call(report, ['get_Time', 'get_Timestamp']) ?? report.Timestamp,
      opponent: call(report, ['get_OpponentName', 'get_TargetName']) ?? report.TargetName,
      ownBase: call(report, ['get_CityName', 'get_AttackerBaseName']) ?? report.CityName,
      type: call(report, ['get_TypeName']) ?? report.Type, pvp: call(report, ['get_IsPvP']) ?? report.IsPvP,
      won: call(report, ['get_Won', 'get_IsVictory']) ?? report.Won, destroyed: call(report, ['get_Destroyed']) ?? report.Destroyed,
      cp: call(report, ['get_CommandPointCost']) ?? report.Cost, repairSeconds: call(report, ['get_RepairTime']) ?? report.RepairTime,
      loot: call(report, ['get_Loot']) ?? report.Loot, damage: call(report, ['get_Damage']) ?? report.Damage, losses: call(report, ['get_Losses']) ?? report.Losses
    })).sort((a, b) => b.at - a.at);
  }
  filtered() { return filterReports(this.read(), { from: this.from?.getValue(), to: this.to?.getValue(), type: this.type?.getSelection?.()[0]?.getLabel?.(), query: this.query?.getValue?.() }); }
  render() {
    const reports = this.filtered(), totals = aggregateReports(reports);
    this.model.setData(reports.map((r) => [new Date(r.at).toLocaleString(), r.type, r.ownBase, r.opponent, r.won ? 'Victory' : 'Defeat', r.cp, Math.round(Object.values(r.loot).reduce((s, v) => s + v, 0)), Math.round(r.repairSeconds)]));
    this.summary.setValue(`${totals.attacks} attacks · ${totals.wins} wins (${Math.round(totals.winRate * 100)}%) · PvP ${totals.pvp} / PvE ${totals.pve} · ${Math.round(totals.totalLoot)} loot · ${Math.round(totals.lootPerCp)} loot/CP · ${Math.round(totals.repairSeconds)}s repairs`);
    this.trendModel.setData(targetTrends(reports).map((t) => [t.target, t.attacks, t.wins, Math.round(t.loot), Math.round(t.repairSeconds), new Date(t.lastAt).toLocaleString()]));
  }
  exportText() { const rows = this.filtered(); return ['Time\tType\tBase\tTarget\tWon\tCP\tTiberium\tCrystal\tCredits\tRP\tRepair', ...rows.map((r) => [new Date(r.at).toISOString(), r.type, r.ownBase, r.opponent, r.won, r.cp, r.loot.tiberium, r.loot.crystal, r.loot.credits, r.loot.research, r.repairSeconds].join('\t'))].join('\n'); }
  build() {
    const qx = globalThis.qx, root = new qx.ui.container.Composite(new qx.ui.layout.VBox(6)).set({ padding: 8 }); const filters = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
    this.from = new qx.ui.form.TextField().set({ placeholder: 'YYYY-MM-DD', width: 105 }); this.to = new qx.ui.form.TextField().set({ placeholder: 'YYYY-MM-DD', width: 105 }); this.query = new qx.ui.form.TextField().set({ placeholder: 'Base or target', width: 180 }); this.type = new qx.ui.form.SelectBox(); for (const type of ['All', 'PvP', 'PvE']) this.type.add(new qx.ui.form.ListItem(type)); const refresh = new qx.ui.form.Button('Refresh');
    for (const widget of [new qx.ui.basic.Label('From'), this.from, new qx.ui.basic.Label('To'), this.to, this.query, this.type, refresh]) filters.add(widget); root.add(filters);
    this.summary = new qx.ui.basic.Label('').set({ textColor: '#fff', wrap: true }); root.add(this.summary);
    const tabs = new qx.ui.tabview.TabView(); const reportsPage = new qx.ui.tabview.Page('Reports').set({ layout: new qx.ui.layout.VBox() }); this.model = new qx.ui.table.model.Simple(); this.model.setColumns(['Time', 'Type', 'Base', 'Target', 'Result', 'CP', 'Loot', 'Repair s']); reportsPage.add(new qx.ui.table.Table(this.model), { flex: 1 }); tabs.add(reportsPage);
    const trendsPage = new qx.ui.tabview.Page('Target Trends').set({ layout: new qx.ui.layout.VBox() }); this.trendModel = new qx.ui.table.model.Simple(); this.trendModel.setColumns(['Target', 'Attacks', 'Wins', 'Loot', 'Repair s', 'Last attack']); trendsPage.add(new qx.ui.table.Table(this.trendModel), { flex: 1 }); tabs.add(trendsPage); root.add(tabs, { flex: 1 });
    const copy = new qx.ui.form.Button('Copy Report Summary'); copy.addListener('execute', async () => { const text = this.exportText(); if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else prompt('Copy reports', text); }); root.add(copy); refresh.addListener('execute', () => this.render()); this.render(); return root;
  }
  async open(context = this.context) { if (!this.context) await this.enable(context); if (this.record?.window && !this.record.window.isDisposed?.()) { this.render(); this.record.window.open(); return this.record; } this.record = await this.context.windows.open({ id: 'combat-reports', title: 'Combat Reports', content: this.build(), x: 100, y: 70, width: 1050, height: 650, resizable: true, singleton: true }); return this.record; }
  async disable(context = this.context) { context?.windows?.close?.('combat-reports'); this.record = null; this.context = null; }
}
export default CombatReportsModule;

import { Module } from '../../core/interfaces/module.js';

const STORAGE_KEY = 'module:alliance-proximity-monitor:settings:v1';
const DEFAULTS = Object.freeze({ mode: 'diplomacy', allianceIds: [], radius: 15, intervalSeconds: 300 });

function call(target, names, ...args) {
  for (const name of names) try {
    if (typeof target?.[name] === 'function') {
      const value = target[name](...args);
      if (value != null) return value;
    }
  } catch { /* Live game objects can be incomplete while sectors load. */ }
  return null;
}
function values(collection) {
  const source = collection?.d ?? collection?.l ?? collection ?? [];
  return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean);
}
function number(value, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback; }
function text(value, fallback = '') { return value == null ? fallback : String(value); }
function quote(value) { return `"${text(value).replaceAll('"', '""')}"`; }
export function fieldDistance(a, b) { return Math.hypot(number(a?.x) - number(b?.x), number(a?.y) - number(b?.y)); }

function coordinate(record) {
  const x = record?.x ?? record?.X ?? record?.PosX ?? record?.px ?? call(record, ['get_PosX', 'get_X']);
  const y = record?.y ?? record?.Y ?? record?.PosY ?? record?.py ?? call(record, ['get_PosY', 'get_Y']);
  return Number.isFinite(Number(x)) && Number.isFinite(Number(y)) ? { x: Number(x), y: Number(y) } : null;
}
function normalizeBases(payload, player = {}) {
  const root = payload?.d ?? payload?.p ?? payload?.player ?? payload ?? {};
  const candidates = [root.c, root.Cities, root.cities, root.Bases, root.bases, root.b].flatMap(values);
  const seen = new Map();
  for (const base of candidates) {
    const point = coordinate(base);
    if (!point) continue;
    const id = text(base?.i ?? base?.Id ?? base?.id ?? call(base, ['get_Id']) ?? `${point.x}:${point.y}`);
    seen.set(id, {
      id, x: point.x, y: point.y,
      name: text(base?.n ?? base?.Name ?? base?.name ?? call(base, ['get_Name']), 'Base'),
      playerId: text(player.id), player: text(player.name, 'Unknown player'),
      allianceId: text(player.allianceId), alliance: text(player.alliance)
    });
  }
  return [...seen.values()];
}
function memberRecord(member) {
  return {
    raw: member,
    id: text(member?.Id ?? member?.i ?? member?.PlayerId ?? member?.p ?? call(member, ['get_Id', 'get_PlayerId'])),
    name: text(member?.Name ?? member?.n ?? member?.PlayerName ?? call(member, ['get_Name']), 'Unknown player')
  };
}
function allianceRecord(entry, index = 0) {
  return {
    id: text(entry?.a ?? entry?.i ?? entry?.Id ?? entry?.id ?? call(entry, ['get_Id'])),
    name: text(entry?.an ?? entry?.n ?? entry?.Name ?? entry?.name ?? call(entry, ['get_Name']), `Alliance ${index + 1}`),
    raw: entry
  };
}
function diplomacyEnemies(alliance) {
  const enemyType = globalThis.webfrontend?.gui?.alliance?.DiplomacyPage?.ERelationTypeEnemy;
  const native = enemyType == null ? [] : values(call(alliance, ['GetAllianceRelationshipsByType'], enemyType, true));
  const direct = native.concat(values(call(alliance, ['get_EnemyAlliances', 'get_Enemies'])));
  const relationships = values(call(alliance, ['get_Relationships', 'get_Diplomacy']));
  const all = direct.concat(relationships.filter((entry) => {
    const label = text(entry?.Type ?? entry?.type ?? entry?.Relationship ?? entry?.r ?? call(entry, ['get_Type', 'get_Relationship']));
    return /enemy|hostile/i.test(label) || (enemyType != null && Number(label) === Number(enemyType));
  }));
  return [...new Map(all.map((entry, index) => { const item = allianceRecord(entry, index); return [item.id || item.name.toLowerCase(), item]; })).values()];
}

export class AllianceProximityMonitorModule extends Module {
  constructor() {
    super({ id: 'alliance-proximity-monitor', name: 'Alliance Proximity Monitor', version: '0.1.0', apiVersion: '1.0.0', author: 'ProfessorSr', description: 'Find selected enemy-alliance bases within a chosen distance of alliance-member bases.', permissions: ['game', 'notifications', 'storage', 'windows'], manual: { steps: ['Choose diplomacy enemies or manually select alliances.', 'Run once or start automatic monitoring.', 'Export the paired friendly/enemy base results as CSV.'], controls: [['Scan Now', 'Runs one scan without starting the timer.'], ['Start / Stop', 'Controls automatic background scans.'], ['Export CSV', 'Downloads the current result list.']] } });
    this.running = false; this.scanning = false; this.timer = null; this.results = []; this.alliances = [];
  }
  client() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.client()?.root ?? globalThis.ClientLib; }
  main() { return this.client()?.getMainData?.() ?? this.root()?.Data?.MainData?.GetInstance?.(); }
  command(name, payload, timeoutMs = 20000) {
    const communication = this.root()?.Net?.CommunicationManager?.GetInstance?.();
    const factory = globalThis.webfrontend?.phe?.cnc?.Util?.createEventDelegate ?? globalThis.webfrontend?.Util?.createEventDelegate;
    const type = this.root()?.Net?.CommandResult;
    if (!communication?.SendSimpleCommand || !factory) return Promise.reject(new Error('Game command service is unavailable.'));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${name} timed out.`)), timeoutMs);
      const receiver = { done(_status, response) { clearTimeout(timeout); response == null ? reject(new Error(`${name} returned no data.`)) : resolve(response); } };
      communication.SendSimpleCommand(name, payload, factory(type, receiver, receiver.done), null);
    });
  }
  async enable(context) { this.context = context; this.settings = { ...DEFAULTS, ...(await context.storage.get(STORAGE_KEY, {})) }; }
  alliance() { return call(this.main(), ['get_Alliance']); }
  members() { return values(call(this.alliance(), ['get_MemberDataAsArray'])).map(memberRecord).filter((item) => item.id || item.name); }
  async publicPlayer(player) {
    const payloads = player.id ? [{ id: Number(player.id) || player.id }, { playerId: Number(player.id) || player.id }] : [];
    payloads.push({ name: player.name });
    let last;
    for (const payload of payloads) try { return await this.command('GetPublicPlayerInfo', payload); } catch (error) { last = error; }
    throw last ?? new Error(`Could not load ${player.name}.`);
  }
  async basesForPlayers(players, allianceInfo) {
    const bases = [];
    for (const player of players) {
      try {
        const response = await this.publicPlayer(player);
        const root = response?.d ?? response?.p ?? response ?? {};
        const enriched = { ...player, allianceId: text(root.a ?? root.ai ?? allianceInfo?.id), alliance: text(root.an ?? allianceInfo?.name) };
        bases.push(...normalizeBases(response, enriched));
      } catch (error) { this.context?.logger?.warn?.(`Unable to read bases for ${player.name}.`, error); }
    }
    return bases;
  }
  async rankedAlliances() {
    const response = await this.command('RankingGetData', { firstIndex: 0, lastIndex: 2999, ascending: true, view: this.root()?.Data?.Ranking?.EViewType?.Alliance ?? 1, rankingType: this.root()?.Data?.Ranking?.ERankingType?.Score ?? 0, sortColumn: 2 });
    return values(response?.a ?? response?.alliances).map(allianceRecord).filter((item) => item.id && item.name);
  }
  async playersForAlliance(alliance) {
    const response = await this.command('GetPublicAllianceInfo', { id: Number(alliance.id) || alliance.id });
    return values(response?.m ?? response?.members).map((entry) => ({
      id: text(entry?.i ?? entry?.Id ?? entry?.id),
      name: text(entry?.n ?? entry?.Name ?? entry?.name),
      allianceId: alliance.id,
      alliance: text(response?.n ?? alliance.name)
    })).filter((player) => player.id);
  }
  selectedAlliances() {
    if (this.settings.mode === 'diplomacy') return diplomacyEnemies(this.alliance());
    const selected = new Set(this.settings.allianceIds.map(String));
    return this.alliances.filter((item) => selected.has(item.id));
  }
  async scan() {
    if (this.scanning) return this.results;
    this.scanning = true; this.setStatus('Scanning alliance bases…');
    try {
      await this.saveOptions();
      const ownAlliance = { id: text(call(this.alliance(), ['get_Id'])), name: text(call(this.alliance(), ['get_Name'])) };
      const friendly = await this.basesForPlayers(this.members(), ownAlliance);
      const enemyAlliances = this.selectedAlliances();
      if (!enemyAlliances.length) throw new Error('No enemy alliances are selected or marked as enemies.');
      const enemies = [];
      for (const alliance of enemyAlliances) enemies.push(...await this.basesForPlayers(await this.playersForAlliance(alliance), alliance));
      const radius = number(this.settings.radius, 15);
      this.results = [];
      for (const enemy of enemies) for (const ally of friendly) {
        const distance = fieldDistance(enemy, ally);
        if (distance <= radius) this.results.push({ allyPlayer: ally.player, allyBase: ally.name, allyX: ally.x, allyY: ally.y, enemyAlliance: enemy.alliance, enemyPlayer: enemy.player, enemyBase: enemy.name, enemyX: enemy.x, enemyY: enemy.y, distance });
      }
      this.results.sort((a, b) => a.distance - b.distance || a.allyPlayer.localeCompare(b.allyPlayer));
      this.renderResults(); this.setStatus(`${this.results.length} nearby enemy-base match${this.results.length === 1 ? '' : 'es'} found.`);
      if (this.results.length) this.context.notifications.show(`<b style="color:#ff5b5b">Enemy proximity alert</b><br>${this.results.length} enemy base match${this.results.length === 1 ? '' : 'es'} within ${radius} fields.`, { duration: 10000 });
      return this.results;
    } catch (error) { this.setStatus(error.message); this.context.notifications.show(`Alliance proximity scan failed: ${error.message}`, { duration: 8000 }); throw error; }
    finally { this.scanning = false; }
  }
  async startMonitoring() { if (this.running) return; await this.saveOptions(); this.running = true; this.updateButtons(); await this.scan().catch(() => {}); this.timer = setInterval(() => void this.scan().catch(() => {}), Math.max(30, number(this.settings.intervalSeconds, 300)) * 1000); }
  stopMonitoring() { this.running = false; if (this.timer) clearInterval(this.timer); this.timer = null; this.updateButtons(); this.setStatus('Automatic monitoring stopped.'); }
  setStatus(message) { this.status?.setValue?.(text(message)); }
  updateButtons() { this.startButton?.setEnabled?.(!this.running); this.stopButton?.setEnabled?.(this.running); }
  async saveOptions() {
    if (this.mode) this.settings.mode = this.mode.getSelection()?.[0]?.getModel?.() ?? this.settings.mode;
    if (this.radius) this.settings.radius = this.radius.getValue();
    if (this.interval) this.settings.intervalSeconds = this.interval.getValue();
    if (this.allianceList) this.settings.allianceIds = this.allianceList.getSelection().map((item) => text(item.getModel()));
    await this.context.storage.set(STORAGE_KEY, this.settings);
  }
  renderResults() { this.model?.setData?.(this.results.map((row) => [row.allyPlayer, row.allyBase, `${row.allyX}:${row.allyY}`, row.enemyAlliance, row.enemyPlayer, row.enemyBase, `${row.enemyX}:${row.enemyY}`, row.distance.toFixed(2)])); }
  csv() { return ['Alliance member,Friendly base,Friendly coordinates,Enemy alliance,Enemy player,Enemy base,Enemy coordinates,Distance', ...this.results.map((row) => [row.allyPlayer, row.allyBase, `${row.allyX}:${row.allyY}`, row.enemyAlliance, row.enemyPlayer, row.enemyBase, `${row.enemyX}:${row.enemyY}`, row.distance.toFixed(2)].map(quote).join(','))].join('\n'); }
  exportCsv() { const url = URL.createObjectURL(new Blob([this.csv()], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cnc-ta-alliance-proximity-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async loadAllianceList() {
    this.setStatus('Loading alliance list…');
    try { this.alliances = await this.rankedAlliances(); this.allianceList.removeAll(); const qx = globalThis.qx; for (const alliance of this.alliances) { const item = new qx.ui.form.ListItem(alliance.name, null, alliance.id); this.allianceList.add(item); if (this.settings.allianceIds.includes(alliance.id)) this.allianceList.addToSelection(item); } this.setStatus(`${this.alliances.length} alliances loaded.`); }
    catch (error) { this.setStatus(`Alliance list failed: ${error.message}`); }
  }
  build() {
    const qx = globalThis.qx; const root = new qx.ui.container.Composite(new qx.ui.layout.VBox(7)).set({ padding: 9 });
    const source = new qx.ui.container.Composite(new qx.ui.layout.HBox(8)); source.add(new qx.ui.basic.Label('Enemy source:'));
    this.mode = new qx.ui.form.RadioButtonGroup(); const diplomacy = new qx.ui.form.RadioButton('Diplomacy enemies').set({ model: 'diplomacy' }); const manual = new qx.ui.form.RadioButton('Manual selection').set({ model: 'manual' }); this.mode.add(diplomacy, manual); this.mode.setSelection([this.settings.mode === 'manual' ? manual : diplomacy]); source.add(this.mode); root.add(source);
    const options = new qx.ui.container.Composite(new qx.ui.layout.HBox(7)); this.radius = new qx.ui.form.Spinner(1, number(this.settings.radius, 15), 50); this.interval = new qx.ui.form.Spinner(30, number(this.settings.intervalSeconds, 300), 86400); options.add(new qx.ui.basic.Label('Distance:')); options.add(this.radius); options.add(new qx.ui.basic.Label('Auto interval (seconds):')); options.add(this.interval); root.add(options);
    this.allianceList = new qx.ui.form.List().set({ selectionMode: 'multi', height: 105 }); root.add(this.allianceList); const load = new qx.ui.form.Button('Load / Refresh Alliance List'); root.add(load); load.addListener('execute', () => void this.loadAllianceList());
    const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(6)); this.startButton = new qx.ui.form.Button('Start'); this.stopButton = new qx.ui.form.Button('Stop'); const scan = new qx.ui.form.Button('Scan Now'); const exportButton = new qx.ui.form.Button('Export CSV'); for (const button of [this.startButton, this.stopButton, scan, exportButton]) actions.add(button); root.add(actions); this.startButton.addListener('execute', () => void this.startMonitoring()); this.stopButton.addListener('execute', () => this.stopMonitoring()); scan.addListener('execute', () => void this.scan().catch(() => {})); exportButton.addListener('execute', () => this.exportCsv());
    this.status = new qx.ui.basic.Label('Stopped.'); root.add(this.status); this.model = new qx.ui.table.model.Simple(); this.model.setColumns(['Member', 'Friendly base', 'Friendly coord.', 'Enemy alliance', 'Enemy player', 'Enemy base', 'Enemy coord.', 'Distance']); this.table = new qx.ui.table.Table(this.model); root.add(this.table, { flex: 1 }); this.updateButtons(); void this.loadAllianceList(); return root;
  }
  async open(context = this.context) { if (!this.context) await this.enable(context); if (this.record?.window && !this.record.window.isDisposed?.()) { this.record.window.open(); return this.record; } this.record = await this.context.windows.open({ id: this.id, title: this.name, content: this.build(), x: 130, y: 70, width: 980, height: 650, resizable: true, singleton: true }); return this.record; }
  async disable(context = this.context) { this.stopMonitoring(); context?.windows?.close?.(this.id); this.record = null; this.context = null; }
}
export default AllianceProximityMonitorModule;

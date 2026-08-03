import { Module } from '../../core/interfaces/module.js';

function call(target, names, ...args) { for (const name of names) { try { if (typeof target?.[name] === 'function') { const value = target[name](...args); if (value != null) return value; } } catch {} } return null; }
function values(collection) { const source = collection?.d ?? collection?.l ?? collection ?? []; return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean); }
function entity(entity) { const data = call(entity, ['get_UnitGameData_Obj', 'get_TechGameData_Obj']); return { id: call(entity, ['get_MdbUnitId', 'get_MdbId']), name: call(data, ['get_Name', 'get_DisplayName']) ?? data?.n ?? 'Unknown', level: Number(call(entity, ['get_CurrentLevel', 'get_Level']) ?? 0), x: Number(call(entity, ['get_CoordX', 'get_X']) ?? 0), y: Number(call(entity, ['get_CoordY', 'get_Y']) ?? 0) }; }
function faction(value) { return Number(value) === 1 ? 'G' : Number(value) === 2 ? 'N' : Number(value) > 2 ? 'F' : 'E'; }
function unitCode(name) { const value = String(name).toLowerCase(); const rules = [['construction yard','y'],['defense facility','w'],['defense hq','q'],['command center','e'],['command post','e'],['power plant','p'],['accumulator','a'],['refinery','r'],['silo','s'],['barracks','b'],['factory','f'],['airport','d'],['airfield','d'],['harvester','h'],['wall','w'],['barbwire','b'],['barrier','t'],['flak','f'],['sniper','s'],['mammoth','m'],['avatar','a'],['predator','d'],['scorpion','o'],['pitbull','p'],['paladin','a'],['orca','o'],['firehawk','f'],['juggernaut','j'],['kodiak','k'],['rifle','r'],['missile','q'],['commando','c'],['zone trooper','z'],['black hand','z'],['confessor','s'],['militant','m'],['attack bike','b'],['cobra','r'],['reckoner','k'],['salamander','l'],['specter','p'],['venom','v'],['vertigo','t'],['cannon','c'],['turret','m']]; return rules.find(([term]) => value.includes(term))?.[1] ?? '.'; }

export function cnctaOptLink(data) {
  const cells = Array.from({ length: 20 }, () => Array(9).fill(null));
  for (const item of data.buildings) if (item.x >= 0 && item.x < 9 && item.y >= 0 && item.y < 8) cells[item.y][item.x] = item;
  for (const item of data.defense) { const y = item.y + 8; if (item.x >= 0 && item.x < 9 && y >= 8 && y < 16) cells[y][item.x] = item; }
  for (const item of data.offense) { const y = item.y + 16; if (item.x >= 0 && item.x < 9 && y >= 16 && y < 20) cells[y][item.x] = item; }
  let layout = '';
  for (let y = 0; y < 20; y += 1) for (let x = 0; x < 9; x += 1) {
    const item = cells[y][x];
    if (item) { layout += `${item.level || ''}${unitCode(item.name)}`; continue; }
    const terrain = y < 8 ? Number(data.terrain?.[y]?.[x] ?? 0) : 0;
    layout += ({ 0: '.', 1: 'c', 2: 't', 4: 'j', 5: 'h', 6: 'l', 7: 'k' })[terrain] ?? '.';
  }
  const economy = Number(data.techFactor ?? 0) === 1.2 ? 'old' : 'new';
  const query = `ver=3~${faction(data.faction)}~${faction(data.offenseFaction ?? data.faction)}~${data.name}~${layout}~E=${economy}~X=${data.x}~Y=${data.y}~WID=${data.world}~WN=${data.worldName}~ML=${data.maxLevel ?? 80}`;
  return `https://www.cnctaopt.com/index.html?${encodeURI(query)}`;
}

export function cncOptLink(data) {
  return `http://cncopt.com/?map=3|${faction(data.faction)}|${faction(data.offenseFaction ?? data.faction)}|${encodeURIComponent(data.name)}|${encodeURIComponent(cnctaOptLink(data).split(`~${data.name}~`)[1] ?? '')}`;
}

export class ExternalToolsModule extends Module {
  constructor() {
    super({ id: 'external-tools', name: 'External Analysis', version: '0.2.0', apiVersion: '1.0.0', author: 'ProfessorSr', description: 'Generate, copy, and explicitly open links or payloads for external base-analysis tools.', permissions: ['game', 'settings', 'windows'], settings: {
      cncMapTemplate: { type: 'string', default: 'https://cnc-map.com/{world}' },
      analyzerTemplate: { type: 'string', default: '' }
    } });
  }
  async enable(context) { this.context = context; }
  snapshot() {
    const root = this.context.hub.game.services.tryGet('clientLib')?.root ?? globalThis.ClientLib;
    const main = root?.Data?.MainData?.GetInstance?.(), cities = call(main, ['get_Cities']);
    const city = call(cities, ['get_CurrentCity', 'get_CurrentOwnCity']), server = call(main, ['get_Server']);
    const units = call(city, ['get_CityUnitsData']);
    const ownCity = call(cities, ['get_CurrentOwnCity']);
    const data = { name: String(call(city, ['get_Name']) ?? 'Base'), id: call(city, ['get_Id']), x: Number(call(city, ['get_PosX']) ?? 0), y: Number(call(city, ['get_PosY']) ?? 0), level: Number(call(city, ['get_LvlBase']) ?? 0), faction: call(city, ['get_CityFaction']), offenseFaction: call(ownCity, ['get_CityFaction']), owner: call(city, ['get_PlayerName', 'get_OwnerName']) ?? '', alliance: call(city, ['get_AllianceName']) ?? '', world: call(server, ['get_WorldId', 'get_Id']), worldName: call(server, ['get_Name', 'get_WorldName']) ?? '', maxLevel: call(server, ['get_PlayerUpgradeCap']) ?? 80, techFactor: call(server, ['get_TechLevelUpgradeFactorBonusAmount']), host: globalThis.location?.host ?? '', terrain: [], buildings: values(call(city, ['get_Buildings'])).map(entity), defense: values(call(units, ['get_DefenseUnits'])).map(entity), offense: values(call(units, ['get_OffenseUnits'])).map(entity) };
    for (let y = 0; y < 8; y += 1) { const row = []; for (let x = 0; x < 9; x += 1) row.push(Number(call(city, ['GetResourceType'], x, y) ?? 0)); data.terrain.push(row); }
    data.payload = JSON.stringify(data);
    return data;
  }
  expand(template, data) { return String(template || '').replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key] ?? '')); }
  async output(value, open = false) { if (!value) throw new Error('Configure the URL template first.'); if (open) { globalThis.open?.(value, '_blank', 'noopener,noreferrer'); return; } if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(value); else globalThis.prompt?.('Copy URL', value); }
  build() {
    const qx = globalThis.qx, root = new qx.ui.container.Composite(new qx.ui.layout.VBox(8)).set({ padding: 10, textColor: '#fff' });
    root.add(new qx.ui.basic.Label('Templates support {host}, {world}, {worldName}, {id}, {name}, {owner}, {alliance}, {faction}, {x}, {y}, {level}, {terrain}, {buildings}, {defense}, {offense}, and {payload}. External pages open only after an explicit click.').set({ textColor: '#fff', wrap: true }));
    for (const [key, label] of [['cncMapTemplate', 'CNC Map'], ['analyzerTemplate', 'Base Analyzer']]) {
      root.add(new qx.ui.basic.Label(`${label} URL template`).set({ textColor: '#fff' }));
      const field = new qx.ui.form.TextField(this.context.moduleSettings.get(key, '')); field.addListener('changeValue', (event) => void this.context.moduleSettings.set(key, event.getData())); root.add(field);
      const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(6)); const copy = new qx.ui.form.Button(`Copy ${label} Link`), open = new qx.ui.form.Button(`Open ${label}`);
      copy.addListener('execute', () => this.output(this.expand(field.getValue(), this.snapshot()))); open.addListener('execute', () => this.output(this.expand(field.getValue(), this.snapshot()), true)); actions.add(copy); actions.add(open); root.add(actions);
    }
    const payload = new qx.ui.form.Button('Copy Full Selected-Base Payload'); payload.addListener('execute', () => this.output(this.snapshot().payload)); root.add(payload);
    const compatible = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    for (const [label, generator] of [['Copy CnCTAOpt Link', cnctaOptLink], ['Open CnCTAOpt', cnctaOptLink], ['Copy CNCOpt Link', cncOptLink], ['Open CNCOpt', cncOptLink]]) { const button = new qx.ui.form.Button(label); button.addListener('execute', () => this.output(generator(this.snapshot()), label.startsWith('Open'))); compatible.add(button); }
    root.add(compatible);
    this.preview = new qx.ui.basic.Label('').set({ textColor: '#fff', wrap: true, rich: true }); root.add(this.preview); const selection = this.snapshot(); this.preview.setValue(`<b>Current selection:</b> ${selection.name} (${selection.x}:${selection.y}), L${selection.level}, ${selection.buildings.length} buildings, ${selection.defense.length} defense, ${selection.offense.length} offense`); return root;
  }
  async open(context = this.context) { if (!this.context) await this.enable(context); if (this.record?.window && !this.record.window.isDisposed?.()) { this.record.window.open(); return this.record; } this.record = await this.context.windows.open({ id: 'external-tools', title: 'External Analysis', content: this.build(), x: 180, y: 100, width: 740, height: 510, resizable: true, singleton: true }); return this.record; }
  async disable(context = this.context) { context?.windows?.close?.('external-tools'); this.record = null; this.context = null; }
}
export default ExternalToolsModule;

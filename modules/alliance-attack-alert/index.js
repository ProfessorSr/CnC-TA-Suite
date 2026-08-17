import { Module } from '../../core/interfaces/module.js';

function call(target, names, ...args) { for (const name of names) try { if (typeof target?.[name] === 'function') { const value = target[name](...args); if (value != null) return value; } } catch {} return null; }
function values(collection) { const source = collection?.d ?? collection?.l ?? collection ?? []; return Array.isArray(source) ? source.filter(Boolean) : Object.values(source).filter(Boolean); }
function flatValues(value, output = [], depth = 0) { if (depth > 4 || value == null) return output; if (typeof value !== 'object') { output.push(value); return output; } for (const [key, item] of Object.entries(value)) { output.push(key); flatValues(item, output, depth + 1); } return output; }
function enumName(enumeration, value) { return Object.entries(enumeration ?? {}).find(([, candidate]) => Number(candidate) === Number(value))?.[0] ?? ''; }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function extractNamed(parameters, pattern) {
  if (!parameters || typeof parameters !== 'object') return null;
  for (const entry of values(parameters)) {
    const type = entry?.t ?? entry?.type ?? entry?.name;
    if (pattern.test(String(type ?? '')) && entry?.v != null) {
      const value = Array.isArray(entry.v) ? entry.v[0] : entry.v;
      if (typeof value === 'string' || typeof value === 'number') return value;
    }
  }
  for (const [key, value] of Object.entries(parameters)) {
    if (pattern.test(key) && (typeof value === 'string' || typeof value === 'number')) return value;
    if (value && typeof value === 'object') { const found = extractNamed(value, pattern); if (found != null) return found; }
  }
  return null;
}
export function classifyAllianceAttack(notification, root = globalThis.ClientLib) {
  const category = call(notification, ['get_CategoryId']) ?? notification?.CategoryId ?? notification?.categoryId;
  const mdbId = call(notification, ['get_MdbId']) ?? notification?.MdbId ?? notification?.mdbId;
  const name = enumName(root?.Data?.ENotificationId, mdbId);
  const combat = root?.Data?.ENotificationCategory?.Combat;
  const payload = [name, ...flatValues(call(notification, ['get_Parameters']) ?? notification?.Parameters ?? notification)].join(' ');
  return (combat == null || Number(category) === Number(combat)) && /attack|attacked|combat|defen[cs]e/i.test(payload) && /alliance|ally|member/i.test(payload);
}
export function describeAllianceAttack(notification, root = globalThis.ClientLib) {
  const parameters = call(notification, ['get_Parameters']) ?? notification?.Parameters ?? notification?.parameters ?? notification ?? {};
  const mdbId = call(notification, ['get_MdbId']) ?? notification?.MdbId ?? notification?.mdbId;
  return {
    id: String(call(notification, ['get_Id']) ?? notification?.Id ?? notification?.id ?? `${mdbId}:${Date.now()}`),
    type: enumName(root?.Data?.ENotificationId, mdbId),
    player: String(extractNamed(parameters, /(?:defender|target|player)(?:name)?$/i) ?? 'Alliance member'),
    base: String(extractNamed(parameters, /(?:city|base)(?:name)?$/i) ?? 'Alliance base'),
    baseId: extractNamed(parameters, /(?:city|base)(?:id)$/i),
    x: number(extractNamed(parameters, /^(?:x|posx|coordx)$/i)),
    y: number(extractNamed(parameters, /^(?:y|posy|coordy)$/i)),
    parameters
  };
}

export class AllianceAttackAlertModule extends Module {
  constructor() {
    super({ id: 'alliance-attack-alert', name: 'Alliance Attack Alert', version: '0.1.0', apiVersion: '1.0.0', author: 'ProfessorSr', description: 'Listen for the game’s alliance-member attack event and show a red support alert.', permissions: ['events', 'game', 'notifications', 'windows'], manual: { steps: ['Enable the module; no scanner runs.', 'When the game reports an alliance-member attack, review the red popup.', 'Use Set Support to focus the attacked base and continue in the native game controls.'], controls: [['Set Support', 'Focuses and selects the attacked base for the native support workflow.'], ['Close', 'Dismisses the popup.']] } });
    this.listener = null; this.manager = null; this.popups = new Set(); this.seen = new Set();
  }
  client() { return this.context?.hub?.game?.services?.tryGet?.('clientLib') ?? null; }
  root() { return this.client()?.root ?? globalThis.ClientLib; }
  main() { return this.client()?.getMainData?.() ?? this.root()?.Data?.MainData?.GetInstance?.(); }
  async enable(context) {
    this.context = context; const root = this.root(); this.manager = call(this.main(), ['get_Notifications']);
    const util = globalThis.webfrontend?.phe?.cnc?.Util; const eventType = root?.Data?.NotificationAdded;
    if (!this.manager || !util?.attachNetEvent || eventType == null) throw new Error('The game notification event is unavailable.');
    this.listener = (...args) => this.onNotification(args.find((arg) => typeof arg?.get_MdbId === 'function') ?? args.at(-1));
    util.attachNetEvent(this.manager, 'NotificationAdded', eventType, this, this.listener);
  }
  ownCity() { const cities = call(this.main(), ['get_Cities']); return call(cities, ['get_CurrentOwnCity']) ?? call(cities, ['get_CurrentCity']); }
  distance(attack) { const city = this.ownCity(); const x = number(call(city, ['get_PosX'])), y = number(call(city, ['get_PosY'])); return x != null && y != null && attack.x != null && attack.y != null ? Math.hypot(x - attack.x, y - attack.y) : null; }
  onNotification(notification) {
    if (!notification || !classifyAllianceAttack(notification, this.root())) return;
    const attack = describeAllianceAttack(notification, this.root()); if (this.seen.has(attack.id)) return; this.seen.add(attack.id); if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
    this.showAlert(attack);
  }
  async focusForSupport(attack) {
    if (attack.x == null || attack.y == null) throw new Error('The game alert did not include base coordinates.');
    const scanner = this.context?.hub?.scanner;
    if (scanner?.selectTarget && attack.baseId) await scanner.selectTarget({ id: attack.baseId, x: attack.x, y: attack.y });
    else { const vis = this.root()?.Vis?.VisMain?.GetInstance?.(); vis?.CenterGridPosition?.(attack.x, attack.y); vis?.Update?.(); vis?.ViewUpdate?.(); }
    this.context.notifications.show('Attacked base selected. Use the native Set Support control to confirm support.', { duration: 7000 });
  }
  closePopup(popup) { if (!popup || popup.isDisposed?.()) return; const timer = popup.getUserData?.('suiteTimer'); if (timer) clearTimeout(timer); this.popups.delete(popup); popup.destroy(); this.reposition(); }
  reposition() { let index = 0; for (const popup of this.popups) { const parent = this.context?.windows?.getWindowParent?.(); const bounds = parent?.getBounds?.(); if (bounds) popup.placeToPoint({ left: bounds.width - 20, top: 20 + index * 145 }); index += 1; } }
  showAlert(attack) {
    const qx = globalThis.qx; const popup = new qx.ui.popup.Popup(new qx.ui.layout.VBox(6)).set({ autoHide: false, keepActive: true, padding: 10, width: 340, backgroundColor: '#7d0808', textColor: '#ffffff' });
    popup.add(new qx.ui.basic.Label('<b>ALLIANCE MEMBER UNDER ATTACK</b>').set({ rich: true, textColor: '#ffffff' }));
    const distance = this.distance(attack); popup.add(new qx.ui.basic.Label(`${attack.player}<br>${attack.base}<br>Distance from selected base: ${distance == null ? 'Unknown' : distance.toFixed(2) + ' fields'}`).set({ rich: true, wrap: true, textColor: '#ffffff' }));
    const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(6)); const support = new qx.ui.form.Button('Set Support'); const close = new qx.ui.form.Button('Close'); actions.add(support); actions.add(close); popup.add(actions); support.addListener('execute', () => void this.focusForSupport(attack).catch((error) => this.context.notifications.show(`Set Support handoff failed: ${error.message}`, { duration: 7000 }))); close.addListener('execute', () => this.closePopup(popup)); this.context.windows.getWindowParent().add(popup); this.popups.add(popup); this.reposition(); popup.show(); popup.setUserData('suiteTimer', setTimeout(() => this.closePopup(popup), 10000));
  }
  async open() { this.context.notifications.show('Alliance Attack Alert is active. It waits for the game’s own attack notification; no scanner is running.', { duration: 6000 }); return null; }
  async disable() { const util = globalThis.webfrontend?.phe?.cnc?.Util; if (this.manager && this.listener && util?.detachNetEvent) util.detachNetEvent(this.manager, 'NotificationAdded', this.root()?.Data?.NotificationAdded, this, this.listener); for (const popup of [...this.popups]) this.closePopup(popup); this.listener = null; this.manager = null; this.context = null; }
}
export default AllianceAttackAlertModule;

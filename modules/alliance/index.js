import { Module } from '../../core/interfaces/module.js';
import { AllianceHub } from './alliance-hub.js';
import { AllianceTabs } from './alliance-tabs.js';

export const allianceManifest = Object.freeze({
  id: 'alliance',
  name: 'Alliance Intelligence',
  version: '0.2.0',
  apiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Alliance member, score, POI, and tier intelligence in a Suite window.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['events', 'game', 'notifications', 'settings', 'windows']),
  settings: Object.freeze({
    refreshSeconds: Object.freeze({ type: 'number', default: 10, min: 5, max: 300 })
  })
});

export class AllianceModule extends Module {
  constructor() {
    super(allianceManifest);
    this.context = null;
    this.tabs = null;
  }

  async enable(context) {
    this.context = context;
    this.tabs = new AllianceTabs({ context, hub: new AllianceHub(context) });
    this.alertedCities = new Set();
    context.events.on('game:tick', () => { this.checkPvpAlerts(); this.colorChatRoles(); });
  }

  checkPvpAlerts() {
    const root = this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib;
    const cities = root?.Data?.MainData?.GetInstance?.()?.get_Cities?.()?.get_AllCities?.()?.d ?? {};
    const active = new Set();
    for (const city of Object.values(cities)) {
      if (!city?.get_isAlerted?.()) continue;
      const id = String(city.get_Id?.() ?? city.get_Name?.());
      active.add(id);
      if (!this.alertedCities.has(id)) this.context.notifications?.show?.(`PvP alert: ${city.get_Name?.() ?? 'One of your bases'} is under attack.`);
    }
    this.alertedCities = active;
  }

  colorChatRoles() {
    const members = new Map(this.tabs?.hub?.members?.().map((member) => [member.name, member]) ?? []);
    if (!members.size) return;
    const registry = globalThis.qx?.core?.ObjectRegistry?.getRegistry?.() ?? {};
    for (const widget of Object.values(registry)) {
      const classname = String(widget?.classname ?? widget?.constructor?.classname ?? '');
      if (!/chat/i.test(classname) || typeof widget?.getValue !== 'function') continue;
      const value = String(widget.getValue?.() ?? '');
      const member = [...members.values()].find((item) => value === item.name || value.startsWith(`${item.name}:`));
      if (!member) continue;
      const role = member.role.toLowerCase();
      widget.setTextColor?.(/leader|commander/.test(role) ? '#ffcc33' : /officer/.test(role) ? '#66ccff' : '#7ee787');
    }
  }

  async open(context = this.context) {
    if (!this.tabs) await this.enable(context);
    const content = this.tabs.buildStandalone();
    this.tabs.refresh();
    return context.windows.open({
      id: 'alliance-intelligence',
      title: 'Alliance Intelligence',
      content,
      x: 90,
      y: 80,
      width: 1040,
      height: 650,
      resizable: true,
      singleton: true
    });
  }

  async disable(context = this.context) {
    context?.windows?.close?.('alliance-intelligence');
    this.tabs?.destroy();
    this.tabs = null;
    this.context = null;
  }

  async destroy(context) { await this.disable(context); }
}

export default AllianceModule;

import { Module } from '../../core/interfaces/module.js';
import { WarRoomHub } from '../war-room/war-room-hub.js';
import { SuperSimulatorWindow } from './super-simulator-window.js';

export const superSimulatorManifest = Object.freeze({
  id: 'super-simulator', name: 'Super Simulator', version: '0.2.0', apiVersion: '1.0.0', hubApiVersion: '1.0.0',
  author: 'ProfessorSr', lastUpdated: '2026-08-10',
  description: 'Experimental greedy one-troop-at-a-time native formation optimizer.',
  dependencies: Object.freeze([]), permissions: Object.freeze(['events', 'game', 'notifications', 'windows']), settings: Object.freeze({})
});

export class SuperSimulatorModule extends Module {
  constructor() { super(superSimulatorManifest); this.window = null; }
  async enable(context) { this.window = new SuperSimulatorWindow({ context, hub: new WarRoomHub(context) }); }
  async open(context) { if (!this.window) await this.enable(context); return this.window.open(); }
  async disable(context) { this.window?.stop?.(); context?.windows?.close?.('super-simulator'); this.window = null; }
  async destroy(context) { await this.disable(context); }
}

export default SuperSimulatorModule;

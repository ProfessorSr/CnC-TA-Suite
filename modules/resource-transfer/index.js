import { Module } from '../../core/interfaces/module.js';
import { ResourceTransferHub } from './resource-transfer-hub.js';
import { ResourceTransferWindow } from './resource-transfer-window.js';
import { SuppliesIntegration } from './supplies-integration.js';

const settings = Object.freeze({
  requireConfirmation: Object.freeze({ type: 'boolean', default: true }),
  reserveAmount: Object.freeze({ type: 'number', default: 0, min: 0, max: 1000000000000000 }),
  defaultSuppliesTab: Object.freeze({ type: 'boolean', default: true }),
  disableFundsInSupplies: Object.freeze({ type: 'boolean', default: false }),
  quickTransferProfiles: Object.freeze({ type: 'object', default: Object.freeze({}) })
});

function percentage(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

export function normalizeQuickTransferProfile(profile = {}) {
  const mode = ['all', 'crystal', 'tiberium', 'custom'].includes(profile.mode) ? profile.mode : 'all';
  const customTiberium = percentage(profile.tiberiumPercent, 100);
  const customCrystal = percentage(profile.crystalPercent, 100);
  const effective = mode === 'all' ? { tiberiumPercent: 100, crystalPercent: 100 }
    : mode === 'crystal' ? { tiberiumPercent: 0, crystalPercent: 100 }
      : mode === 'tiberium' ? { tiberiumPercent: 100, crystalPercent: 0 }
        : { tiberiumPercent: customTiberium, crystalPercent: customCrystal };
  return Object.freeze({ mode, customTiberium, customCrystal, ...effective });
}

export const resourceTransferManifest = Object.freeze({
  id: 'resource-transfer',
  name: 'Resource Transfer Manager',
  version: '0.2.0',
  apiVersion: '1.0.0',
  author: 'ProfessorSr',
  description: 'Plan and manually execute safe resource transfers between owned bases.',
  dependencies: Object.freeze([]),
  permissions: Object.freeze(['game', 'notifications', 'settings', 'windows']),
  settings
});

export class ResourceTransferModule extends Module {
  constructor() {
    super(resourceTransferManifest);
    this.context = null;
    this.hub = null;
    this.supplies = null;
    this.window = null;
  }

  async enable(context) {
    this.context = context;
    this.hub = new ResourceTransferHub(context);
    this.supplies = new SuppliesIntegration(context);
    this.supplies.install();
    this.window = new ResourceTransferWindow({
      context,
      hub: this.hub,
      supplies: this.supplies,
      execute: (plan) => this.execute(plan),
      getQuickProfiles: () => this.context.moduleSettings.get('quickTransferProfiles', {}),
      saveQuickProfile: (destinationId, profile) => this.saveQuickProfile(destinationId, profile)
    });
  }

  async execute(plan, { notify = true } = {}) {
    const accepted = await this.hub.execute(plan);
    for (const item of accepted) {
      this.window?.addActivity?.(
        `${item.source} → ${item.destination} — ${Math.floor(item.amount).toLocaleString()} ${plan.resourceName}`
      );
    }
    const message = accepted.length
      ? `Submitted ${accepted.length} manual transfer${accepted.length === 1 ? '' : 's'}.`
      : 'No eligible transfers were submitted.';
    if (notify) this.context.notifications?.show?.(message);
    return accepted;
  }

  async open(context) {
    if (!this.window) await this.enable(context);
    return this.window.open();
  }

  quickTransferProfile(destinationId) {
    const profiles = this.context.moduleSettings.get('quickTransferProfiles', {});
    return normalizeQuickTransferProfile(profiles?.[String(destinationId)]);
  }

  async saveQuickProfile(destinationId, profile) {
    const profiles = this.context.moduleSettings.get('quickTransferProfiles', {});
    const next = {
      ...profiles,
      [String(destinationId)]: {
        mode: profile.mode,
        tiberiumPercent: percentage(profile.tiberiumPercent, 100),
        crystalPercent: percentage(profile.crystalPercent, 100)
      }
    };
    await this.context.moduleSettings.set('quickTransferProfiles', next);
    return normalizeQuickTransferProfile(next[String(destinationId)]);
  }

  quickTransferPlans() {
    const destinationId = this.hub.snapshot('tiberium').currentDestinationId;
    if (!destinationId) throw new Error('Open an owned base before transferring resources.');
    const profile = this.quickTransferProfile(destinationId);
    return [
      ['tiberium', profile.tiberiumPercent],
      ['crystal', profile.crystalPercent]
    ].filter(([, percent]) => percent > 0).map(([resourceName, percent]) => {
      const snapshot = this.hub.snapshot(resourceName);
      const plan = this.hub.plan({
        destinationId,
        sourceIds: snapshot.cities.map((city) => city.id),
        resourceName,
        reserveAmount: 0,
        fraction: percent / 100
      });
      return { ...plan, quickPercent: percent, quickMode: profile.mode };
    });
  }

  async openQuickTransfer() {
    if (!this.hub) throw new Error('Resource Transfer Manager is not enabled.');
    const existing = this.context.windows?.windows?.get?.('resource-transfer-quick');
    if (existing?.window && !existing.window.isDisposed?.()) {
      this.context.windows.close('resource-transfer-quick');
      return null;
    }
    const qx = globalThis.qx;
    const plans = this.quickTransferPlans();
    if (!plans.length) throw new Error('The current base Quick Transfer profile has both resources set to 0%.');
    const destination = plans[0].destination.name;
    const totalCost = plans.reduce((sum, plan) => sum + plan.totalCost, 0);
    const credits = plans[0].credits;
    const content = new qx.ui.container.Composite(new qx.ui.layout.VBox(9)).set({ padding: 12 });
    const title = new qx.ui.basic.Label(`Quick transfer to ${destination}`).set({
      font: 'bold', textColor: '#ffffff', wrap: true
    });
    content.add(title);
    for (const plan of plans) {
      content.add(new qx.ui.basic.Label(
        `${plan.resourceName === 'crystal' ? 'Crystal' : 'Tiberium'} (${plan.quickPercent}%): `
        + `${Math.floor(plan.totalAmount).toLocaleString()} from `
        + `${plan.entries.filter((entry) => entry.eligible && entry.amount > 0).length} base(s) · `
        + `${Math.floor(plan.totalCost).toLocaleString()} Credits`
      ).set({ textColor: '#ffffff' }));
    }
    content.add(new qx.ui.basic.Label(
      `Total transfer cost: ${Math.floor(totalCost).toLocaleString()} Credits · `
      + `Available: ${Math.floor(credits).toLocaleString()}`
    ).set({ textColor: totalCost <= credits ? '#7ee787' : '#ff6060', font: 'bold' }));
    content.add(new qx.ui.basic.Label(
      'Nothing is transferred until you click Confirm Transfer.'
    ).set({ textColor: '#ffffff', wrap: true }));
    const actions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    const cancel = new qx.ui.form.Button('Cancel');
    const confirm = new qx.ui.form.Button('Confirm Transfer').set({
      enabled: totalCost <= credits && plans.some((plan) => plan.totalAmount > 0)
    });
    actions.add(new qx.ui.core.Spacer(), { flex: 1 }); actions.add(cancel); actions.add(confirm);
    content.add(actions);
    cancel.addListener('execute', () => this.context.windows.close('resource-transfer-quick'));
    confirm.addListener('execute', async () => {
      confirm.setEnabled(false);
      let submitted = 0;
      try {
        for (const plan of plans) {
          // A configured resource with nothing currently transferable is a
          // normal no-op; it must not prevent the other resource from moving.
          if (plan.totalAmount <= 0 || !plan.entries.some((entry) => entry.eligible && entry.amount > 0)) continue;
          submitted += (await this.execute(plan, { notify: false })).length;
        }
        this.context.notifications?.show?.(`Submitted ${submitted} transfer(s) to ${destination}.`);
        this.context.windows.close('resource-transfer-quick');
      } catch (error) {
        this.context.notifications?.show?.(`Transfer failed: ${error?.message ?? error}`);
        if (!confirm.isDisposed?.()) confirm.setEnabled(true);
      }
    });
    return this.context.windows.open({
      id: 'resource-transfer-quick', title: 'Transfer All Resources', content,
      x: 690, y: 120, width: 430, height: 275, resizable: false, singleton: true
    });
  }

  async disable(context) {
    context?.windows?.close?.('resource-transfer');
    context?.windows?.close?.('resource-transfer-quick');
    this.supplies?.destroy?.();
    this.context = null;
    this.hub = null;
    this.supplies = null;
    this.window = null;
  }

  async destroy(context) { await this.disable(context); }
}

export default ResourceTransferModule;

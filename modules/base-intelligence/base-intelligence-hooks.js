const ONLINE_COLORS = Object.freeze({ 0: '#ff6060', 1: '#b700ff', 2: '#ffff00', 3: '#c2c2c2' });

function compact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 1000) return Math.round(number).toLocaleString();
  if (Math.abs(number) < 1e6) return `${(number / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  if (Math.abs(number) < 1e9) return `${(number / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
  return `${(number / 1e9).toFixed(1).replace(/\.0$/, '')}b`;
}

function duration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const RESOURCE_STYLE = Object.freeze({
  tiberium: Object.freeze({ label: 'Tiberium', color: '#176f35', icon: 'webfrontend/ui/common/icn_res_tiberium.png' }),
  crystal: Object.freeze({ label: 'Crystal', color: '#006b91', icon: 'webfrontend/ui/common/icn_res_chrystal.png' }),
  gold: Object.freeze({ label: 'Credits', color: '#805d00', icon: 'webfrontend/ui/common/icn_res_dollar.png' }),
  credits: Object.freeze({ label: 'Credits', color: '#805d00', icon: 'webfrontend/ui/common/icn_res_dollar.png' }),
  researchpoints: Object.freeze({ label: 'Research', color: '#075d98', icon: 'webfrontend/ui/common/icn_res_research.png' }),
  repairchargebase: Object.freeze({ label: 'Repair', color: '#44545c', icon: 'webfrontend/ui/icons/icn_repair_points.png' }),
  repairchargeinf: Object.freeze({ label: 'Infantry RT', color: '#44545c', icon: 'webfrontend/ui/icons/icon_res_repair_inf.png' }),
  repairchargeveh: Object.freeze({ label: 'Vehicle RT', color: '#44545c', icon: 'webfrontend/ui/icons/icon_res_repair_tnk.png' }),
  repairchargeair: Object.freeze({ label: 'Aircraft RT', color: '#44545c', icon: 'webfrontend/ui/icons/icon_res_repair_air.png' })
});

function resourceStyle(name) {
  const key = String(name ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return RESOURCE_STYLE[key] ?? { label: String(name ?? 'Resource').replace(/([a-z])([A-Z])/g, '$1 $2'), color: '#334850', icon: 'webfrontend/ui/common/icn_res_power.png' };
}

function resourceIcon(path) {
  const uri = globalThis.qx?.util?.ResourceManager?.getInstance?.()?.toUri?.(path) ?? path;
  return `<img src="${escapeHtml(uri)}" width="17" height="17" style="vertical-align:middle;margin-right:3px">`;
}

function resourceGrid(entries, divisor = 1, emphasize = false) {
  if (!entries.length) return '<span style="color:#aeb9bf">Waiting for target combat data…</span>';
  const cells = entries.map((entry) => {
    const style = resourceStyle(entry.name);
    return `<td style="padding:2px 12px 2px 0;white-space:nowrap;color:${style.color};${emphasize ? 'font-weight:bold' : ''}">`
      + `${resourceIcon(style.icon)}${escapeHtml(style.label)} <b>${compact(entry.amount / Math.max(1, divisor))}</b></td>`;
  });
  const rows = [];
  for (let index = 0; index < cells.length; index += 3) rows.push(`<tr>${cells.slice(index, index + 3).join('')}</tr>`);
  return `<table cellspacing="0" cellpadding="0" style="font-size:12px">${rows.join('')}</table>`;
}

function section(title, icon, content, accent = '#006c91') {
  return `<div style="margin-top:6px;padding-top:5px;border-top:1px solid #91a5ad">`
    + `<div style="margin-bottom:3px;color:${accent};font-weight:bold;font-size:13px">${icon} ${escapeHtml(title)}</div>`
    + content + '</div>';
}

export class BaseIntelligenceHooks {
  constructor({ context, hub }) { this.context = context; this.hub = hub; this.ids = []; }

  onlineState(city) {
    try {
      const alliance = this.hub.main()?.get_Alliance?.();
      const members = alliance?.get_MemberData?.()?.d ?? alliance?.get_MemberData?.() ?? {};
      const playerId = city?.raw?.get_PlayerId?.() ?? city?.raw?.get_OwnerId?.();
      const state = members?.[playerId]?.OnlineState;
      return { state, color: ONLINE_COLORS[state] ?? '#c2c2c2', label: ['Offline', 'Online', 'Away', 'Hidden'][state] ?? 'Unknown' };
    } catch { return { state: null, color: '#c2c2c2', label: 'Unknown' }; }
  }

  installTooltip(className) {
    const prototype = globalThis.webfrontend?.gui?.region?.[className]?.prototype;
    const original = prototype?.onCitiesChange;
    if (typeof original !== 'function') return false;
    const hooks = this;
    function onCitiesChangeWithBaseIntelligence(...args) {
      const result = original.apply(this, args);
      try {
        if (!hooks.context.moduleSettings.get('showRegionDetails', true)) {
          this.__suiteBaseIntelligence?.exclude?.();
          return result;
        }
        const city = hooks.hub.selectedPlayerCity();
        if (!city) return result;
        if (!this.__suiteBaseIntelligence || this.__suiteBaseIntelligence.isDisposed?.()) {
          this.__suiteBaseIntelligence = new globalThis.qx.ui.basic.Label('').set({ rich: true, wrap: true, paddingTop: 6 });
          this.add(this.__suiteBaseIntelligence);
        }
        const online = hooks.onlineState(city);
        const onlineText = hooks.context.moduleSettings.get('showOnlineColors', true)
          ? ` · <span style="color:${online.color}">${online.label}</span>` : '';
        this.__suiteBaseIntelligence.setValue(
          `<b>Suite Base Intelligence</b>${onlineText}<br>`
          + `Base ${city.baseLevel.toFixed(2)} · Offense ${city.offenseLevel.toFixed(2)} · Defense ${city.defenseLevel.toFixed(2)}<br>`
          + `Repair: INF ${Math.round(city.repair.infantry.timeSeconds)}s · VEH ${Math.round(city.repair.vehicle.timeSeconds)}s · AIR ${Math.round(city.repair.aircraft.timeSeconds)}s`
        );
        this.__suiteBaseIntelligence.setTextColor('#ffffff');
        this.__suiteBaseIntelligence.show();
      } catch (error) { hooks.context.logger?.warn?.(`Unable to enrich ${className}.`, error); }
      return result;
    }
    prototype.onCitiesChange = onCitiesChangeWithBaseIntelligence;
    const id = `base-intelligence:${className}`;
    this.context.hooks.register(id, () => {
      if (prototype.onCitiesChange === onCitiesChangeWithBaseIntelligence) prototype.onCitiesChange = original;
    }, { replace: true });
    this.ids.push(id);
    return true;
  }

  installTargetTooltip(className) {
    const statusInfo = globalThis.webfrontend?.gui?.region?.[className]?.getInstance?.();
    const prototype = globalThis.webfrontend?.gui?.region?.[className]?.prototype;
    const original = prototype?.onCitiesChange;
    if (!statusInfo?.addListener || typeof original !== 'function') return false;
    const hookId = `base-intelligence:${className}:appear`;
    const hooks = this;
    let retryTimer = null;
    let refreshGeneration = 0;

    const refresh = (widget, attempt = 0, generation = refreshGeneration) => {
      try {
        if (generation !== refreshGeneration || widget?.isDisposed?.()) return;
        if (!hooks.context.moduleSettings.get('showRegionDetails', true)) {
          widget.__suiteTargetIntelligence?.exclude?.();
          return;
        }
        // These status widgets are singletons. The selected object is stored on the
        // widget itself; its layout parent is not the selected map object in current
        // game builds.
        const visObject = widget._selectedObject
          ?? widget.getSelectedObject?.()
          ?? widget.getLayoutParent?.()?.getObject?.();
        if (!visObject) return;
        const intel = hooks.hub.regionTargetIntel(visObject);
        if (!widget.__suiteTargetIntelligence || widget.__suiteTargetIntelligence.isDisposed?.()) {
          widget.__suiteTargetIntelligence = new globalThis.qx.ui.basic.Label('').set({
            rich: true, wrap: true, paddingTop: 8, textColor: '#ffffff'
          });
          widget.add(widget.__suiteTargetIntelligence);
        }
        const repairLimit = Number.isFinite(intel.repairAttacks)
          ? `${intel.repairAttacks} attacks`
          : 'not limiting attacks';
        const levels = Object.entries(intel.levels)
          .sort(([left], [right]) => Number(right) - Number(left))
          .map(([level, count]) => `${count} × ${level}`).join(', ') || 'None';
        const attackContent = `<div><span style="color:#17262d;font-weight:bold">${escapeHtml(intel.attacker)}</span>`
          + ` can make <span style="color:#176f35;font-weight:bold;font-size:14px">${intel.possibleAttacks} estimated attacks</span></div>`
          + `<div style="color:#2e414a">Command points: <b>${intel.cpAttacks}</b> attacks · Repair capacity: <b>${escapeHtml(repairLimit)}</b></div>`
          + `<div style="color:#006b91">Available CP <b>${compact(intel.cpAvailable)}</b> · Cost per attack <b>${compact(intel.cpCost)}</b></div>`
          + `<div style="color:#725900">Max repair estimate <b>${duration(intel.maxRepairCostSeconds)}</b> · Stored <b>${duration(intel.repairAvailableSeconds)}</b></div>`
          + '<div style="color:#53656d;font-size:11px">Conservative estimate using the largest offense-group repair cost.</div>';
        const lootContent = resourceGrid(intel.loot, 1, true)
          + `<table cellspacing="0" cellpadding="0" style="margin-top:4px;font-size:11px;color:#334850">`
          + `<tr><td style="width:65px;color:#006b91;font-weight:bold">Per CP</td><td>${resourceGrid(intel.loot, intel.cpCost)}</td></tr>`
          + `<tr><td style="color:#006b91;font-weight:bold">2nd run</td><td>${resourceGrid(intel.loot, intel.cpCost * 2)}</td></tr>`
          + `<tr><td style="color:#006b91;font-weight:bold">3rd run</td><td>${resourceGrid(intel.loot, intel.cpCost * 3)}</td></tr></table>`;
        const waveContent = `<div style="color:#2e414a">Full attack range: <b style="color:#17262d">${intel.forgotten}</b> Forgotten bases</div>`
          + `<div style="color:#2e414a">Core range: <b style="color:#17262d">${intel.innerForgotten}</b> · Estimated waves: <b style="color:#176f35">${intel.waves}</b></div>`
          + `<div style="color:#006b91">Levels: <b>${escapeHtml(levels)}</b></div>`;
        widget.__suiteTargetIntelligence.setValue(
          '<div style="margin-top:5px;padding:4px 9px 9px;background:#c8d3d7;color:#17262d;'
          + 'border-top:3px solid #edf5f7;border-bottom:5px solid #667a83;'
          + 'border-left:1px solid #91a5ad;border-right:1px solid #91a5ad;border-radius:7px 7px 5px 5px">'
          + section('Attack Capacity', '⚔', attackContent, '#176f35')
          + section('Lootable Resources', '◆', lootContent, '#006b91')
          + section('Nearby Forgotten & Waves', '◉', waveContent, '#725900')
          + '</div>'
        );
        widget.__suiteTargetIntelligence.show();

        // Loot is populated asynchronously after selecting a Forgotten target.
        // Retry against the same selection instead of leaving the permanent
        // "Unavailable" message rendered by the first onCitiesChange call.
        if (!intel.loot.length && attempt < 30) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => refresh(widget, attempt + 1, generation), 100);
        }
      } catch (error) {
        hooks.context.logger?.warn?.(`Unable to enrich ${className}.`, error);
      }
    };

    function onCitiesChangeWithTargetIntelligence(...args) {
      const result = original.apply(this, args);
      clearTimeout(retryTimer);
      refreshGeneration += 1;
      refresh(this, 0, refreshGeneration);
      return result;
    }
    prototype.onCitiesChange = onCitiesChangeWithTargetIntelligence;

    const listenerId = statusInfo.addListener('appear', () => {
      clearTimeout(retryTimer);
      refreshGeneration += 1;
      refresh(statusInfo, 0, refreshGeneration);
    });
    this.context.hooks.register(hookId, () => {
      clearTimeout(retryTimer);
      refreshGeneration += 1;
      if (prototype.onCitiesChange === onCitiesChangeWithTargetIntelligence) prototype.onCitiesChange = original;
      if (!statusInfo.isDisposed?.()) statusInfo.removeListenerById?.(listenerId);
      statusInfo.__suiteTargetIntelligence?.destroy?.();
      statusInfo.__suiteTargetIntelligence = null;
    }, { replace: true });
    this.ids.push(hookId);
    return true;
  }

  install() {
    let count = 0;
    for (const name of ['RegionCityStatusInfoOwn', 'RegionCityStatusInfoAlliance', 'RegionCityStatusInfoEnemy']) {
      if (!this.ids.includes(`base-intelligence:${name}`) && this.installTooltip(name)) count += 1;
    }
    for (const name of [
      'RegionCityStatusInfoAlliance', 'RegionCityStatusInfoEnemy',
      'RegionNPCBaseStatusInfo', 'RegionNPCCampStatusInfo', 'RegionRuinStatusInfo'
    ]) {
      const id = `base-intelligence:${name}:appear`;
      if (!this.ids.includes(id) && this.installTargetTooltip(name)) count += 1;
    }
    return count;
  }

  destroy() {
    // Hooks on the same game method are stacked; unwind them in reverse order so
    // every wrapper can restore the function it originally received.
    for (const id of [...this.ids].reverse()) this.context.hooks.uninstall(id);
    this.ids = [];
  }
}

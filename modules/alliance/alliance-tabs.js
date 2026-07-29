function number(value) { return Math.round(Number(value) || 0).toLocaleString(); }

function table(qx, columns, widths) {
  const model = new qx.ui.table.model.Simple();
  model.setColumns(columns);
  const widget = new qx.ui.table.Table(model).set({
    statusBarVisible: true,
    columnVisibilityButtonVisible: true
  });
  widths.forEach((width, index) => widget.getTableColumnModel().setColumnWidth(index, width));
  return { model, widget };
}

function page(qx, title) {
  return new qx.ui.tabview.Page(title).set({
    layout: new qx.ui.layout.VBox(7), padding: 8
  });
}

export class AllianceTabs {
  constructor({ context, hub }) {
    this.context = context;
    this.hub = hub;
    this.pages = [];
    this.tabView = null;
    this.standalone = null;
  }

  buildStandalone() {
    const qx = globalThis.qx;
    if (this.standalone && !this.standalone.isDisposed?.()) return this.standalone;
    this.pages = [];
    this.standalone = new qx.ui.tabview.TabView();
    for (const pageWidget of this.build()) this.standalone.add(pageWidget);
    this.tabView = this.standalone;
    return this.standalone;
  }

  build() {
    const qx = globalThis.qx;
    const overviewPage = page(qx, 'Suite Overview');
    this.overview = table(qx, ['Information', 'Value'], [220, 360]);
    overviewPage.add(this.overview.widget, { flex: 1 });

    const membersPage = page(qx, 'Suite Members');
    this.members = table(qx, ['Status', 'Role', 'Member', 'Score', 'Rank', 'Bases', 'PvP', 'PvE', 'PvP kills', 'PvE kills', 'Veteran', 'Event'], [75, 105, 155, 95, 55, 55, 80, 80, 75, 75, 75, 75]);
    membersPage.add(this.members.widget, { flex: 1 });
    const copyBases = new qx.ui.form.Button('Copy Owned Base Intel for Alliance');
    copyBases.addListener('execute', async () => {
      const text = this.hub.exportOwnedBases();
      if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
      else globalThis.prompt?.('Copy owned base intel', text);
    });
    membersPage.add(copyBases);

    const poisPage = page(qx, 'Suite POIs');
    this.poiSummary = new qx.ui.basic.Label('Loading POIs…').set({ font: 'bold', textColor: '#ffffff' });
    poisPage.add(this.poiSummary);
    this.pois = table(qx, ['POI Type', 'Level', 'Score', 'Player', 'Base', 'Coordinates', 'Sector'], [175, 60, 90, 145, 145, 100, 85]);
    poisPage.add(this.pois.widget, { flex: 1 });
    const poiActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    const focusPoi = new qx.ui.form.Button('Focus Selected POI');
    const copyPois = new qx.ui.form.Button('Copy Owned POIs (CSV)');
    const exportScope = new qx.ui.form.SelectBox().set({ width: 150 });
    for (const [name, id] of [['Alliance-owned', 'alliance'], ['Free / unowned', 'free'], ['All loaded POIs', 'all']]) exportScope.add(new qx.ui.form.ListItem(name, null, id));
    focusPoi.addListener('execute', () => {
      const row = this.pois.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
      try { this.hub.focusPoi(this.poiRows?.[row]); }
      catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    });
    copyPois.addListener('execute', async () => {
      const text = this.hub.exportPois(exportScope.getSelection()[0]?.getModel() ?? 'alliance');
      try {
        if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
        else globalThis.prompt?.('Copy owned POIs', text);
        this.context.notifications?.show?.(`${this.poiRows?.length ?? 0} owned POIs copied.`);
      } catch (error) { this.context.notifications?.show?.(`POI export failed: ${error?.message ?? error}`); }
    });
    poiActions.add(focusPoi); poiActions.add(exportScope); poiActions.add(copyPois); poisPage.add(poiActions);

    const analysisPage = page(qx, 'Suite POI Analysis');
    this.analysis = table(qx, ['POI Type', 'Rank', 'Multiplier', 'Score', 'Current Bonus', 'Below Alliance', 'Above Alliance', 'Previous Tier', 'Next Tier', 'Tier Shortfall'], [145, 55, 75, 85, 100, 100, 100, 90, 90, 100]);
    analysisPage.add(this.analysis.widget, { flex: 1 });

    const plannerPage = page(qx, 'Suite POI Planner');
    this.poiChanges = [];
    const plannerControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    this.poiType = new qx.ui.form.SelectBox().set({ width: 210 });
    this.poiLevel = new qx.ui.form.Spinner(1, 20, 80).set({ width: 75 });
    const addPoi = new qx.ui.form.Button('Propose Add');
    const removePoi = new qx.ui.form.Button('Propose Remove');
    const resetPoi = new qx.ui.form.Button('Reset Plan');
    plannerControls.add(this.poiType); plannerControls.add(this.poiLevel); plannerControls.add(addPoi); plannerControls.add(removePoi); plannerControls.add(resetPoi);
    plannerPage.add(plannerControls);
    this.poiPlan = table(qx, ['POI Type', 'Current Score', 'Projected Score', 'Current Bonus', 'Projected Bonus', 'Real Gain/Loss'], [180, 110, 110, 110, 115, 110]);
    plannerPage.add(this.poiPlan.widget, { flex: 1 });
    const planSummary = new qx.ui.basic.Label('Planning is read-only and never changes alliance POIs.').set({ textColor: '#ffffff' });
    plannerPage.add(planSummary);
    const addChange = (action) => {
      const selected = this.poiType.getSelection()[0];
      const typeId = selected?.getModel();
      const score = Number(globalThis.ClientLib?.Base?.PointOfInterestTypes?.GetScoreByLevel?.(this.poiLevel.getValue()) ?? 0);
      if (typeId == null || !score) return;
      this.poiChanges.push({ action, typeId, level: this.poiLevel.getValue(), score });
      this.refreshPoiPlan();
    };
    addPoi.addListener('execute', () => addChange('add'));
    removePoi.addListener('execute', () => addChange('remove'));
    resetPoi.addListener('execute', () => { this.poiChanges = []; this.refreshPoiPlan(); });

    const invitationsPage = page(qx, 'Invitations');
    const searchControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    this.inviteMode = new qx.ui.form.SelectBox().set({ width: 180 });
    for (const [label, model] of [
      ['Top-ranked players', 'top'], ['Players without alliance', 'no-alliance'],
      ['Players in alliance', 'alliance']
    ]) this.inviteMode.add(new qx.ui.form.ListItem(label, null, model));
    this.inviteAlliance = new qx.ui.form.SelectBox().set({ width: 220, enabled: false });
    this.inviteLimit = new qx.ui.form.Spinner(1, 100, 3000).set({ width: 85 });
    this.inviteSearch = new qx.ui.form.Button('Search');
    searchControls.add(new qx.ui.basic.Label('Find:').set({ alignY: 'middle' }));
    searchControls.add(this.inviteMode);
    searchControls.add(this.inviteAlliance);
    searchControls.add(new qx.ui.basic.Label('Ranked results:').set({ alignY: 'middle' }));
    searchControls.add(this.inviteLimit);
    searchControls.add(this.inviteSearch);
    invitationsPage.add(searchControls);

    const filters = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    this.inviteTextFilter = new qx.ui.form.TextField().set({ placeholder: 'Filter player or alliance', width: 200 });
    this.inviteMinBases = new qx.ui.form.Spinner(0, 0, 100).set({ width: 70 });
    this.inviteMinScore = new qx.ui.form.Spinner(0, 0, 1000000000000).set({ width: 115 });
    this.inviteMinOffense = new qx.ui.form.Spinner(0, 0, 100).set({ width: 70 });
    this.inviteMinDefense = new qx.ui.form.Spinner(0, 0, 100).set({ width: 70 });
    for (const [label, widget] of [
      ['Filter:', this.inviteTextFilter], ['Bases ≥', this.inviteMinBases],
      ['Score ≥', this.inviteMinScore], ['Offense ≥', this.inviteMinOffense],
      ['Defense ≥', this.inviteMinDefense]
    ]) { filters.add(new qx.ui.basic.Label(label).set({ alignY: 'middle' })); filters.add(widget); }
    invitationsPage.add(filters);

    this.invites = table(qx, ['Rank', 'Player', 'Alliance', 'Bases', 'Score', 'Offense', 'Defense', 'Faction'], [65, 175, 180, 65, 115, 75, 75, 75]);
    this.invites.widget.getSelectionModel().setSelectionMode(
      qx.ui.table.selection.Model.MULTIPLE_INTERVAL_SELECTION
    );
    invitationsPage.add(this.invites.widget, { flex: 1 });
    const inviteActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    this.inviteStatus = new qx.ui.basic.Label('Search world rankings to find candidates.').set({ textColor: '#ffffff', rich: true });
    this.sendInvites = new qx.ui.form.Button('Send Selected Invitations').set({ enabled: false });
    inviteActions.add(this.inviteStatus, { flex: 1 }); inviteActions.add(this.sendInvites);
    invitationsPage.add(inviteActions);

    this.inviteMode.addListener('changeSelection', () => {
      this.inviteAlliance.setEnabled(this.inviteMode.getSelection()[0]?.getModel() === 'alliance');
    });
    const applyInviteFilters = () => this.refreshInvitationRows();
    for (const widget of [this.inviteTextFilter, this.inviteMinBases, this.inviteMinScore, this.inviteMinOffense, this.inviteMinDefense]) {
      widget.addListener('changeValue', applyInviteFilters);
    }
    this.invites.widget.getSelectionModel().addListener('changeSelection', () => this.refreshInviteSelection());
    this.inviteSearch.addListener('execute', () => this.searchInvitations());
    this.sendInvites.addListener('execute', () => this.sendSelectedInvitations());

    this.pages = [overviewPage, membersPage, poisPage, analysisPage, plannerPage, invitationsPage];
    return this.pages;
  }

  async loadInvitationAlliances() {
    if (this.inviteAllianceLoaded || !this.inviteAlliance) return;
    try {
      const alliances = await this.hub.rankedAlliances();
      for (const alliance of alliances) {
        const item = new globalThis.qx.ui.form.ListItem(`${alliance.rank}. ${alliance.name}`, null, alliance.id);
        item.setUserData('allianceName', alliance.name);
        this.inviteAlliance.add(item);
      }
      this.inviteAllianceLoaded = true;
    } catch (error) {
      this.context.logger?.warn?.('Unable to load alliance invitation choices.', error);
    }
  }

  async searchInvitations() {
    const selectedAlliance = this.inviteAlliance.getSelection()[0];
    const mode = this.inviteMode.getSelection()[0]?.getModel() ?? 'top';
    this.inviteSearch.setEnabled(false);
    this.inviteStatus.setValue('Searching world player rankings…');
    try {
      this.invitationRows = await this.hub.searchPlayers({
        mode, limit: this.inviteLimit.getValue(), allianceId: selectedAlliance?.getModel(),
        allianceName: selectedAlliance?.getUserData('allianceName')
      });
      this.refreshInvitationRows();
    } catch (error) {
      this.invitationRows = [];
      this.refreshInvitationRows();
      this.inviteStatus.setValue(`Search failed: ${error?.message ?? error}`);
      this.context.logger?.warn?.('Alliance invitation search failed.', error);
    } finally { this.inviteSearch.setEnabled(true); }
  }

  refreshInvitationRows() {
    if (!this.invites) return;
    const query = String(this.inviteTextFilter?.getValue?.() ?? '').trim().toLowerCase();
    this.filteredInvitationRows = (this.invitationRows ?? []).filter((player) =>
      (!query || `${player.name} ${player.alliance}`.toLowerCase().includes(query))
      && player.bases >= this.inviteMinBases.getValue()
      && player.score >= this.inviteMinScore.getValue()
      && player.offense >= this.inviteMinOffense.getValue()
      && player.defense >= this.inviteMinDefense.getValue()
    );
    this.invites.model.setData(this.filteredInvitationRows.map((player) => [
      player.rank, player.name, player.alliance || 'No alliance', player.bases,
      player.score, player.offense, player.defense, player.faction || '—'
    ]));
    this.refreshInviteSelection();
  }

  selectedInvitationPlayers() {
    const selection = this.invites.widget.getSelectionModel();
    const selected = [];
    selection.iterateSelection((index) => {
      const row = this.invites.model.getRowData(index);
      const player = this.filteredInvitationRows?.find((item) => item.name === row?.[1]);
      if (player) selected.push(player);
    });
    return selected;
  }

  refreshInviteSelection() {
    if (!this.inviteStatus) return;
    const capacity = this.hub.invitationCapacity();
    const selected = this.selectedInvitationPlayers();
    this.sendInvites.setEnabled(selected.length > 0 && selected.length <= capacity.available);
    this.inviteStatus.setValue(
      `${this.filteredInvitationRows?.length ?? 0} candidates · ${selected.length} selected · `
      + `${capacity.available} invitation slot(s) available (${capacity.members}/${capacity.maximum} members, ${capacity.pending} pending).`
    );
  }

  async sendSelectedInvitations() {
    const players = this.selectedInvitationPlayers();
    const capacity = this.hub.invitationCapacity();
    if (!players.length || players.length > capacity.available) return;
    const confirmed = globalThis.confirm?.(
      `Send ${players.length} alliance invitation(s)?\n\n${players.map((player) => player.name).join(', ')}`
    ) ?? false;
    if (!confirmed) return;
    this.sendInvites.setEnabled(false);
    let sent = 0;
    const failed = [];
    for (const player of players) {
      try { await this.hub.invitePlayer(player); sent += 1; }
      catch (error) { failed.push(`${player.name}: ${error?.message ?? error}`); }
    }
    this.inviteStatus.setValue(`${sent} invitation(s) sent${failed.length ? ` · ${failed.length} failed` : ''}.`);
    if (failed.length) this.context.notifications?.show?.(`Alliance invitations: ${failed.join(' | ')}`);
    else this.context.notifications?.show?.(`${sent} alliance invitation(s) sent.`);
    this.invites.widget.getSelectionModel().resetSelection();
    this.refreshInviteSelection();
  }

  findTabView() {
    try {
      const qx = globalThis.qx;
      const Overlay = globalThis.webfrontend?.gui?.alliance?.AllianceOverlay;
      if (!Overlay) return null;
      const registry = qx.core?.ObjectRegistry?.getRegistry?.() ?? {};
      const overlay = Object.values(registry).find((candidate) => candidate instanceof Overlay);
      if (!overlay) return null;
      const queue = [overlay];
      const tabViews = [];
      while (queue.length) {
        const widget = queue.shift();
        if (widget instanceof qx.ui.tabview.TabView) tabViews.push(widget);
        queue.push(...(widget?.getChildren?.() ?? []));
      }
      return tabViews.sort((left, right) => {
        const pageCount = (widget) => (widget.getChildren?.() ?? [])
          .filter((child) => child instanceof qx.ui.tabview.Page).length;
        return pageCount(right) - pageCount(left);
      })[0] ?? null;
    } catch {
      // The native Alliance overlay singleton may not be ready during bootstrap.
    }
    return null;
  }

  install() {
    const target = this.findTabView();
    if (!target) return false;
    if (!this.pages.length) this.build();
    if (this.tabView && this.tabView !== target) this.detach();
    this.tabView = target;
    const children = target.getChildren?.() ?? [];
    let attached = false;
    for (const pageWidget of this.pages) {
      if (!children.includes(pageWidget)) {
        target.add(pageWidget);
        attached = true;
      }
    }
    if (attached) this.refresh();
    return true;
  }

  refresh() {
    if (!this.pages.length) return;
    try {
      const overview = this.hub.overview();
      const bonuses = overview.bonuses;
      this.overview.model.setData([
        ['Alliance', `${overview.name}${overview.abbreviation ? ` [${overview.abbreviation}]` : ''}`],
        ['Members', number(overview.members)], ['World rank', number(overview.rank)],
        ['Event rank', number(overview.eventRank)], ['Total score', number(overview.totalScore)],
        ['Average score', number(overview.averageScore)], ['Veteran / event points', number(overview.eventScore)],
        ['Tiberium bonus', number(bonuses.tiberium)], ['Crystal bonus', number(bonuses.crystal)],
        ['Power bonus', number(bonuses.power)], ['Infantry bonus', `${number(bonuses.infantry)}%`],
        ['Vehicle bonus', `${number(bonuses.vehicle)}%`], ['Aircraft bonus', `${number(bonuses.air)}%`],
        ['Defense bonus', `${number(bonuses.defense)}%`]
      ]);
      this.members.model.setData(this.hub.members().map((member) => [
        member.online, member.role, member.name, number(member.score), number(member.rank),
        number(member.bases), number(member.pvp), number(member.pve), number(member.pvpKills),
        number(member.pveKills), number(member.veteranPoints), number(member.eventPoints)
      ]));
      this.poiRows = this.hub.pois();
      const sectors = new Set(this.poiRows.map((poi) => poi.sector).filter((sector) => sector && sector !== '—'));
      this.poiSummary?.setValue?.(`${this.poiRows.length} alliance-owned POIs · ${sectors.size} represented sectors`);
      this.pois.model.setData(this.poiRows.map((poi) => [
        poi.type, number(poi.level), number(poi.score), poi.player || poi.owner, poi.base || '—', `${poi.x}:${poi.y}`, poi.sector
      ]));
      this.analysis.model.setData(this.hub.poiAnalysis().map((item) => [
        item.type, number(item.rank), `${number(item.multiplier)}%`, number(item.score), number(item.totalBonus),
        number(item.below), number(item.above), number(item.previousTier), number(item.nextTier), number(item.tierShortfall)
      ]));
      if (this.poiType?.getChildren?.().length === 0) {
        for (const item of this.hub.simulatePoiChanges()) this.poiType.add(new qx.ui.form.ListItem(item.type, null, item.typeId));
      }
      this.refreshPoiPlan();
      this.loadInvitationAlliances();
    } catch (error) {
      this.context.logger?.warn?.('Unable to refresh Alliance Intelligence tabs.', error);
    }
  }

  refreshPoiPlan() {
    if (!this.poiPlan) return;
    this.poiPlan.model.setData(this.hub.simulatePoiChanges(this.poiChanges).map((item) => [
      item.type, number(item.score), number(item.projectedScore), number(item.totalBonus),
      number(item.projectedTotalBonus), `${item.bonusChange >= 0 ? '+' : ''}${number(item.bonusChange)}`
    ]));
  }

  detach() {
    if (this.tabView && !this.tabView.isDisposed?.()) {
      for (const pageWidget of this.pages) {
        try { if ((this.tabView.getChildren?.() ?? []).includes(pageWidget)) this.tabView.remove(pageWidget); }
        catch { /* The native overlay may already be rebuilding. */ }
      }
    }
    this.tabView = null;
  }

  destroy() {
    if (this.tabView !== this.standalone) this.detach();
    for (const pageWidget of this.pages) {
      if (!pageWidget.isDisposed?.()) pageWidget.destroy();
    }
    this.pages = [];
    if (this.standalone && !this.standalone.isDisposed?.()) this.standalone.destroy();
    this.standalone = null;
    this.tabView = null;
  }
}

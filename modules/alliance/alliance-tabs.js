function number(value) { return Math.round(Number(value) || 0).toLocaleString(); }
function precise(value) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }); }

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
    const overviewPage = page(qx, 'Overview');
    const refreshOverview = new qx.ui.form.Button('Refresh Overview');
    refreshOverview.addListener('execute', () => this.refresh());
    overviewPage.add(refreshOverview);
    this.overviewBanner = new qx.ui.basic.Label('').set({ rich: true, wrap: true, padding: 12 });
    overviewPage.add(this.overviewBanner);
    const overviewGrid = new qx.ui.container.Composite(new qx.ui.layout.Grid(8, 8));
    overviewGrid.getLayout().setColumnFlex(0, 1); overviewGrid.getLayout().setColumnFlex(1, 1);
    this.overviewCards = {};
    const overviewCard = (id, title, icon, row, column) => {
      const card = new qx.ui.container.Composite(new qx.ui.layout.HBox(9)).set({
        padding: 9, backgroundColor: '#d7e0e3', decorator: 'main'
      });
      card.add(new qx.ui.basic.Image(icon).set({ width: 32, height: 32, scale: true, alignY: 'middle' }));
      const content = new qx.ui.basic.Label(`<b>${title}</b><br>—`).set({ rich: true, textColor: '#344448', wrap: true });
      card.add(content, { flex: 1 }); overviewGrid.add(card, { row, column }); this.overviewCards[id] = content;
    };
    overviewCard('standing', 'ALLIANCE STANDING', 'FactionUI/icons/icon_alliance.png', 0, 0);
    overviewCard('strength', 'COMBAT STRENGTH', 'FactionUI/icons/icon_alliance_bonus_tnk.png', 0, 1);
    overviewCard('resources', 'RESOURCE NETWORK', 'webfrontend/ui/common/icn_res_tiberium.png', 1, 0);
    overviewCard('forces', 'FORCE BONUSES', 'FactionUI/icons/icon_alliance_bonus_inf.png', 1, 1);
    overviewPage.add(overviewGrid, { flex: 1 });

    this.overviewDescription = new qx.ui.basic.Label('').set({ rich: true, wrap: true, padding: 10, textColor: '#344448', backgroundColor: '#d7e0e3' });
    overviewPage.add(this.overviewDescription);

    const membersPage = page(qx, 'Members');
    const memberActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    const refreshMembers = new qx.ui.form.Button('Refresh Members');
    memberActions.add(refreshMembers); membersPage.add(memberActions);
    this.members = table(qx, ['Status', 'Role', 'Member', 'Score', 'Rank', 'Bases', 'PvP kills', 'PvE kills', 'Veteran', 'Event'], [75, 105, 155, 95, 55, 55, 90, 90, 75, 75]);
    this.members.widget.addListener('cellTap', (event) => {
      const name = String(this.members.model.getRowData?.(event.getRow?.())?.[2] ?? '');
      try { this.hub.openPlayerProfile(name); }
      catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    });
    membersPage.add(this.members.widget, { flex: 1 });
    refreshMembers.addListener('execute', () => {
      this.hub.memberDetails.clear(); this.hub.memberDetailPending.clear(); this.refresh();
    });
    const copyBases = new qx.ui.form.Button('Copy Owned Base Intel for Alliance');
    copyBases.addListener('execute', async () => {
      const text = this.hub.exportOwnedBases();
      if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
      else globalThis.prompt?.('Copy owned base intel', text);
    });
    membersPage.add(copyBases);

    const poisPage = page(qx, 'POIs');
    const refreshPois = new qx.ui.form.Button('Refresh POIs');
    refreshPois.addListener('execute', () => this.refresh());
    poisPage.add(refreshPois);
    this.poiSummary = new qx.ui.basic.Label('Loading POIs…').set({ font: 'bold', textColor: '#ffffff' });
    poisPage.add(this.poiSummary);
    const poiContent = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    this.poiTypeButtons = [];
    const poiTypeRail = new qx.ui.container.Composite(new qx.ui.layout.VBox(3)).set({ width: 42 });
    const poiIcons = {
      2: 'webfrontend/ui/common/icn_res_tiberium.png',
      3: 'webfrontend/ui/common/icn_res_chrystal.png',
      4: 'webfrontend/ui/common/icn_res_power.png',
      5: 'FactionUI/icons/icon_alliance_bonus_inf.png',
      6: 'FactionUI/icons/icon_alliance_bonus_tnk.png',
      7: 'FactionUI/icons/icon_alliance_bonus_air.png',
      8: 'FactionUI/icons/icon_def_army_points.png'
    };
    for (const item of this.hub.poiTypes()) {
      const button = new qx.ui.form.ToggleButton('', poiIcons[item.id]).set({
        width: 38, height: 38, toolTipText: item.name, show: 'icon', allowGrowX: false
      });
      button.setUserData('poiTypeId', item.id);
      button.addListener('execute', () => {
        this.selectedPoiTypeId = item.id;
        this.plannerPoiTypeId = item.id;
        for (const candidate of this.poiTypeButtons) candidate.setValue(candidate === button);
        this.refreshOwnedPoiRows();
        this.refreshPoiSearchRows();
      });
      this.poiTypeButtons.push(button); poiTypeRail.add(button);
    }
    this.selectedPoiTypeId = this.hub.poiTypes()[0]?.id ?? 2;
    this.plannerPoiTypeId = this.selectedPoiTypeId;
    this.poiAdds = new Set();
    this.poiTypeButtons[0]?.setValue(true);
    poiContent.add(poiTypeRail);
    const poiBody = new qx.ui.container.Composite(new qx.ui.layout.VBox(6));
    this.poiTypeTitle = new qx.ui.basic.Label('').set({ font: 'bold', textColor: '#ffffff', alignX: 'center' });
    poiBody.add(this.poiTypeTitle);
    poiBody.add(new qx.ui.basic.Label('Owned POIs').set({ font: 'bold', textColor: '#ffffff' }));
    this.pois = table(qx, ['Drop', 'POI Type', 'Level', 'Score', 'Coordinates', 'Real Gain/Loss', 'Rank', 'Multiplier', 'Current Bonus', 'Below Alliance', 'Above Alliance', 'Previous Tier', 'Next Tier', 'Tier Shortfall', 'Drop Candidate'], [45, 185, 55, 80, 95, 105, 55, 75, 95, 95, 95, 85, 85, 95, 1]);
    this.pois.widget.getTableColumnModel().setDataCellRenderer(0, new qx.ui.table.cellrenderer.Boolean());
    this.pois.widget.getTableColumnModel().setColumnVisible(14, false);
    for (let column = 1; column < 14; column += 1) {
      const renderer = new qx.ui.table.cellrenderer.Default();
      const defaultCellStyle = renderer._getCellStyle?.bind(renderer);
      renderer._getCellStyle = (cellInfo) => {
        const base = defaultCellStyle?.(cellInfo) ?? '';
        const dropCandidate = Boolean(this.pois.model.getValue?.(14, cellInfo?.row));
        return dropCandidate
          ? `${base};background-color:#f4d35e;color:#2b2612;font-weight:bold${column === 1 ? ';border-left:3px solid #b88700' : ''}`
          : base;
      };
      this.pois.widget.getTableColumnModel().setDataCellRenderer(column, renderer);
    }
    this.pois.model.setColumnSortable(0, false);
    this.poiDrops = new Set();
    this.pois.widget.addListener('cellTap', (event) => {
      if (Number(event.getColumn?.()) !== 0) return;
      const coordinates = String(this.pois.model.getRowData?.(event.getRow?.())?.[4] ?? '');
      if (!coordinates) return;
      if (this.poiDrops.has(coordinates)) this.poiDrops.delete(coordinates); else this.poiDrops.add(coordinates);
      this.refreshOwnedPoiRows();
    });
    const poiActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    const focusPoi = new qx.ui.form.Button('Focus Selected POI');
    const clearPoiPlan = new qx.ui.form.Button('Clear Simulation');
    const copyPois = new qx.ui.form.Button('Copy Owned POIs (CSV)');
    focusPoi.addListener('execute', () => {
      const row = this.pois.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
      const coordinates = String(this.pois.model.getRowData?.(row)?.[4] ?? '');
      const selected = this.filteredPoiRows?.find((poi) => `${poi.x}:${poi.y}` === coordinates);
      try { this.hub.focusPoi(selected); }
      catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    });
    copyPois.addListener('execute', async () => {
      const text = this.hub.exportOwnedPoiAnalysis(this.filteredPoiRows ?? []);
      try {
        if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
        else globalThis.prompt?.('Copy owned POIs', text);
        this.context.notifications?.show?.(`${this.filteredPoiRows?.length ?? 0} owned POIs copied.`);
      } catch (error) { this.context.notifications?.show?.(`POI export failed: ${error?.message ?? error}`); }
    });
    clearPoiPlan.addListener('execute', () => { this.poiAdds.clear(); this.poiDrops.clear(); this.refreshPoiSearchRows(); this.refreshOwnedPoiRows(); });
    poiActions.add(focusPoi); poiActions.add(clearPoiPlan); poiActions.add(copyPois);
    poiBody.add(poiActions);
    poiBody.add(this.pois.widget, { flex: 1 });
    poiBody.add(new qx.ui.container.Composite().set({
      height: 1, minHeight: 1, maxHeight: 1, backgroundColor: '#7f969f', allowGrowY: false
    }));
    poiBody.add(new qx.ui.basic.Label('Find POIs').set({ font: 'bold', textColor: '#ffffff' }));
    const poiSearchControls = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const searchPois = new qx.ui.form.Button('Search Base → Center'), focusSearchedPoi = new qx.ui.form.Button('Focus Selected POI');
    const exportSearch = new qx.ui.form.Button('Export Search CSV');
    for (const button of [searchPois, focusSearchedPoi, exportSearch]) poiSearchControls.add(button);
    poiBody.add(poiSearchControls);
    this.poiSearchStatus = new qx.ui.basic.Label('Searches a 50-field-wide direct corridor from the selected owned base to world center.').set({ textColor: '#ffffff' }); poiBody.add(this.poiSearchStatus);
    this.poiSearch = table(qx, ['Add', 'POI Type', 'Level', 'Score', 'Real Gain/Loss', 'Distance', 'Coordinates', 'Owner'], [45, 210, 60, 70, 105, 80, 100, 155]);
    this.poiSearch.widget.getTableColumnModel().setDataCellRenderer(0, new qx.ui.table.cellrenderer.Boolean()); this.poiSearch.model.setColumnSortable(0, false);
    this.poiSearch.widget.addListener('cellTap', (event) => { if (Number(event.getColumn?.()) !== 0) return; const coordinates = String(this.poiSearch.model.getRowData?.(event.getRow?.())?.[6] ?? ''); if (this.poiAdds.has(coordinates)) this.poiAdds.delete(coordinates); else this.poiAdds.add(coordinates); this.refreshPoiSearchRows(); this.refreshOwnedPoiRows(); });
    poiBody.add(this.poiSearch.widget, { flex: 1 });
    this.poiBenefitSummary = new qx.ui.basic.Label('').set({ rich: true, textColor: '#ffffff', padding: 6 });
    poiBody.add(this.poiBenefitSummary);
    poiContent.add(poiBody, { flex: 1 });
    poisPage.add(poiContent, { flex: 1 });
    searchPois.addListener('execute', () => { try { this.poiSearchRows = this.hub.searchPoiCorridor(50); this.refreshPoiSearchRows(); } catch (error) { this.poiSearchStatus.setValue(`Search failed: ${error?.message ?? error}`); } });
    focusSearchedPoi.addListener('execute', () => { const row = this.poiSearch.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1; const coordinates = String(this.poiSearch.model.getRowData?.(row)?.[6] ?? ''); try { this.hub.focusPoi(this.filteredPoiSearchRows?.find((poi) => `${poi.x}:${poi.y}` === coordinates)); } catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); } });
    exportSearch.addListener('execute', () => this.exportPoiSearch());

    const diplomacyPage = page(qx, 'Diplomacy');
    const diplomacyCards = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    this.diplomacyCards = {};
    for (const [key, title, color] of [
      ['Allies', 'ALLIES', '#176f35'], ['Non-aggression pacts', 'NAP', '#08798a'], ['Enemies', 'ENEMIES', '#9d2020']
    ]) {
      const card = new qx.ui.container.Composite(new qx.ui.layout.VBox(5)).set({ padding: 9, backgroundColor: '#d7e0e3', decorator: 'main' });
      card.add(new qx.ui.basic.Label(`<b style="color:${color}">${title}</b>`).set({ rich: true }));
      const list = new qx.ui.basic.Label('None').set({ rich: true, wrap: true, textColor: '#344448' });
      card.add(list, { flex: 1 }); diplomacyCards.add(card, { flex: 1 }); this.diplomacyCards[key] = list;
    }
    diplomacyPage.add(diplomacyCards);
    diplomacyPage.add(new qx.ui.basic.Label('<b>ALLIANCE DIPLOMACY MANAGEMENT</b>').set({ rich: true, textColor: '#ffffff' }));
    const diplomacyActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    const loadDiplomacyAlliances = new qx.ui.form.Button('Load / Refresh Alliances');
    const setAlly = new qx.ui.form.Button('Set Ally'), setNap = new qx.ui.form.Button('Set NAP'), setEnemy = new qx.ui.form.Button('Set Enemy');
    for (const button of [loadDiplomacyAlliances, setAlly, setNap, setEnemy]) diplomacyActions.add(button);
    diplomacyPage.add(diplomacyActions);
    this.diplomacyAlliances = table(qx, ['Rank', 'Alliance', 'Score', 'Current diplomacy', 'Alliance ID'], [70, 310, 130, 170, 120]);
    diplomacyPage.add(this.diplomacyAlliances.widget, { flex: 1 });
    const loadAlliances = async () => {
      try {
        this.diplomacyAllianceRows = await this.hub.rankedAlliances(); this.refreshDiplomacyRows();
      } catch (error) { this.context.notifications?.show?.(`Alliance list failed: ${error?.message ?? error}`); }
    };
    const changeDiplomacy = async (type) => {
      const row = this.diplomacyAlliances.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
      const id = this.diplomacyAlliances.model.getRowData?.(row)?.[4];
      try { await this.hub.setDiplomacy(id, type); this.refresh(); }
      catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    };
    loadDiplomacyAlliances.addListener('execute', () => void loadAlliances());
    setAlly.addListener('execute', () => void changeDiplomacy(globalThis.webfrontend?.gui?.alliance?.DiplomacyPage?.ERelationTypeAlly ?? 1));
    setNap.addListener('execute', () => void changeDiplomacy(globalThis.webfrontend?.gui?.alliance?.DiplomacyPage?.ERelationTypeNAP ?? 2));
    setEnemy.addListener('execute', () => void changeDiplomacy(globalThis.webfrontend?.gui?.alliance?.DiplomacyPage?.ERelationTypeEnemy ?? 3));

    const markersPage = page(qx, 'Markers');
    markersPage.add(new qx.ui.basic.Label('<b>SUITE MARKERS</b> · Private by default, with optional alliance sharing.').set({ rich: true, textColor: '#9edcff' }));
    const privateForm = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    this.privateMarkerX = new qx.ui.form.Spinner(0, 0, 1000).set({ width: 72 });
    this.privateMarkerY = new qx.ui.form.Spinner(0, 0, 1000).set({ width: 72 });
    this.privateMarkerLabel = new qx.ui.form.TextField().set({ placeholder: 'Marker label', width: 220, maxLength: 80 });
    this.privateMarkerColor = new qx.ui.form.SelectBox().set({ width: 120 });
    for (const [label, color] of [['Gold', '#ffcc33'], ['Red', '#ff5c5c'], ['Cyan', '#45d7ff'], ['Green', '#66e07a'], ['Purple', '#c48cff'], ['White', '#ffffff']]) {
      this.privateMarkerColor.add(new qx.ui.form.ListItem(label, null, color));
    }
    const useSelection = new qx.ui.form.Button('Use Selection');
    const addPrivateMarker = new qx.ui.form.Button('Add Marker');
    this.shareSuiteMarker = new qx.ui.form.CheckBox('Share with alliance Suite users').set({ textColor: '#ffffff' });
    privateForm.add(new qx.ui.basic.Label('X').set({ alignY: 'middle' })); privateForm.add(this.privateMarkerX);
    privateForm.add(new qx.ui.basic.Label('Y').set({ alignY: 'middle' })); privateForm.add(this.privateMarkerY);
    privateForm.add(this.privateMarkerLabel); privateForm.add(this.privateMarkerColor); privateForm.add(useSelection); privateForm.add(addPrivateMarker);
    markersPage.add(privateForm);
    markersPage.add(this.shareSuiteMarker);
    markersPage.add(new qx.ui.basic.Label('Shared markers use the game alliance-marker channel. Suite users receive the custom label/color; non-Suite members may still see the underlying native marker.').set({ wrap: true, textColor: '#b8c8cf' }));
    useSelection.addListener('execute', () => {
      const selected = this.hub.currentSelectionCoordinates();
      if (!Number.isFinite(selected.x) || !Number.isFinite(selected.y)) {
        this.context.notifications?.show?.('Select a world-map object first.'); return;
      }
      this.privateMarkerX.setValue(Math.round(selected.x)); this.privateMarkerY.setValue(Math.round(selected.y));
    });
    addPrivateMarker.addListener('execute', async () => {
      try {
        const marker = {
          x: this.privateMarkerX.getValue(), y: this.privateMarkerY.getValue(),
          label: this.privateMarkerLabel.getValue(),
          color: this.privateMarkerColor.getSelection()[0]?.getModel() ?? '#ffcc33'
        };
        if (this.shareSuiteMarker.getValue()) await this.hub.addSharedSuiteMarker(marker);
        else await this.hub.addPrivateMarker(marker);
        this.privateMarkerLabel.setValue(''); this.refreshPrivateMarkers();
      } catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    });
    this.privateMarkers = table(qx, ['Scope', 'Label', 'Coordinates', 'Color', 'Created', 'ID'], [115, 270, 110, 100, 170, 1]);
    this.privateMarkers.widget.getTableColumnModel().setColumnVisible(5, false);
    this.privateMarkers.widget.set({ height: 175, minHeight: 130 });
    markersPage.add(this.privateMarkers.widget);
    const privateActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    const focusPrivate = new qx.ui.form.Button('Focus Private Marker');
    const deletePrivate = new qx.ui.form.Button('Delete Private Marker');
    const selectedPrivateMarker = () => {
      const row = this.privateMarkers.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
      const id = this.privateMarkers.model.getRowData?.(row)?.[5];
      return this.hub.displaySuiteMarkers().find((marker) => marker.id === id);
    };
    focusPrivate.addListener('execute', () => { try { this.hub.focusPrivateMarker(selectedPrivateMarker()); } catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); } });
    deletePrivate.addListener('execute', async () => {
      const marker = selectedPrivateMarker(); if (!marker) return;
      if (!(globalThis.confirm?.(`Delete private marker “${marker.label}” at ${marker.x}:${marker.y}?`) ?? false)) return;
      await this.hub.deleteSuiteMarker(marker); setTimeout(() => this.refreshPrivateMarkers(), marker.scope === 'Alliance Suite' ? 500 : 0);
    });
    privateActions.add(focusPrivate); privateActions.add(deletePrivate); markersPage.add(privateActions);
    markersPage.add(new qx.ui.basic.Label('<b>ALLIANCE MARKERS</b> · Shared through the game with alliance members.').set({ rich: true, textColor: '#ffffff', paddingTop: 5 }));
    const markerActions = new qx.ui.container.Composite(new qx.ui.layout.HBox(7));
    const refreshMarkers = new qx.ui.form.Button('Refresh Markers');
    refreshMarkers.addListener('execute', () => this.refresh());
    markerActions.add(refreshMarkers);
    this.markers = table(qx, ['Created By', 'Type', 'Coordinates', 'Description'], [180, 160, 110, 380]);
    markersPage.add(this.markers.widget, { flex: 1 });
    this.markerDetail = new qx.ui.basic.Label('Select a marker to view its full description.').set({
      rich: true, wrap: true, selectable: true, padding: 9, textColor: '#344448', backgroundColor: '#d7e0e3'
    });
    this.markers.widget.addListener('cellTap', (event) => {
      const coordinates = String(this.markers.model.getRowData?.(event.getRow?.())?.[2] ?? '');
      const marker = this.markerRows?.find((item) => `${item.x}:${item.y}` === coordinates);
      if (!marker) return;
      this.markerDetail.setValue(`<b>${marker.type}</b> · ${marker.x}:${marker.y}<br>${marker.description || 'No description'}${marker.createdBy ? `<br><small>Created by ${marker.createdBy}${marker.editedBy ? ` · Edited by ${marker.editedBy}` : ''}</small>` : ''}`);
    });
    markersPage.add(this.markerDetail);
    const focusMarker = new qx.ui.form.Button('Focus Selected Marker');
    focusMarker.addListener('execute', () => {
      const row = this.markers.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
      const coordinates = String(this.markers.model.getRowData?.(row)?.[2] ?? '').split(':');
      try { this.hub.focusPoi({ x: Number(coordinates[0]), y: Number(coordinates[1]) }); }
      catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    });
    const deleteMarker = new qx.ui.form.Button('Delete Selected Marker');
    deleteMarker.addListener('execute', () => {
      const row = this.markers.widget.getSelectionModel?.().getLeadSelectionIndex?.() ?? -1;
      const coordinates = String(this.markers.model.getRowData?.(row)?.[2] ?? '');
      const marker = this.markerRows?.find((item) => `${item.x}:${item.y}` === coordinates);
      if (!marker) return;
      const confirmed = globalThis.confirm?.(`Delete the ${marker.type} marker at ${marker.x}:${marker.y}?`) ?? false;
      if (!confirmed) return;
      try { this.hub.deleteMarker(marker); setTimeout(() => this.refresh(), 500); }
      catch (error) { this.context.notifications?.show?.(error?.message ?? String(error)); }
    });
    markerActions.add(focusMarker); markerActions.add(deleteMarker); markersPage.add(markerActions);

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

    this.pages = [overviewPage, membersPage, poisPage, diplomacyPage, markersPage, invitationsPage];
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
      const allianceName = `${overview.name}${overview.abbreviation ? ` [${overview.abbreviation}]` : ''}`;
      this.overviewBanner?.setValue?.(
        `<div style="padding:12px 16px;background:#263840;border:1px solid #1595c5;color:#fff">`
        + `<div style="font-size:11px;color:#7ddcff;letter-spacing:2px">ALLIANCE COMMAND NETWORK</div>`
        + `<div style="font-size:22px;font-weight:bold">${allianceName}</div>`
        + `<div style="color:#b8c9cf">Strategic status, resource control, and combat bonuses</div></div>`
      );
      const highestMemberRank = Math.min(...this.hub.members().map((member) => Number(member.rank)).filter((rank) => rank > 0));
      this.overviewCards.standing?.setValue?.(`<b>ALLIANCE STANDING</b><br>World rank: <b>${number(overview.rank)}</b><br>Event rank: <b>${number(overview.eventRank)}</b><br>Highest member rank: <b>${Number.isFinite(highestMemberRank) ? number(highestMemberRank) : '—'}</b><br>Members: <b>${number(overview.members)}</b>`);
      this.overviewCards.strength?.setValue?.(`<b>COMBAT STRENGTH</b><br>Total score: <b>${number(overview.totalScore)}</b><br>Average score: <b>${number(overview.averageScore)}</b><br>Veteran / event points: <b>${number(overview.eventScore)}</b>`);
      this.overviewCards.resources?.setValue?.(`<b>RESOURCE NETWORK</b><br>Tiberium: <b>+${number(bonuses.tiberium)}/h</b><br>Crystals: <b>+${number(bonuses.crystal)}/h</b><br>Power: <b>+${number(bonuses.power)}/h</b>`);
      this.overviewCards.forces?.setValue?.(`<b>FORCE BONUSES</b><br>Infantry: <b>+${precise(bonuses.infantry)}%</b> · Vehicles: <b>+${precise(bonuses.vehicle)}%</b><br>Aircraft: <b>+${precise(bonuses.air)}%</b> · Defense: <b>+${precise(bonuses.defense)}%</b>`);
      this.overviewDescription?.setValue?.(`<b>ALLIANCE DESCRIPTION</b><br>${overview.description || 'No alliance description is available.'}`);
      const renderMembers = (members) => this.members.model.setData(members.map((member) => [
        member.online, member.role, member.name, number(member.score), number(member.rank),
        number(member.bases), number(member.pvp), number(member.pve),
        number(member.veteranPoints), number(member.eventPoints)
      ]));
      const memberRows = this.hub.members();
      renderMembers(memberRows);
      void this.hub.enrichMembers(memberRows).then((enriched) => {
        if (this.members?.widget && !this.members.widget.isDisposed?.()) renderMembers(enriched);
      });
      this.diplomacyRows = this.hub.diplomacy();
      for (const [type, card] of Object.entries(this.diplomacyCards ?? {})) {
        const rows = this.diplomacyRows.filter((relation) => relation.type === type);
        card.setValue(rows.length ? rows.map((relation) => `<b>${relation.alliance}</b>${relation.abbreviation ? ` [${relation.abbreviation}]` : ''}`).join('<br>') : 'None');
      }
      this.refreshDiplomacyRows();
      this.markerRows = this.hub.markers();
      this.markers?.model?.setData?.(this.markerRows.map((marker) => [
        marker.createdBy || 'Unknown', marker.type, `${marker.x}:${marker.y}`, marker.description
      ]));
      this.refreshPrivateMarkers();
      this.poiRows = this.hub.pois();
      this.analysisRows = this.hub.poiAnalysis();
      const analysisByType = new Map(this.analysisRows.map((item) => [item.type, item]));
      const sectors = new Set(this.poiRows.map((poi) => poi.sector).filter((sector) => sector && sector !== '—'));
      this.poiSummary?.setValue?.(`${this.poiRows.length} alliance-owned POIs · ${sectors.size} represented sectors`);
      this.poiRows = this.poiRows.map((poi) => ({ ...poi, analysis: analysisByType.get(poi.type) ?? null }));
      this.refreshOwnedPoiRows();
      this.refreshPoiSearchRows();
      this.loadInvitationAlliances();
    } catch (error) {
      this.context.logger?.warn?.('Unable to refresh Alliance Intelligence tabs.', error);
    }
  }

  refreshPrivateMarkers() {
    if (!this.privateMarkers) return;
    const rows = this.hub.displaySuiteMarkers();
    this.privateMarkers.model.setData(rows.map((marker) => [
      marker.scope, marker.label, `${marker.x}:${marker.y}`, marker.color,
      new Date(marker.createdAt).toLocaleString(), marker.id
    ]));
  }

  refreshOwnedPoiRows() {
    if (!this.pois) return;
    this.filteredPoiRows = (this.poiRows ?? []).filter((poi) => Number(poi.typeId) === Number(this.selectedPoiTypeId));
    const currentTypeScore = this.filteredPoiRows.reduce((sum, poi) => sum + (Number(poi.score) || 0), 0);
    this.pois.model.setData(this.filteredPoiRows.map((poi) => {
      const item = poi.analysis ?? {};
      const coordinates = `${poi.x}:${poi.y}`;
      const loss = this.hub.poiRealLoss(item, currentTypeScore, Number(poi.score || 0));
      const gainLoss = item.percent ? `${precise(loss)}%` : number(loss);
      poi.realGainLoss = loss;
      poi.dropCandidate = Math.abs(Number(loss)) < 0.0005;
      return [this.poiDrops.has(coordinates), poi.type, number(poi.level), number(poi.score), coordinates, gainLoss,
        number(item.rank), `${number(item.multiplier)}%`, number(item.totalBonus), number(item.below),
        number(item.above), number(item.previousTier), number(item.nextTier), number(item.tierShortfall), poi.dropCandidate];
    }));
    const type = this.hub.poiTypes().find((item) => Number(item.id) === Number(this.selectedPoiTypeId));
    const analysis = this.analysisRows?.find((item) => item.type === type?.name) ?? this.filteredPoiRows[0]?.analysis;
    const totalScore = Number(analysis?.score) || this.filteredPoiRows.reduce((sum, poi) => sum + (Number(poi.score) || 0), 0);
    const dropped = this.filteredPoiRows.filter((poi) => this.poiDrops.has(`${poi.x}:${poi.y}`));
    const droppedScore = dropped.reduce((sum, poi) => sum + (Number(poi.score) || 0), 0);
    const ownedCoordinates = new Set((this.poiRows ?? []).map((poi) => `${poi.x}:${poi.y}`));
    const added = (this.poiSearchRows ?? []).filter((poi) => Number(poi.typeId) === Number(this.selectedPoiTypeId)
      && this.poiAdds?.has(`${poi.x}:${poi.y}`) && !ownedCoordinates.has(`${poi.x}:${poi.y}`));
    const addedScore = added.reduce((sum, poi) => sum + (Number(poi.score) || 0), 0);
    const simulated = dropped.length > 0 || added.length > 0;
    const projected = this.hub.previewPoiChange(analysis, totalScore - droppedScore + addedScore);
    const shown = simulated ? { ...analysis, ...projected } : analysis;
    const value = (amount) => analysis?.percent ? `+${precise(amount)}% ${analysis.benefit}` : `+${number(amount)} ${analysis?.benefit ?? ''}`;
    this.poiTypeTitle?.setValue?.(`Alliance ${type?.name ?? 'POI'} Bonus`);
    this.poiBenefitSummary?.setValue?.(
      `<div style="padding:8px 10px;background:#dce3e6;color:#39464c;border:1px solid #90a4ad">`
      + `<div style="font-size:11px;font-weight:bold;color:${simulated ? '#b42318' : '#176f35'}">${simulated ? 'SIMULATED DATA' : 'LIVE DATA'}</div>`
      + `<div style="font-size:14px;font-weight:bold;margin-bottom:5px">${simulated ? 'Projected ' : ''}${analysis?.label ?? type?.name ?? 'POI'}: ${value(shown?.totalBonus)}</div>`
      + `<div>${type?.name ?? 'POI'} Score: <b>${number(shown?.score ?? totalScore)}</b> =&gt; Base value: ${value(shown?.baseBonus)}</div>`
      + `<div style="color:#6f7f87">(Next bonus tier at: ${number(shown?.nextTier)} ${type?.name ?? 'POI'} Score =&gt; Base value: ${value(shown?.nextBaseBonus)})</div>`
      + `<div>Alliance ranking multiplier: +${number(shown?.multiplier)}% (Ranking: ${number(shown?.rank)})</div>`
      + `<div style="margin-top:7px;padding:6px 8px;background:#eef1f2;border:1px solid #1595c5;font-weight:bold">${type?.name ?? 'POI'}s: ${this.filteredPoiRows.length - dropped.length + added.length}${simulated ? ` projected (${dropped.length} drop, ${added.length} add; no game action is performed)` : ''}</div>`
      + `</div>`
    );
  }

  refreshDiplomacyRows() {
    if (!this.diplomacyAlliances) return;
    const relationById = new Map((this.diplomacyRows ?? []).map((relation) => [String(relation.id), relation.type]));
    this.diplomacyAlliances.model.setData((this.diplomacyAllianceRows ?? []).map((alliance) => [
      number(alliance.rank), alliance.name, number(alliance.score), relationById.get(String(alliance.id)) ?? 'None', alliance.id
    ]));
  }

  refreshPoiSearchRows() {
    if (!this.poiSearch) return;
    const typeId = Number(this.plannerPoiTypeId);
    const type = this.hub.poiTypes().find((item) => Number(item.id) === typeId);
    this.filteredPoiSearchRows = (this.poiSearchRows ?? []).filter((poi) => poi.typeId === typeId);
    // World POI ids (2-8) and the game's ranked-bonus ids (4-10) are not the
    // same enum. Match their canonical names so projections use the correct
    // bonus curve, current score, rank, and alliance multiplier.
    const analysis = this.analysisRows?.find((item) => item.type === type?.name) ?? {};
    const ownedScore = Number(analysis.score) || (this.poiRows ?? []).filter((poi) => Number(poi.typeId) === typeId)
      .reduce((sum, poi) => sum + (Number(poi.score) || 0), 0);
    const ownedCoordinates = new Set((this.poiRows ?? []).map((poi) => `${poi.x}:${poi.y}`));
    this.filteredPoiSearchRows = this.filteredPoiSearchRows.filter((poi) => !ownedCoordinates.has(`${poi.x}:${poi.y}`));
    this.poiSearch.model.setData(this.filteredPoiSearchRows.map((poi) => [
      this.poiAdds.has(`${poi.x}:${poi.y}`), poi.type, poi.level, poi.score,
      analysis.percent ? `+${precise(this.hub.previewPoiChange(analysis, ownedScore + poi.score).totalBonus - analysis.totalBonus)}%`
        : `+${number(this.hub.previewPoiChange(analysis, ownedScore + poi.score).totalBonus - analysis.totalBonus)}`,
      Number(poi.distance.toFixed(2)), `${poi.x}:${poi.y}`, poi.owner
    ]));
    this.poiSearchStatus?.setValue?.(`${this.filteredPoiSearchRows.length} of ${this.poiSearchRows?.length ?? 0} POIs shown · 50-field-wide base-to-center corridor.`);
  }

  exportPoiSearch() {
    const rows = this.filteredPoiSearchRows ?? [];
    const csv = this.hub.exportPoiSearch(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `cnc-ta-poi-search-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.context.notifications?.show?.(`${rows.length} searched POIs exported.`);
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

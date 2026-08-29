function formatNumber(value) {
  const number = Number(value) || 0;
  for (const [size, suffix] of [[1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(number) < size) continue;
    const scaled = number / size;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${scaled.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/, '')}${suffix}`;
  }
  return Math.round(number).toLocaleString();
}

function resourceProgress(current, required, growthPerHour = 0) {
  const have = Math.max(0, Number(current) || 0);
  const need = Math.max(0, Number(required) || 0);
  const remaining = Math.max(0, need - have);
  const rate = Math.max(0, Number(growthPerHour) || 0);
  return {
    current: have, required: need, remaining,
    ready: need > 0 && remaining === 0,
    etaSeconds: remaining === 0 ? 0 : rate > 0 ? Math.ceil((remaining / rate) * 3600) : null
  };
}

function formatDuration(seconds) {
  if (seconds == null) return 'Unavailable';
  if (seconds <= 0) return 'Ready';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function percent(current, required) {
  const need = Math.max(0, Number(required) || 0);
  if (!need) return 100;
  return Math.max(0, Math.min(100, ((Number(current) || 0) / need) * 100));
}

function displayPercent(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function progressColor(value) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  const stops = [[217, 83, 79], [240, 173, 78], [92, 184, 92]];
  const segment = normalized < 50 ? 0 : 1;
  const ratio = segment ? (normalized - 50) / 50 : normalized / 50;
  return `rgb(${stops[segment].map((start, index) =>
    Math.round(start + ((stops[segment + 1][index] - start) * ratio))).join(',')})`;
}

function label(qx, value, options = {}) {
  return new qx.ui.basic.Label(value).set({ rich: false, wrap: true, ...options });
}

function progressSection(qx, title) {
  const box = new qx.ui.container.Composite(new qx.ui.layout.VBox(4));
  const header = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
  const name = label(qx, title, { font: 'bold' });
  const percentLabel = label(qx, '0%');
  header.add(name, { flex: 1 });
  header.add(percentLabel);
  const track = new qx.ui.container.Composite(new qx.ui.layout.HBox(0)).set({
    height: 18, minHeight: 18, maxHeight: 18, backgroundColor: '#30363d'
  });
  const fill = new qx.ui.core.Widget();
  const remainder = new qx.ui.core.Widget();
  track.add(fill, { flex: 0 });
  track.add(remainder, { flex: 10000 });
  const amount = label(qx, '—');
  const detail = label(qx, '—', { textColor: '#17262d', font: 'bold' });
  box.add(header);
  box.add(track);
  box.add(amount);
  box.add(detail);
  return {
    box, percentLabel, amount, detail,
    setProgress(value) {
      const weight = Math.round(Math.max(0, Math.min(100, Number(value) || 0)) * 100);
      fill.set({ backgroundColor: progressColor(value) });
      fill.setVisibility?.(weight ? 'visible' : 'excluded');
      remainder.setVisibility?.(weight === 10000 ? 'excluded' : 'visible');
      fill.setLayoutProperties({ flex: weight });
      remainder.setLayoutProperties({ flex: 10000 - weight });
    }
  };
}

export function researchTrackingProgress(snapshot) {
  const item = snapshot?.item;
  if (!item) return null;
  const resources = snapshot.resources ?? {};
  const credits = resourceProgress(
    resources.credits, item.credits, resources.creditGrowthPerHour
  );
  const research = resourceProgress(resources.research, item.research, 0);
  return Object.freeze({
    item,
    credits: Object.freeze({ ...credits, percent: percent(credits.current, credits.required) }),
    research: Object.freeze({ ...research, percent: percent(research.current, research.required) }),
    ready: credits.remaining === 0 && research.remaining === 0,
    overallPercent: Math.min(percent(credits.current, credits.required), percent(research.current, research.required))
  });
}

export function buildResearchTrackerWindow(context, owner) {
  const qx = globalThis.qx;
  const content = new qx.ui.container.Composite(new qx.ui.layout.VBox(10)).set({ padding: 10 });
  const summary = label(qx, 'Check a research item in the game Research pane to track it.', {
    font: 'bold', wrap: true
  });
  const credits = progressSection(qx, 'Credits');
  const research = progressSection(qx, 'Research Points');
  const footer = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
  const updated = label(qx, 'No research selected');
  const clear = new qx.ui.form.Button('Clear');
  const refresh = new qx.ui.form.Button('Refresh');
  footer.add(updated, { flex: 1 });
  footer.add(clear);
  footer.add(refresh);
  content.add(summary);
  content.add(credits.box);
  content.add(research.box);
  content.add(footer);

  const renderEmpty = () => {
    summary.setValue('Check a research item in the game Research pane to track it.');
    for (const section of [credits, research]) {
      section.percentLabel.setValue('—');
      section.setProgress(0);
      section.amount.setValue('No item selected');
      section.detail.setValue('');
    }
    updated.setValue('Waiting for a selection');
    clear.setEnabled?.(false);
  };

  const refreshData = () => {
    const data = researchTrackingProgress(owner.trackerSnapshot());
    if (!data) return renderEmpty();
    clear.setEnabled?.(true);
    summary.setValue(data.ready
      ? `${data.item.name} is ready to research.`
      : `${data.item.name}: ${displayPercent(data.overallPercent)}% ready`);
    for (const [section, value, showEta] of [
      [credits, data.credits, true], [research, data.research, false]
    ]) {
      section.percentLabel.setValue(value.ready ? 'Ready' : `${displayPercent(value.percent)}%`);
      section.setProgress(value.percent);
      section.amount.setValue(`${formatNumber(value.current)} / ${formatNumber(value.required)}`);
      section.detail.setValue(`Remaining: ${formatNumber(value.remaining)}`
        + (showEta ? `  •  ETA: ${formatDuration(value.etaSeconds)}` : ''));
    }
    updated.setValue(`Updated ${new Date().toLocaleTimeString()}`);
  };

  refresh.addListener('execute', refreshData);
  clear.addListener('execute', () => void owner.setTrackedResearch(null));
  let timer = globalThis.setInterval?.(refreshData, 5000) ?? null;
  content.addListenerOnce('dispose', () => {
    if (timer != null) globalThis.clearInterval?.(timer);
    timer = null;
  });
  refreshData();
  return { content, controller: { refresh: refreshData } };
}

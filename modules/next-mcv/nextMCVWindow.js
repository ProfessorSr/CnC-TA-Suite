import settings from './settings.js';
import { NextMCVCalculator } from './nextMCVCalculator.js?v=1.0.0-mcv1';

const windowControllers = new WeakMap();

export function getNextMCVWindowController(content) {
  return windowControllers.get(content) ?? null;
}

function formatNumber(value) {
  const number = Number(value) || 0;

  if (!settings.compactNumbers) {
    return new Intl.NumberFormat().format(Math.round(number));
  }

  const units = [
    [1e15, 'Q'],
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
  ];

  for (const [size, suffix] of units) {
    if (Math.abs(number) >= size) {
      const scaled = number / size;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/, '')}${suffix}`;
    }
  }

  return new Intl.NumberFormat().format(Math.round(number));
}

function formatDuration(seconds) {
  if (seconds == null) return 'Unavailable';
  if (seconds <= 0) return 'Ready';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function makeLabel(qx, value, options = {}) {
  const label = new qx.ui.basic.Label(value);
  label.set({ rich: false, wrap: true, ...options });
  return label;
}

function progressColor(value) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const stops = [
    [217, 83, 79],
    [240, 173, 78],
    [92, 184, 92]
  ];
  const segment = percent < 50 ? 0 : 1;
  const ratio = segment === 0 ? percent / 50 : (percent - 50) / 50;
  const start = stops[segment];
  const end = stops[segment + 1];
  const channel = (index) => Math.round(start[index] + ((end[index] - start[index]) * ratio));
  return `#${[channel(0), channel(1), channel(2)]
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')}`;
}

function makeProgressSection(qx, title) {
  const box = new qx.ui.container.Composite(new qx.ui.layout.VBox(4));
  const header = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
  const name = makeLabel(qx, title, { font: 'bold' });
  const percent = makeLabel(qx, '0%');
  header.add(name, { flex: 1 });
  header.add(percent);

  const progressTrack = new qx.ui.container.Composite(
    new qx.ui.layout.HBox(0)
  );
  progressTrack.set({
    height: 18,
    minHeight: 18,
    maxHeight: 18,
    backgroundColor: '#30363d'
  });

  const progressFill = new qx.ui.core.Widget();
  const progressRemainder = new qx.ui.core.Widget();
  progressFill.set({ backgroundColor: '#4caf50' });
  progressTrack.add(progressFill, { flex: 0 });
  progressTrack.add(progressRemainder, { flex: 100 });

  const progress = {
    setValue(value) {
      const normalized = Math.max(0, Math.min(100, Number(value) || 0));
      // Qooxdoo HBox flex values are integer weights. Keep two decimal places
      // of percentage precision so small but valid MCV progress is visible.
      const filledWeight = Math.round(normalized * 100);
      progressFill.set({ backgroundColor: progressColor(normalized) });
      progressFill.setVisibility?.(filledWeight === 0 ? 'excluded' : 'visible');
      progressRemainder.setVisibility?.(
        filledWeight === 10000 ? 'excluded' : 'visible'
      );
      progressFill.setLayoutProperties({ flex: filledWeight });
      progressRemainder.setLayoutProperties({ flex: 10000 - filledWeight });
    }
  };

  const amount = makeLabel(qx, '—');
  const detail = makeLabel(qx, '—', { textColor: '#17262d', font: 'bold' });

  box.add(header);
  box.add(progressTrack);
  box.add(amount);
  box.add(detail);

  return { box, percent, progress, amount, detail };
}

export function buildNextMCVWindow(context, options = {}) {
  const qx = globalThis.qx;
  const embedded = Boolean(options.embedded);
  const content = new qx.ui.container.Composite(new qx.ui.layout.VBox(embedded ? 6 : 10));
  content.set({ padding: embedded ? 5 : 10 });
  if (embedded) content.set({ backgroundColor: '#b8c3c5', textColor: '#344448' });

  const compactSummary = new qx.ui.container.Composite(new qx.ui.layout.VBox(3));
  const compactCredits = makeLabel(qx, 'C$: Reading MCV data…', {
    font: 'bold', wrap: false
  });
  const compactResearch = makeLabel(qx, 'RP: Reading MCV data…', {
    font: 'bold', wrap: false
  });
  compactSummary.add(compactCredits);
  compactSummary.add(compactResearch);
  compactSummary.setVisibility?.('excluded');
  content.add(compactSummary);

  const detailed = new qx.ui.container.Composite(new qx.ui.layout.VBox(embedded ? 6 : 10));

  const summary = makeLabel(qx, 'Reading Next MCV progress from the Suite Hub…');
  summary.set({ font: 'bold', wrap: true });
  detailed.add(summary);

  const credits = makeProgressSection(qx, 'Credits');
  const research = makeProgressSection(qx, 'Research Points');
  if (embedded) {
    credits.detail.set?.({ rich: true });
    research.detail.set?.({ rich: true });
  }
  detailed.add(credits.box);
  detailed.add(research.box);

  const footer = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
  const updated = makeLabel(qx, 'Not updated yet');
  if (embedded) updated.set?.({ rich: true });
  const refresh = new qx.ui.form.Button('Refresh');
  footer.add(updated, { flex: 1 });
  if (!embedded) footer.add(refresh);
  detailed.add(footer);
  content.add(detailed);

  let disposed = false;
  let timer = null;

  const renderError = (error) => {
    summary.setValue(error?.message || 'Unable to read Next MCV data.');
    credits.percent.setValue('—');
    credits.progress.setValue(0);
    credits.amount.setValue('Hub data unavailable');
    credits.detail.setValue('');
    research.percent.setValue('—');
    research.progress.setValue(0);
    research.amount.setValue('Hub data unavailable');
    research.detail.setValue('');
    updated.setValue('Waiting for Hub data');
    compactCredits.setValue('C$: MCV data unavailable');
    compactResearch.setValue('RP: MCV data unavailable');
  };

  const refreshData = () => {
    if (disposed) return;

    try {
      const data = NextMCVCalculator.readHub(context);
      const creditValue = data.credits.percent;
      const researchValue = data.research.percent;
      const displayPercent = (value) => {
        const rounded = Math.round(value * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      };
      compactCredits.setValue(
        `C$: ${formatNumber(data.credits.current)} / ${formatNumber(data.credits.required)}`
        + ` (${data.credits.complete ? 'Ready' : `${displayPercent(creditValue)}%`})`
      );
      compactResearch.setValue(
        `RP: ${formatNumber(data.research.current)} / ${formatNumber(data.research.required)}`
        + ` (${data.research.complete ? 'Ready' : `${displayPercent(researchValue)}%`})`
      );

      summary.setValue(
        data.ready
          ? 'Next MCV requirements are complete.'
          : `Overall progress: ${displayPercent(data.overallPercent)}%`
      );

      credits.percent.setValue(
        data.credits.complete ? 'Ready' : `${displayPercent(creditValue)}%`
      );
      credits.progress.setValue(creditValue);
      credits.amount.setValue(
        settings.showAmounts
          ? `${formatNumber(data.credits.current)} / ${formatNumber(data.credits.required)}`
          : ''
      );
      credits.detail.setValue(
        settings.showETA
          ? embedded
            ? `Rem: ${formatNumber(data.credits.remaining)}<br>ETA: ${formatDuration(data.credits.etaSeconds)}`
            : `Remaining: ${formatNumber(data.credits.remaining)}  •  ETA: ${formatDuration(data.credits.etaSeconds)}`
          : `${embedded ? 'Rem' : 'Remaining'}: ${formatNumber(data.credits.remaining)}`
      );

      research.percent.setValue(
        data.research.complete ? 'Ready' : `${displayPercent(researchValue)}%`
      );
      research.progress.setValue(researchValue);
      research.amount.setValue(
        settings.showAmounts
          ? `${formatNumber(data.research.current)} / ${formatNumber(data.research.required)}`
          : ''
      );
      research.detail.setValue(
        `${embedded ? 'Rem' : 'Remaining'}: ${formatNumber(data.research.remaining)}`
      );

      const updatedAt = new Date(data.updatedAt);
      updated.setValue(
        embedded
          ? `Updated ${updatedAt.toLocaleTimeString()}<br>${updatedAt.toLocaleDateString()}`
          : `Updated ${updatedAt.toLocaleTimeString()}`
      );
    } catch (error) {
      renderError(error);
      if (!/not published|unavailable/i.test(error?.message ?? '')) {
        context?.logger?.warn?.('Next MCV refresh failed.', error);
      }
    }
  };

  refresh.addListener('execute', refreshData);
  content.addListenerOnce('dispose', () => {
    disposed = true;
    clearInterval(timer);
  });

  refreshData();
  timer = setInterval(refreshData, Math.max(5, settings.refreshSeconds) * 1000);

  let compact = false;
  const setCompact = (value) => {
    compact = Boolean(value);
    detailed.setVisibility?.(compact ? 'excluded' : 'visible');
    compactSummary.setVisibility?.(compact ? 'visible' : 'excluded');
  };
  windowControllers.set(content, {
    setCompact,
    isCompact: () => compact,
    refresh: refreshData
  });

  return content;
}

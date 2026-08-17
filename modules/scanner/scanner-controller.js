(() => {
  'use strict';

  const HOST = globalThis.window ?? globalThis;
  const ROOT = (HOST.CnCTA = HOST.CnCTA || {});
  const SAVED_LAYOUTS_KEY = 'module:scanner:saved-layouts:v1';

  class ScannerController {
    constructor(hub, logger = null, storage = null) {
      this.hub = hub;
      this.logger = logger;
      this.storage = storage;
      this.abortController = null;
      this.layoutCache = new Map();
      this.lastOptions = null;
      this.resumeFrom = 0;
      this.paused = false;
      this.rawResults = [];
      this.filterId = 'all';
      this.siloFilterId = 'none';
      this.listeners = new Set();
      this.savedLayouts = [];
      this.savedReady = this.loadSavedLayouts();
      this.state = {
        running: false,
        progress: { phase: 'idle', current: 0, total: 0 },
        error: null
      };
    }

    async loadSavedLayouts() {
      const saved = await this.storage?.get?.(SAVED_LAYOUTS_KEY, []) ?? [];
      this.savedLayouts = Array.isArray(saved) ? saved.map(ROOT.ScannerCalculator.normalizeResult) : [];
      return this.savedLayouts;
    }

    async getSavedLayouts() {
      await this.savedReady;
      return [...this.savedLayouts];
    }

    async saveLayouts(results) {
      await this.savedReady;
      const saved = new Map(this.savedLayouts.map(result => [`${result.x}:${result.y}`, result]));
      for (const result of results || []) {
        const normalized = ROOT.ScannerCalculator.normalizeResult(result);
        saved.set(`${normalized.x}:${normalized.y}`, normalized);
      }
      this.savedLayouts = [...saved.values()];
      await this.storage?.set?.(SAVED_LAYOUTS_KEY, this.savedLayouts);
      return this.getSavedLayouts();
    }

    async removeSavedLayouts(results) {
      await this.savedReady;
      const removed = new Set((results || []).map(result => `${result.x}:${result.y}`));
      this.savedLayouts = this.savedLayouts.filter(result => !removed.has(`${result.x}:${result.y}`));
      await this.storage?.set?.(SAVED_LAYOUTS_KEY, this.savedLayouts);
      return this.getSavedLayouts();
    }

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.getState());
      return () => this.listeners.delete(listener);
    }

    emit() {
      const state = this.getState();
      for (const listener of this.listeners) listener(state);
    }

    getState() {
      return {
        ...this.state,
        filterId: this.filterId,
        siloFilterId: this.siloFilterId,
        results: ROOT.ScannerCalculator.filterResults(this.rawResults, this.filterId, this.siloFilterId)
      };
    }

    getOptionsSnapshot() {
      return this.hub.scanner.getOptionsSnapshot();
    }

    setFilter(filterId) {
      this.filterId = filterId || 'all';
      this.emit();
    }

    setSiloFilter(filterId) {
      this.siloFilterId = filterId || 'none';
      this.emit();
    }

    async start(options) {
      this.stop();
      this.lastOptions = { ...options };
      this.resumeFrom = 0;
      this.paused = false;
      return this.run(this.lastOptions);
    }

    async run(options) {
      this.abortController = new AbortController();
      if (!options.resumeFrom) this.rawResults = [];
      this.state = {
        running: true,
        progress: { phase: 'discovering', current: 0, total: 0 },
        error: null
      };
      this.emit();
      try {
        const scanned = await this.hub.scanner.scan(
          options,
          progress => {
            this.state.progress = progress;
            this.resumeFrom = Number(progress?.current ?? this.resumeFrom);
            if (progress?.result) {
              const key = String(progress.result.id);
              const index = this.rawResults.findIndex(result => String(result.id) === key);
              if (index >= 0) this.rawResults[index] = progress.result;
              else this.rawResults.push(progress.result);
            }
            this.emit();
          },
          this.abortController.signal,
          this.layoutCache
        );
        for (const result of scanned) {
          if (!this.rawResults.some(item => String(item.id) === String(result.id))) this.rawResults.push(result);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          this.state.error = error?.message || String(error);
          this.logger?.error?.('Scanner run failed.', error);
        }
      } finally {
        this.state.running = false;
        this.emit();
      }
    }

    stop() {
      this.abortController?.abort();
      this.abortController = null;
      if (this.state.running) {
        this.state.running = false;
        this.emit();
      }
    }

    pause() {
      if (!this.state.running) return;
      this.paused = true;
      this.abortController?.abort();
      this.abortController = null;
      this.state.running = false;
      this.state.progress = { ...this.state.progress, phase: 'paused' };
      this.emit();
    }

    resume() {
      if (!this.paused || !this.lastOptions) return Promise.resolve();
      this.paused = false;
      return this.run({ ...this.lastOptions, resumeFrom: this.resumeFrom });
    }

    clear() {
      this.stop();
      this.rawResults = [];
      this.layoutCache.clear();
      this.paused = false;
      this.resumeFrom = 0;
      this.state.progress = { phase: 'idle', current: 0, total: 0 };
      this.state.error = null;
      this.emit();
    }

    focus(result, openCombat = false) {
      this.hub.scanner.focusResult(result, openCombat);
    }
  }

  ROOT.ScannerController = ScannerController;
})();

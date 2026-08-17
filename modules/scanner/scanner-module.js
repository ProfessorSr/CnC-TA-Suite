import '../../core/game/hub/scanner-hub-extension.js';
import './scanner-calculator.js';
import './scanner-controller.js';
import './scanner-layout-window.js';
import './scanner-window.js';

const HOST = globalThis.window ?? globalThis;
const ROOT = (HOST.CnCTA = HOST.CnCTA || {});

export class ScannerModule {
  constructor() {
    this.id = 'scanner';
    this.name = 'Scanner';
    this.title = 'Scanner Overview';
    this.version = '0.6.0';
    this.author = 'ProfessorSr';
    this.description = 'Scans and filters target layouts, exports CNCOpt links, and persists selected layouts.';
    this.manual = Object.freeze({
      id: this.id, title: this.name, summary: this.description,
      steps: ['Choose target types and ranges.', 'Combine a resource-mix filter with an optional silo-touch filter.', 'Start the scan, open Get Layouts, then select cards to export or save.'],
      controls: [['Scan', 'Starts target discovery.'], ['Pause / Resume', 'Controls current work.'], ['Get Layouts', 'Shows selectable layout cards.'], ['Export Selected', 'Copies coordinates and CNCOpt mini links.'], ['Save Selected', 'Persists layouts through refreshes.'], ['Saved Layouts', 'Opens or removes stored layouts.'], ['Clear', 'Removes current scan results.']], notes: ['The 2 Touch filters require two separate empty silo positions that each touch at least four or five Tiberium fields.']
    });
    this.category = 'World';
    this.settingsKey = 'scanner';
    this.controller = null;
    this.scannerWindow = null;
  }

  async start() {
    // Opens on demand through the Suite launcher/module manager.
  }

  ensureInitialized(context) {
    if (this.scannerWindow) return;

    const hub = context?.hub ?? ROOT.GameDataHub ?? HOST.GameDataHub ?? HOST.gameDataHub;
    if (!hub) throw new Error('Scanner requires GameDataHub.');
    if (typeof ROOT.installScannerHubExtension !== 'function') {
      throw new Error('Scanner Hub extension was not loaded.');
    }
    if (typeof ROOT.ScannerController !== 'function' || typeof ROOT.ScannerWindow !== 'function') {
      throw new Error('Scanner UI components were not loaded.');
    }

    ROOT.installScannerHubExtension(hub);
    this.controller = new ROOT.ScannerController(hub, context?.logger, context?.storage);
    this.scannerWindow = new ROOT.ScannerWindow(this.controller);
    context?.windows?.attachHelpButton?.(this.scannerWindow.window, 'scanner');
    context?.windows?.attachHelpButton?.(this.scannerWindow.layoutWindow?.window, 'scanner');
  }

  async open(context) {
    this.ensureInitialized(context);
    this.scannerWindow.open();
    return this.scannerWindow.window;
  }

  async stop() {
    this.controller?.stop?.();
  }

  async disable() {
    this.controller?.stop?.();
    this.scannerWindow?.window?.close?.();
    this.scannerWindow?.layoutWindow?.window?.close?.();
  }

  async destroy() {
    this.controller?.stop?.();
    this.scannerWindow?.unsubscribe?.();
    this.scannerWindow?.layoutWindow?.window?.destroy?.();
    this.scannerWindow?.window?.destroy?.();
    this.controller = null;
    this.scannerWindow = null;
  }
}

export default ScannerModule;

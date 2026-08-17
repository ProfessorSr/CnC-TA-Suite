// Framework-wide help lives here. Module-specific help belongs to each module's
// `manual` contract and is discovered from the live enabled-module registry.
const section = (id, title, summary, steps = [], controls = [], notes = []) =>
  Object.freeze({ id, title, summary, steps: Object.freeze(steps), controls: Object.freeze(controls), notes: Object.freeze(notes) });

export const MANUAL_SECTIONS = Object.freeze([
  section('welcome', 'Welcome to CnC-TA-Suite',
    'CnC-TA-Suite adds native-looking tools to Tiberium Alliances. The table of contents automatically includes help supplied by enabled modules.',
    ['Wait for the Suite-ready notification.', 'Open Module Manager from the top bar or right-side dock.', 'Enable only the tools you want.', 'Return here to see documentation for the enabled set.'],
    [['Module Manager', 'Controls which installed tools are enabled.'], ['Search', 'Searches framework help and enabled-module help.'], ['Previous / Next', 'Moves through the currently visible chapters.']]),
  section('getting-started', 'Getting Started',
    'A short setup path for a newly installed Suite.',
    ['Build and load the unpacked extension.', 'Open Tiberium Alliances and wait for Suite readiness.', 'Review enabled modules in Module Manager.', 'Open Suite Status to confirm integration health.', 'Use this manual for the modules you enable.'],
    [['Module Manager', 'Enables and disables installed modules.'], ['Command Manual', 'Provides live contextual instructions.'], ['Suite Status', 'Reports compatibility and health.']]),
  section('new-player-guide', 'New Player Guide',
    'Start with informational tools, then add planning and action tools as you become comfortable with them.',
    ['Enable Player Intelligence to understand the player and every owned base.', 'Use Repair Manager after combat and Next MCV for expansion planning.', 'Use Scanner and War Room together for target planning.', 'Review every confirmation before resource or upgrade actions.'],
    [['Player Intelligence', 'Explains player and base state.'], ['Scanner and War Room', 'Support target discovery and attack planning.'], ['Next MCV', 'Tracks expansion requirements.']]),
  section('module-index', 'Enabled Module Index',
    'A live inventory of enabled modules, including version, renderer type, and description.',
    ['Click Enabled Modules beneath the table of contents.', 'Find a module by name.', 'Open its supplied guide from the table of contents or Search.'],
    [['Enabled Modules', 'Opens the live enabled-module inventory.'], ['Table of Contents', 'Contains only framework chapters and enabled-module guides.']]),
  section('search-guide', 'Search Command Manual',
    'Searches framework chapters and documentation contributed by enabled modules.',
    ['Type a feature, control, or module name.', 'Choose a matching chapter or control.', 'Clear Search to restore the complete live table of contents.'],
    [['Search', 'Filters continuously while you type.'], ['Subtopic result', 'Opens its parent guide.']]),
  section('faq', 'Frequently Asked Questions',
    'Answers common setup and visibility questions.', [], [
      ['Why is a module missing from this manual?', 'Only installed and enabled modules contribute documentation. Enable it in Module Manager.'],
      ['Why is a button grey?', 'The current view or game state does not permit that action.'],
      ['Why did a module button disappear?', 'Disabled modules remove their controls and manual chapters.'],
      ['Does the Suite attack automatically?', 'No unattended attack launching is implemented.'],
      ['Where are settings saved?', 'Module settings use Suite storage and persist across reloads.'],
      ['What should accompany a bug report?', 'Include a redacted diagnostic bundle and the exact view and action that triggered the issue.']
    ]),
  section('troubleshooting', 'Troubleshooting',
    'A repeatable path for missing buttons, empty data, compatibility failures, slow behavior, or windows that do not open.',
    ['Confirm the module is installed and enabled.', 'Confirm the required game view is open.', 'Check Suite Status for compatibility, monitor, event, and performance errors.', 'Reload the extension after rebuilding.', 'Capture and review the redacted diagnostic export.'],
    [['Suite Status Refresh', 'Captures current health.'], ['Module Manager Enabled', 'Restarts a failed optional module.'], ['Diagnostic Export', 'Creates a redacted support bundle.']]),
  section('whats-new', 'What’s New and Release Notes',
    'Current work emphasizes a maintainable framework and independently packaged module behavior.',
    ['Review CHANGELOG for release detail.', 'Use Dashboard for installed versions.', 'Use this page for framework-level changes.'],
    [['Distributed help', 'Enabled modules now contribute their own Command Manual chapters.']]),
  section('shared-interface', 'Shared Interface and Buttons',
    'Suite windows use common native-style behavior.',
    ['Click a dock icon to open its module.', 'Use Module Manager to enable, disable, or inspect modules.', 'Generated settings save immediately.'],
    [['Enabled', 'Starts or stops a module.'], ['Open', 'Opens a module window.'], ['Refresh', 'Reads current game state again.'], ['Clear / Reset', 'Clears results or restores initial state.'], ['Copy', 'Copies formatted output.']]),
  section('glossary', 'Glossary of Terms', 'Common game and Suite terminology.', [], [
    ['MCV', 'Mobile Construction Vehicle; shorthand for founding the next base.'], ['CY', 'Construction Yard.'], ['DF', 'Defense Facility.'], ['CP', 'Command Points.'], ['RP', 'Research Points.'],
    ['Hub', 'Suite-owned normalized data layer between ClientLib and modules.'], ['ClientLib', 'EA game client API.'], ['Qooxdoo', 'The UI framework used by the game and Suite.'],
    ['Module API', 'Versioned contract between Suite Core and modules.'], ['Manual contract', 'Documentation metadata exposed by a module while it is installed and enabled.'], ['Support bundle', 'Redacted diagnostic JSON used for troubleshooting.']
  ])
]);

export const MANUAL_BY_ID = Object.freeze(Object.fromEntries(MANUAL_SECTIONS.map((entry) => [entry.id, entry])));

# Project Tree

Generated from the source repository. Build output in `dist/` and local metadata such as `.git/` and `.DS_Store` are intentionally omitted.

```text
CnC-TA-Suite/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── workflows/
│       └── validate.yml
├── assets/
│   └── .gitkeep
├── core/
│   ├── bootstrap/
│   │   ├── bootstrap.js
│   │   ├── lifecycle.js
│   │   ├── loader.js
│   │   └── startup.js
│   ├── clientlib/
│   │   ├── clientLibManager.js
│   │   ├── clientlib.js
│   │   ├── discovery.js
│   │   ├── qxManager.js
│   │   └── wrappers.js
│   ├── diagnostics/
│   │   └── diagnosticsService.js
│   ├── events/
│   │   ├── eventBus.js
│   │   ├── eventTypes.js
│   │   ├── publisher.js
│   │   └── subscriber.js
│   ├── game/
│   │   ├── alliance/
│   │   │   └── allianceService.js
│   │   ├── base/
│   │   │   └── baseService.js
│   │   ├── battle/
│   │   │   ├── battleObjectRegistry.js
│   │   │   ├── battleService.js
│   │   │   ├── formationModel.js
│   │   │   ├── registerBattleServices.js
│   │   │   └── unitModel.js
│   │   ├── cache/
│   │   │   └── cacheManager.js
│   │   ├── city/
│   │   │   └── cityService.js
│   │   ├── compatibility/
│   │   │   ├── compatibilityDetector.js
│   │   │   ├── compatibilityRules.js
│   │   │   └── versionManager.js
│   │   ├── discovery/
│   │   │   ├── environmentDiscovery.js
│   │   │   ├── objectDiscovery.js
│   │   │   └── readinessProbe.js
│   │   ├── events/
│   │   │   └── gameStateMonitor.js
│   │   ├── player/
│   │   │   └── playerService.js
│   │   ├── public/
│   │   │   └── gameApi.js
│   │   ├── recovery/
│   │   │   └── integrationWatchdog.js
│   │   ├── registry/
│   │   │   ├── gameObjectRegistry.js
│   │   │   └── serviceRegistry.js
│   │   ├── selection/
│   │   │   └── selectionManager.js
│   │   ├── startup/
│   │   │   └── startupSynchronizer.js
│   │   ├── world/
│   │   │   └── worldService.js
│   │   ├── city.js
│   │   ├── game.js
│   │   ├── gameIntegration.js
│   │   ├── objects.js
│   │   ├── player.js
│   │   ├── scanner.js
│   │   ├── version.js
│   │   └── world.js
│   ├── hooks/
│   │   ├── hooks.js
│   │   ├── injector.js
│   │   └── observers.js
│   ├── interfaces/
│   │   └── module.js
│   ├── modules/
│   │   ├── dependencyResolver.js
│   │   ├── index.js
│   │   ├── moduleContext.js
│   │   ├── moduleEvents.js
│   │   ├── moduleLoader.js
│   │   ├── moduleManager.js
│   │   ├── moduleManifest.js
│   │   ├── modulePermissions.js
│   │   ├── moduleRegistry.js
│   │   └── moduleSettings.js
│   ├── settings/
│   │   ├── defaults.js
│   │   ├── schema.js
│   │   ├── settings.js
│   │   └── validator.js
│   ├── storage/
│   │   ├── chromeStorage.js
│   │   ├── localStorage.js
│   │   ├── migration.js
│   │   └── storage.js
│   ├── theme/
│   │   ├── colors.js
│   │   ├── fonts.js
│   │   ├── icons.js
│   │   ├── spacing.js
│   │   └── theme.js
│   ├── ui/
│   │   ├── components.js
│   │   ├── contextMenu.js
│   │   ├── controls.js
│   │   ├── dialogs.js
│   │   ├── toolbar.js
│   │   └── ui.js
│   ├── utils/
│   │   ├── dom.js
│   │   ├── helpers.js
│   │   ├── logger.js
│   │   ├── timers.js
│   │   └── version.js
│   └── windows/
│       ├── docking.js
│       ├── draggable.js
│       ├── modal.js
│       ├── notifications.js
│       ├── resizable.js
│       └── windowManager.js
├── docs/
│   ├── 01 - Project/
│   │   ├── Goals.md
│   │   ├── Mission.md
│   │   ├── Principles.md
│   │   ├── Repository Structure.md
│   │   ├── Roadmap.md
│   │   ├── Versioning.md
│   │   └── Vision.md
│   ├── 02 - Architecture/
│   │   ├── Architecture.md
│   │   ├── Bootstrap.md
│   │   ├── Core.md
│   │   ├── Events.md
│   │   ├── Logging.md
│   │   ├── Modules.md
│   │   ├── Performance.md
│   │   ├── Security.md
│   │   ├── Settings.md
│   │   ├── Storage.md
│   │   ├── Themes.md
│   │   └── Windows.md
│   ├── 03 - UI/
│   │   ├── Accessibility.md
│   │   ├── Color System.md
│   │   ├── Components.md
│   │   ├── Design System.md
│   │   ├── Icons.md
│   │   ├── Layout.md
│   │   ├── Typography.md
│   │   └── UI Standards.md
│   ├── 04 - Development/
│   │   ├── Branching.md
│   │   ├── CSS.md
│   │   ├── Coding Standards.md
│   │   ├── Debugging.md
│   │   ├── Git.md
│   │   ├── HTML.md
│   │   ├── JavaScript.md
│   │   ├── Releases.md
│   │   ├── Reviews.md
│   │   ├── Testing.md
│   │   ├── v0.3.0 Integration Audit.md
│   │   └── v0.3.0 Part 5 Validation.md
│   ├── 05 - Modules/
│   │   ├── Game Integration/
│   │   │   ├── Part 1 - Core Discovery.md
│   │   │   ├── Part 2 - Services.md
│   │   │   ├── Part 3 - Battle and Selection.md
│   │   │   └── Part 4 - Events and Hooks.md
│   │   ├── API.md
│   │   ├── Battle Simulator.md
│   │   ├── Defense.md
│   │   ├── Formation.md
│   │   ├── Launcher.md
│   │   ├── Optimizer.md
│   │   ├── Plugins.md
│   │   ├── Settings.md
│   │   └── Statistics.md
│   ├── 06 - Reference/
│   │   ├── API Reference.md
│   │   ├── Event Reference.md
│   │   ├── Game Integration.md
│   │   ├── Glossary.md
│   │   ├── Keyboard Shortcuts.md
│   │   ├── Object Reference.md
│   │   └── Terminology.md
│   └── 07 - Decisions/
│       ├── ADR-0001.md
│       ├── ADR-0002.md
│       ├── ADR-0003.md
│       └── ADR-Template.md
├── manifest/
│   └── chrome/
│       ├── bridge.js
│       ├── manifest.json
│       ├── suite.css
│       └── suite.js
├── modules/
│   ├── launcher/
│   │   ├── launcher.css
│   │   ├── launcher.js
│   │   └── launcherWindow.js
│   └── suite-status/
│       ├── suiteStatus.css
│       ├── suiteStatus.js
│       └── suiteStatusWindow.js
├── scripts/
│   └── build/
│       └── build-extension.mjs
├── tests/
│   ├── integration/
│   │   ├── bootstrap.test.md
│   │   ├── gameIntegration.test.md
│   │   └── part3-battle-api.test.md
│   ├── mocks/
│   │   └── gameGlobals.js
│   └── unit/
│       ├── battleObjectRegistry.test.js
│       ├── cacheManager.test.js
│       ├── compatibilityDetector.test.js
│       ├── dependencyResolver.test.js
│       ├── eventBus.test.js
│       ├── eventBusDiagnostics.test.js
│       ├── formationModel.test.js
│       ├── gameObjectRegistry.test.js
│       ├── moduleEvents.test.js
│       ├── moduleManager.test.js
│       ├── moduleManifest.test.js
│       ├── modulePermissions.test.js
│       ├── moduleSettings.test.js
│       ├── serviceRegistry.test.js
│       ├── unitModel.test.js
│       └── versionManager.test.js
├── .editorconfig
├── .gitignore
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── PART
├── PROJECT_TREE.md
├── README.md
├── SECURITY.md
└── VERSION
```

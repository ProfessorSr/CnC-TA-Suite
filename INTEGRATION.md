# Integration checklist

- Add all six scripts to the suite's page-context loader in the listed order.
- Add a launcher/menu entry whose action is `CnCTA.ScannerModule.open()`.
- Confirm the Hub global name in `scanner-module.js`.
- Confirm the suite's existing `GameDataHub` object is extensible.
- Test Camps, Outposts, and Bases separately before enabling all three.
- Test `Only center on World` both enabled and disabled.
- Verify the layout icons against a known 7 Tiberium and 7 Crystal target.

The module does not automatically attack, spend resources, or issue irreversible commands.

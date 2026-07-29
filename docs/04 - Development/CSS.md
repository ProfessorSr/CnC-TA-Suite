# CSS

> Status: Active

Qooxdoo appearance and widget properties are preferred for in-game UI. CSS is appropriate for the injection shell or a browser surface that cannot be expressed natively. Scope selectors with `cnc-suite-`, avoid game-global selectors and `!important`, and do not depend on obfuscated game class names. Keep layout in Qooxdoo layout managers. Test any CSS against supported pages and remove obsolete module styles when widgets no longer consume them.

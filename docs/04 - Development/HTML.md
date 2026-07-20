# HTML

> Status: Active

The extension injects a module script and stylesheet into the game document, but suite windows and controls use Qooxdoo widgets. Raw HTML elements are not valid `WindowManager` content. Avoid `innerHTML`; use text properties or trusted, escaped static rich text. DOM queries should be limited to browser integration or compatibility discovery, scoped narrowly, and resilient to missing elements. Never mutate game-owned DOM where a Qooxdoo widget API is available.

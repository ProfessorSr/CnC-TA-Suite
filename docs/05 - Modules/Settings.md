# Settings Module

> Status: Planned UI; core settings implemented

Core settings and manifest-scoped module settings are implemented. A future Settings module should render registered schemas with native controls, descriptions, defaults, validation messages, reset actions, and persistence feedback. It must distinguish core settings from `moduleSettings.<id>`, use service APIs rather than mutate values, and confirm destructive resets. Secret values are out of scope because suite storage is not a credential vault.

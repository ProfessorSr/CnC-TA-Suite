# Terminology

> Status: Normative for v0.4.0

Use **module ID** for the lowercase manifest identifier and **settings key** for its persisted enabled-state key. **Registered** means known to the manager; **loaded** means initialization/load completed; **enabled** means active; **disabled** means inactive but loaded; **unloaded** means teardown completed. A **window** is a movable native container, a **dialog** requests focused interaction, and a **notification** is transient. A **service** provides behavior; an **object** is discovered runtime state. Use “module,” not “plugin,” for the current extension mechanism. Event constants are uppercase; event names are lowercase namespaces.

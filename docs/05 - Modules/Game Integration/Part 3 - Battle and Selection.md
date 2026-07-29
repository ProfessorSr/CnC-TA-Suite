# Game Integration — Part 3

## Scope

Part 3 provides the first shared battle-facing API.

Included:

- Battle discovery
- Attacker and defender formation access
- Unit wrappers
- Formation wrappers
- Target access
- Selection access
- Battle-object registry
- Stable public battle API

## Architectural rule

Modules must not discover combat, selection, army, or unit objects independently.

Use the v1.0.0 public facade:

```javascript
CnCTASuite.game.battle
CnCTASuite.game.selection
CnCTASuite.game.objects
```

## Notes

ClientLib method names vary between game builds. The services use ordered fallback discovery rather than binding feature modules directly to a single obfuscated method name.

# Part 3 Battle API Integration Test

After wiring the included patch instructions:

1. Build and load the extension.
2. Open the game.
3. Open DevTools.
4. Confirm the public API exists:

```javascript
CnCTASuite.context.game.api
```

5. Select a base and inspect:

```javascript
CnCTASuite.context.game.api.selection.snapshot()
```

6. Enter combat preparation or battle view and inspect:

```javascript
CnCTASuite.context.game.api.battle.state()
```

7. Confirm the returned battle state contains:

- `active`
- `target`
- `attacker`
- `defender`

8. Confirm formation objects expose:

- `size`
- `units`
- `rows()`
- `at(row, column)`
- `toJSON()`

## Regression checks

- Launcher opens.
- Suite Status opens.
- Part 1 discovery still reports Ready.
- Part 2 player/city/world services still resolve.
- No duplicate service-registration errors occur.

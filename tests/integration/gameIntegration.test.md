# Game Integration Part 1 Test

## Required checks

1. Build and load the extension.
2. Open a supported game world.
3. Confirm the launcher appears without startup errors.
4. Open Suite Status.
5. Confirm:
   - Game Integration: Ready
   - Compatibility: Passed
   - Registered Services: at least 5
   - Registered Objects: at least 6
6. In DevTools, run:

```javascript
CnCTASuite.context.game.getStatus()
```

The returned object must contain:

- `ready`
- `version`
- `compatibility`
- `services`
- `objects`

## Regression checks

- Launcher still opens.
- Suite Status still opens.
- Window movement and resize persistence still work.
- Settings and storage still initialize.

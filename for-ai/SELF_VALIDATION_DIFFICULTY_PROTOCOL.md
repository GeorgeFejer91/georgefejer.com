# Self-Validation Difficulty Protocol

This protocol exists so future agents can make difficulty changes without relying only on visual inspection.

## Validation API

The actual game page exposes:

```js
window.__unicornMazeDifficultyProtocol
```

Available calls:

- `configs()` returns the current level configuration table.
- `runTrial(level, options)` runs one fast-forwarded AI attempt on the real game state.
- `runBatch(options)` runs repeated trials across selected levels and stores the latest report.
- `lastReport()` returns the latest report.

## Recommended Batch

Use this after gameplay changes:

```js
window.__unicornMazeDifficultyProtocol.runBatch({
  levels: [1, 2, 3, 4, 5],
  runsPerLevel: 3,
  maxSeconds: 100,
  tickMs: 55
})
```

For deeper tuning, increase `runsPerLevel` to 8-12.

If browser tooling cannot call page-owned globals directly, use the auto-run URL:

`/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55`

The game writes the full JSON report into `#difficulty-report` and summary fields into the canvas dataset.

## Metrics

Each run records:

- Completion or failure/timeout.
- Simulated seconds.
- Average and maximum route length.
- Seconds without a route.
- Replans.
- Witch-near frames.
- Tree pushes and tree crushes.
- Lives lost.
- Tree gate windows.
- Moving-tree overlap count.
- Observed difficulty score.

## Pass Criteria

The default target is:

- Level 1: clearly playable.
- Level 2: playable with two witches.
- Level 3: playable but riskier.
- Level 4: hard but not blocked.
- Level 5: hardest, but at least one successful strategic route should remain possible.

No level should report moving-tree overlaps.
No level should create a permanent route block to B.
If success rate drops below 45 percent in the emulator, inspect whether the level is actually fun-hard or mechanically unfair.

## Updating This Folder

When goals or constraints change, update `PROJECT_PROTOCOL.md`.
When tuning difficulty or adding mechanics, update this file and add a dated log with the latest batch summary.

Latest log: `difficulty-validation-log-2026-06-22.md`

# Difficulty Validation Log - 2026-06-22

Validation target: `einhorn-sammler/index.html`

Command used in the actual game page:

```js
window.__unicornMazeDifficultyProtocol.runBatch({
  levels: [1, 2, 3, 4, 5],
  runsPerLevel: 3,
  maxSeconds: 100,
  tickMs: 55
})
```

Browser URL used for auto-run:

`http://127.0.0.1:4177/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55&v=difficulty-final`

## Aggregate Result

- Asset version: `20260622-difficulty-v1`
- Protocol: actual canvas game fast-forward emulator
- Total emulated runs: 15
- Levels tested: 5
- Minimum success rate: 0.67
- Average difficulty score: 71.5
- Moving-tree overlap failures: 0
- Browser console errors: 0

## Level Results

| Level | Completed | Success Rate | Avg Seconds | Avg Difficulty | Avg Route | No-Route Seconds | Tree Pushes | Tree Crushes | Lives Lost | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 3/3 | 1.00 | 39.8 | 19.1 | 56.7 | 0.0 | 0.0 | 0.0 | 0.0 | playable |
| 2 | 3/3 | 1.00 | 46.7 | 40.0 | 57.6 | 0.2 | 0.0 | 0.0 | 0.0 | playable |
| 3 | 2/3 | 0.67 | 57.4 | 83.2 | 36.4 | 16.2 | 0.0 | 0.0 | 0.7 | borderline |
| 4 | 2/3 | 0.67 | 49.3 | 84.6 | 61.4 | 0.0 | 0.7 | 0.0 | 1.0 | borderline |
| 5 | 2/3 | 0.67 | 73.3 | 130.8 | 50.7 | 27.3 | 0.0 | 0.0 | 0.0 | borderline |

## Interpretation

The five-level curve is playable under the emulator. Levels 1-2 are stable, level 3 introduces timed route blocking, level 4 adds more direct tree pressure, and level 5 is longest and hardest by score.

The current protocol passes because every level has at least one successful path in repeated actual-game simulation and no moving-tree overlap failures were observed.

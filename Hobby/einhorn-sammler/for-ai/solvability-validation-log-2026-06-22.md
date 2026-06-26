# Solvability Validation Log - 2026-06-22

Validation target: `einhorn-sammler/index.html`

Change validated:

- Level 4 was too hard because witches reached the player before a fair early tree-gate timing window.
- Added level-specific witch start delays.
- Rebalanced level 4 with slower witches, faster player speed, slightly more open routing, and less aggressive moving-tree timing.
- Kept all five levels dynamic and validated every level through the real canvas game loop.

## Pre-Balance Check

URL:

`http://127.0.0.1:4177/einhorn-sammler/?aitest=1&runs=4&seconds=110&tick=55&v=pre-balance-all-levels`

Result:

- Asset version: `20260622-stink-morph-v4`
- Minimum success rate: `0.25`
- Moving-tree overlap failures: `0`
- Level 4: `1/4`, success rate `0.25`, verdict `too-hard`
- Level 5: `2/4`, success rate `0.50`, verdict `borderline`

## Post-Balance Deep Check

URL:

`http://127.0.0.1:4177/einhorn-sammler/?aitest=1&runs=8&seconds=120&tick=55&v=post-balance-deep-v1`

Result:

- Asset version: `20260622-solvable-v1`
- Total emulated runs: `40`
- Levels tested: `5`
- Minimum success rate: `0.75`
- Average difficulty score: `67.5`
- Moving-tree overlap failures: `0`
- Browser console errors: `0`

| Level | Completed | Success Rate | Avg Seconds | Avg Difficulty | Avg Route | No-Route Seconds | Tree Pushes | Tree Crushes | Lives Lost | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 6/8 | 0.75 | 52.0 | 47.1 | 41.1 | 13.3 | 0.0 | 0.0 | 0.6 | playable |
| 2 | 6/8 | 0.75 | 39.0 | 49.2 | 54.5 | 0.1 | 0.0 | 0.0 | 0.8 | playable |
| 3 | 6/8 | 0.75 | 56.2 | 70.1 | 54.5 | 2.9 | 0.0 | 0.0 | 1.0 | playable |
| 4 | 7/8 | 0.88 | 43.1 | 81.7 | 49.0 | 6.6 | 0.1 | 0.1 | 0.4 | playable |
| 5 | 7/8 | 0.88 | 47.6 | 89.6 | 55.0 | 0.4 | 0.5 | 0.0 | 0.6 | playable |

## Constraint Added

Future chase, level-layout, tree-gate, or difficulty changes must validate all five levels. Each level should remain `playable` with at least 75 percent success in an 8-run-per-level batch, and witches must not arrive before the player has a realistic first pass window through early dynamic gates.

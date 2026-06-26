# Morph Difficulty Validation Log - 2026-06-22

Validation target: `einhorn-sammler/index.html`

Change validated:

- Added `assets/unicorn-princess-morph.png`.
- Added forward and reverse morph animation between unicorn and princess.
- Alternated player form by level: unicorn, princess, unicorn, princess, unicorn.
- Made level 1 harder with more food and more evil moving tree gates.

Browser URL used for auto-run:

`http://127.0.0.1:4177/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55&v=morph-validation2`

## Aggregate Result

- Asset version: `20260622-morph-v1`
- Total emulated runs: 15
- Levels tested: 5
- Minimum success rate: 0.67
- Average difficulty score: 73.5
- Moving-tree overlap failures: 0
- Browser console errors: 0

## Level Results

| Level | Completed | Success Rate | Avg Seconds | Avg Difficulty | Avg Route | No-Route Seconds | Tree Pushes | Tree Crushes | Lives Lost | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2/3 | 0.67 | 71.6 | 62.7 | 42.0 | 24.4 | 0.0 | 0.0 | 0.3 | borderline |
| 2 | 3/3 | 1.00 | 42.2 | 42.2 | 53.3 | 0.0 | 0.0 | 0.0 | 0.3 | playable |
| 3 | 2/3 | 0.67 | 55.4 | 79.1 | 34.6 | 12.8 | 0.0 | 0.0 | 0.7 | borderline |
| 4 | 2/3 | 0.67 | 50.2 | 82.0 | 66.9 | 0.0 | 0.0 | 0.0 | 1.0 | borderline |
| 5 | 2/3 | 0.67 | 52.9 | 101.4 | 38.8 | 7.1 | 0.3 | 0.0 | 1.0 | borderline |

## Interpretation

The morph build passes the current automated protocol. Level 1 is significantly harder than before and is now borderline under the emulator. The full curve remains playable with no moving-tree overlap failures.

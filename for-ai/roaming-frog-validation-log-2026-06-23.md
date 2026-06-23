# Roaming Frog Validation Log - 2026-06-23

## Change Under Test

- From level 3 onward the objective changes from reaching B to catching the roaming frog.
- The frog walks randomly through passable maze corridors and avoids moving tree blockers.
- The main character uses the graded unicorn-princess walking morph as a distance indicator: far from the frog reads as unicorn, close to the frog reads as princess.
- Levels 1-2 continue to use the original point-B objective.

## Local Browser Smoke Checks

- `?frogtest=1&v=roaming-frog-local`
  - `assetVersion=20260623-roaming-frog-v1`
  - `objective=frog`
  - `frogActive=true`
  - `frogWalkSprite=ready`
  - `morphWalkSprite=ready`
  - The frog cell changed over time, confirming roaming behavior.
  - No console errors.
- `?level=1&v=roaming-frog-level1`
  - `objective=exit`
  - `frogActive=false`
  - No console errors.

## AI Difficulty Protocol

Run URL:

```text
http://127.0.0.1:8123/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55&v=roaming-frog-validation-6
```

Aggregate result:

- `validationMinSuccess=1`
- `validationRuns=15`
- `validationTreeOverlapFailures=0`
- `avgDifficultyScore=51.7`
- `minSuccessRate=1`

Level summaries:

- Level 1: playable, success rate 1, average simulated seconds 37.7, difficulty 18.4.
- Level 2: playable, success rate 1, average simulated seconds 28.5, difficulty 38.0.
- Level 3: playable, success rate 1, average simulated seconds 46.2, difficulty 59.3.
- Level 4: playable, success rate 1, average simulated seconds 39.8, difficulty 64.6.
- Level 5: playable, success rate 1, average simulated seconds 40.0, difficulty 78.1.

## Future Constraint

Whenever the frog objective or moving-tree gate logic changes, rerun the AI difficulty protocol across all five levels and confirm every level has at least one successful simulated route. Level 3+ validation must target the frog, not the old B marker.

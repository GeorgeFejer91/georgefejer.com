# Broom Power-Up Validation Log - 2026-06-23

## Change Under Test

- Added `broom` as a reversed-role-only witch power-up.
- In reversed-role rounds, broom pickups replace the normal item mix and extra broomsticks are distributed across open maze cells.
- While broom flight is active, the witch player can cross all interior maze obstacles for 9 seconds, including walls, waving trees, and moving evil-tree blockers.
- Moving evil trees do not push or crush the witch player during broom flight.

## Browser Smoke Check

Run URL:

```text
http://127.0.0.1:8124/einhorn-sammler/?broomtest=1&v=broom-local
```

Observed canvas state:

- `assetVersion=20260623-broom-v1`
- `level=4`
- `objective=princess`
- `playerForm=witch`
- `reversal=true`
- `broomFlight=true`
- `broomTreats=31`
- `princessTargetActive=true`
- `assetFailed=0`
- No console errors.

## AI Difficulty Protocol

Run URL:

```text
http://127.0.0.1:8124/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55&v=broom-validation-1
```

Aggregate result:

- `assetVersion=20260623-broom-v1`
- `minSuccessRate=1`
- `treeOverlapFailures=0`
- `avgDifficultyScore=53.3`

Level summaries:

- Level 1: playable, success rate 1, average simulated seconds 37.7, difficulty 18.4.
- Level 2: playable, success rate 1, average simulated seconds 28.5, difficulty 38.0.
- Level 3: playable, success rate 1, average simulated seconds 46.2, difficulty 59.3.
- Level 4: playable, success rate 1, average simulated seconds 46.2, difficulty 75.9.
- Level 5: playable, success rate 1, average simulated seconds 28.2, difficulty 75.1.

## Future Constraint

Any future reversed-role changes should preserve broom pickups as the witch player's obstacle-crossing tool and verify `broomtest=1` still starts a witch/princess round with active broom flight.

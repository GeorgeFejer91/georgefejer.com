# Evil Frog Validation Log - 2026-06-23

## Change Under Test

- Added `evil-frog-walk.png` / `.webp` as the hostile frog walking sprite.
- Added `green-witch-run.png` / `.webp` for the player witch form.
- Added `hero-witch-corruption-walk.png` / `.webp` for the staged unicorn/princess-to-green-witch corruption animation.
- From level 4 onward, normal rounds include the good frog objective, the evil frog chasing the player, and two witches.
- If the evil frog catches the player, the game plays the corruption animation, restarts the current level as a witch, and changes the objective to catching a roaming princess.

## Browser Smoke Checks

- Local level 4 URL: `http://127.0.0.1:8124/einhorn-sammler/?level=4&v=evil-frog-local`
  - `assetVersion=20260623-evil-frog-v1`
  - `objective=frog`
  - `frogActive=true`
  - `evilFrogActive=true`
  - `evilFrogWalkSprite=ready`
  - `witchCorruptionSprite=ready`
  - `greenWitchSprite=ready`
  - `assetFailed=0`
  - No console errors.

- Forced catch test URL: `http://127.0.0.1:8124/einhorn-sammler/?evilfrogtest=1&v=evil-frog-catch-test`
  - After the evil frog caught the player: `objective=princess`, `playerForm=witch`, `reversal=true`, `princessTargetActive=true`.
  - `assetFailed=0`
  - No console errors.

- Mobile smoke check at `393x852` viewport:
  - `objective=frog`
  - `frogActive=true`
  - `evilFrogActive=true`
  - `currentSprites=ready`
  - `assetFailed=0`
  - No console errors.

## AI Difficulty Protocol

Run URL:

```text
http://127.0.0.1:8124/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55&v=evil-frog-validation-3
```

Aggregate result:

- `assetVersion=20260623-evil-frog-v1`
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

For level 4+ changes, validation must confirm both the ordinary good-frog objective and the evil-frog reversal path. The AI protocol may complete a run either by catching the good frog directly or by surviving the evil-frog corruption path and catching the princess in the reversed role.

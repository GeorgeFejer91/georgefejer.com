# Unicorn Labyrinth Chase Project Protocol

Future agents must read this file before changing `einhorn-sammler/index.html`.
After changing gameplay goals, mechanics, validation rules, assets, or deployment state, update this folder in the same commit.

## Current Project Goal

Build a smartphone-playable 2D fantasy maze chase game at `/einhorn-sammler/` on GeorgeFejer.com.
The player starts as a unicorn, reaches point B, and alternates form between unicorn and princess across levels through a visible morph animation.
The game is about escaping witches through a dynamic forest labyrinth.

## Hard Constraints

- Keep the game lightweight and static-site friendly: one HTML game page plus small local assets.
- The game is canvas based and must remain playable by tapping/clicking destinations on the screen.
- Smartphone play is the primary target. Text overlays must fit narrow portrait screens.
- Keep the minimap at the bottom-left corner.
- Do not bring back obstructive counters or large HUD panels.
- Preserve the original sprite assets for unicorn, witch, princess, frog, evil tree, good tree, and waving tree.
- Preserve the generated morph sprite sheet. It must read as a fluid design continuum, not a crossfade: princess hair becomes mane, crown exaggerates into horn, dress collapses into unicorn body, arms/legs become hooves, tail and wings emerge, and the endpoint resolves into the in-game unicorn.
- The background melody rotates randomly forever between three browser-playable MP3 arcade variants derived from the provided MLP melody source files.
- SFX should remain small 8-bit arcade style WAV files.
- Sprite loading is WebP-first with PNG fallback. The boot-critical sprites are only the player unicorn and first witch; princess, morph, second witch, frog, waving trees, evil trees, and good trees must load lazily after the first playable frame.
- Background music must use `preload="none"` and start only after player interaction. Keep unused old melody exports out of the deployed asset folder.
- Debug and validation should inspect the canvas dataset fields `assetVersion`, `assetPhase`, `assetWebp`, `assetPngFallback`, `assetDecoded`, `assetTotal`, and `currentSprites`.

## Gameplay Rules To Preserve

- The unicorn/princess moves through maze corridors toward tapped destinations.
- Reaching B should visibly transform the main character into the next form with the staged morph sprite, not a fadeover.
- Level forms alternate: unicorn, princess, unicorn, princess, unicorn.
- Every level-to-level transition must use the morph sprite as a foreground travel animation from the lower-right screen quadrant toward the upper-left screen quadrant. The forms alternate every time: unicorn to princess, princess to unicorn, and so on.
- Level-to-level form transitions and the final win transformation must stay at least 8 seconds long so the unicorn/princess morph is clearly visible on phones.
- Witches chase the player. Level 2 and later use two witches.
- Mushrooms/freeze treats make witches passable for the player while active.
- Rotten strawberries create green stench bubbles/fog that slow witches.
- Rotten strawberries should be abundant on every level; they are a core tool for keeping witches under control.
- Green leaves let the player pass through stationary waving green trees while active.
- Evil moving trees block the player, push the player if they move into the player, and crush/respawn the player if pushed into an obstacle.
- Good moving trees block witches but let the player pass.
- Moving good and evil trees must not pass through each other.
- Moving trees should patrol strategic gate paths, not randomly spawn as unfair walls.
- Every moving-tree gate must have at least one temporal state where the path is passable.
- Every level must remain actually solvable in the real game loop. Witches must not reach the player before the player has a realistic first timing window through early tree gates.
- Use level-specific witch start delays as pacing tools when a level has early dynamic gates; do not remove them unless the full validation protocol still passes.

## Level Progression

The game now has five levels. Difficulty should increase through:

- More moving tree gates.
- Faster and less patient tree patrols.
- More restrictive maze openness.
- Faster witches.
- Two witches from level 2 onward.
- Level 1 must stay clearly introductory and forgiving. Keep the first witch slow, give the player a visible start window, and avoid loading level 1 with too many evil moving-tree gates.

The German level banner appears at the top of the screen for 10 seconds at the beginning of each level.
Level banner copy should be short, exclamatory, gameshow-host style German wordplay about princesses, fairy tales, crowns, magic, and unicorns. It should not describe level mechanics like witches, moving trees, gates, food, or speed.

## Validation Requirement

Gameplay changes must be checked with the browser-callable protocol:

```js
window.__unicornMazeDifficultyProtocol.runBatch({ runsPerLevel: 3, maxSeconds: 100, tickMs: 55 })
```

Save meaningful result summaries in this folder when difficulty changes.
When browser automation cannot call page globals, use `/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55` and read `#difficulty-report`.

For difficulty, chase, tree-gate, or level-layout changes, run every level. A deeper validation should use at least 8 runs per level and each level should reach `playable` with no moving-tree overlap failures before deployment.

## Deployment Notes

Current production URL:

`http://www.georgefejer.com/einhorn-sammler/`

If a change is pushed, verify the live page reports the new `assetVersion` through the canvas dataset or debug hook.

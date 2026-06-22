# Unicorn Labyrinth Chase Project Protocol

Future agents must read this file before changing `einhorn-sammler/index.html`.
After changing gameplay goals, mechanics, validation rules, assets, or deployment state, update this folder in the same commit.

## Current Project Goal

Build a smartphone-playable 2D fantasy maze chase game at `/einhorn-sammler/` on GeorgeFejer.com.
The player starts as a unicorn, reaches point B, transforms into a princess for later rounds, and escapes witches through a dynamic forest labyrinth.

## Hard Constraints

- Keep the game lightweight and static-site friendly: one HTML game page plus small local assets.
- The game is canvas based and must remain playable by tapping/clicking destinations on the screen.
- Smartphone play is the primary target. Text overlays must fit narrow portrait screens.
- Keep the minimap at the bottom-left corner.
- Do not bring back obstructive counters or large HUD panels.
- Preserve the original sprite assets for unicorn, witch, princess, frog, evil tree, good tree, and waving tree.
- The MIDI-derived background melody is the active background music.
- SFX should remain small 8-bit arcade style WAV files.

## Gameplay Rules To Preserve

- The unicorn/princess moves through maze corridors toward tapped destinations.
- Witches chase the player. Level 2 and later use two witches.
- Mushrooms/freeze treats make witches passable for the player while active.
- Rotten strawberries create green stench bubbles/fog that slow witches.
- Green leaves let the player pass through stationary waving green trees while active.
- Evil moving trees block the player, push the player if they move into the player, and crush/respawn the player if pushed into an obstacle.
- Good moving trees block witches but let the player pass.
- Moving good and evil trees must not pass through each other.
- Moving trees should patrol strategic gate paths, not randomly spawn as unfair walls.
- Every moving-tree gate must have at least one temporal state where the path is passable.

## Level Progression

The game now has five levels. Difficulty should increase through:

- More moving tree gates.
- Faster and less patient tree patrols.
- More restrictive maze openness.
- Faster witches.
- Two witches from level 2 onward.

The German level banner appears at the top of the screen for 20 seconds at the beginning of each level.

## Validation Requirement

Gameplay changes must be checked with the browser-callable protocol:

```js
window.__unicornMazeDifficultyProtocol.runBatch({ runsPerLevel: 3, maxSeconds: 100, tickMs: 55 })
```

Save meaningful result summaries in this folder when difficulty changes.
When browser automation cannot call page globals, use `/einhorn-sammler/?aitest=1&runs=3&seconds=100&tick=55` and read `#difficulty-report`.

## Deployment Notes

Current production URL:

`http://www.georgefejer.com/einhorn-sammler/`

If a change is pushed, verify the live page reports the new `assetVersion` through the canvas dataset or debug hook.

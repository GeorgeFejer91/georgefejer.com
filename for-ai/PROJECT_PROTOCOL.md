# Unicorn Labyrinth Chase Project Protocol

Future agents must read this file before changing `einhorn-sammler/index.html`.
After changing gameplay goals, mechanics, validation rules, assets, or deployment state, update this folder in the same commit.

## Current Project Goal

Build a smartphone-playable 2D fantasy maze chase game at `/einhorn-sammler/` on GeorgeFejer.com.
The player starts as a unicorn, reaches point B on early levels, then from level 3 onward chases a roaming frog as the objective.
From level 4 onward a hostile evil frog also hunts the player; if it catches the player, the player corrupts into a green witch and the current round restarts as a witch chasing a roaming princess.
The player alternates form between unicorn and princess across level transitions through a visible morph animation.
The game is about escaping witches through a dynamic forest labyrinth.

## Hard Constraints

- Keep the game lightweight and static-site friendly: one HTML game page plus small local assets.
- The game is canvas based and must remain playable by tapping/clicking destinations on the screen.
- Smartphone play is the primary target. Text overlays must fit narrow portrait screens.
- Keep the minimap at the bottom-left corner.
- Do not bring back obstructive counters or large HUD panels.
- Preserve the established committed sprite identities for unicorn, witch, princess, frog, evil tree, good tree, and waving tree.
- The frog endpoint keeps `frog-wave.png` for normal waiting/waving and uses `frog-walk.png` as an eight-frame walking sprite for victory, transition, and frog-test rendering. Keep both derived from the same frog identity.
- The hostile frog uses `evil-frog-walk.png` as an eight-frame walking sprite from level 4 onward. It must read as a separate bad-frog actor, not as a recolored good frog dot.
- The player witch form uses `green-witch-run.png`, and evil-frog capture uses `hero-witch-corruption-walk.png` as a staged corruption sprite sheet. These sheets must preload before gameplay so corruption and reversed-role rounds do not stutter on phones.
- Evil-frog capture of the princess must play as a dramatic, centered transformation scene of at least 8 seconds before the reversed-role witch round starts. The character should be pulled toward the middle of the screen and visibly transform from princess toward witch using the staged corruption sprite.
- Witch broomstick power-ups must render with `witch-broom-flight.png`, an original generated eight-frame broom-flight sprite where the witch is visibly seated astride the broom in every frame. The broom tail must not be clipped, and frames need wide transparent gutters so neighboring poses do not visually bleed into each other.
- Preserve the generated morph sprite sheet. It must read as a fluid design continuum, not a crossfade: princess hair becomes mane, crown exaggerates into horn, dress collapses into unicorn body, arms/legs become hooves, tail and wings emerge, and the endpoint resolves into the in-game unicorn.
- The in-game princess walking sprite must visually match the princess endpoint of `unicorn-princess-morph.png`. Its current `princess-run.png` sheet is derived from the pure-princess morph frames and uses 220x230 frames.
- Morph transitions must use `unicorn-princess-morph-walk.png`, an 18 x 8 grid sprite: 18 transformation rows by 8 walking phases. The static `unicorn-princess-morph.png` remains the identity source and fallback, but visible level transitions should animate the current morph form as walking.
- The background melody rotates randomly forever between three browser-playable MP3 arcade variants derived from the provided MLP melody source files.
- SFX should remain small 8-bit arcade style WAV files.
- Sprite loading is WebP-first with PNG fallback. All gameplay sprites must be requested and decoded during the startup loading screen before the player can move; do not reintroduce gameplay-sprite lazy decoding after the first playable frame. Large sprite sheets may use the GitHub raw URL as a timed final fallback when the custom domain stalls.
- Smartphone runtime performance is a hard gameplay constraint. Keep the mobile render DPR capped, keep static maze/path/ordinary-tree rendering cached, keep sprite frames pre-scaled after decode, and keep high-volume canvas dataset/debug updates throttled during normal play.
- Background music and SFX should preload before gameplay where browser policy allows. Music playback must still start only after player interaction. Music variants may use the GitHub raw URL as a timed fallback when the custom domain stalls. Keep unused old melody exports out of the deployed asset folder.
- Debug and validation should inspect the canvas dataset fields `assetVersion`, `preloadMode`, `assetPhase`, `assetWebp`, `assetPngFallback`, `assetRawFallback`, `assetDecoded`, `assetTotal`, `currentSprites`, `sfxReady`, `musicReady`, `musicRawFallback`, and `audioReady`.
- Performance validation should also inspect `dpr`, `averageFrameMs`, `mazeCache`, `treeGateWindowFailures`, and `treeOverlaps` in the canvas dataset.
- Browser safety checks must include HTTPS certificate validation for `https://www.georgefejer.com/`. If it fails with a certificate name/principal error, fix GitHub Pages custom-domain HTTPS settings before treating the site as fully browser-safe.
- Avoid unnecessary public-page dependencies on `raw.githubusercontent.com`. Raw GitHub URLs are allowed only as timed fallback asset sources for stalled game media, and those loads must use CORS-clean requests.

## Gameplay Rules To Preserve

- The unicorn/princess moves through maze corridors toward tapped destinations.
- Levels 1-2 use the old point-B objective. From level 3 onward the frog is no longer stationary at B; it walks around the maze, and catching the frog is the objective.
- While the roaming frog objective is active, the player should visibly use the graded morph walking sprite as a proximity indicator: far from the frog reads as unicorn, close to the frog reads as princess.
- From level 4 onward, normal rounds include the good frog target, an evil frog chasing the player, and the two witches. The evil frog catch is not an ordinary life-loss; it triggers the green witch corruption animation and starts a reversed-role round.
- In a reversed-role round, the player form is `witch`, witches are disabled as enemies, the evil frog and good frog are inactive, and the objective becomes catching a roaming princess target. Completing that target advances the level or wins the game.
- Reversed-role witch rounds should place broomstick power-ups. While active, broom flight lets the witch player cross all interior maze obstacles, including walls and moving tree blockers, for a limited duration.
- In reversed-role rounds, the princess target must be faster than the witch on foot. Broom flight must be the tactical catch-up tool: it should be faster than both the walking witch and the princess target and should be placed along useful chase routes.
- Evil-frog and reversed-role logic must remain included in validation; level 4+ validation targets the good frog unless the evil frog catches the player, in which case validation must switch to the princess objective.
- Reaching B or catching the frog should visibly transform the main character into the next form with the staged morph sprite, not a fadeover.
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
- If a strategic moving-tree patrol lacks a natural timing pocket, open a small vertical waiting/crossing pocket in the maze near the patrol center instead of allowing a permanently impossible gate.
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

Current default start level for live playtesting is level 4 when no `?level=` query parameter is provided. Keep the `?level=` override working for targeted testing.

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
Also verify that `https://www.georgefejer.com/einhorn-sammler/` passes normal browser/curl certificate validation; if it does not, the repository code may be deployed correctly but browsers can still display safety warnings.

# Sprite Walking And Transformation Consistency Checklist

Future agents must use this checklist before changing any sprite atlas in `einhorn-sammler/assets/`.
For transformation-specific production workflow, also read `SPRITE_TRANSFORMATION_PROCEDURES.md`.
Update this file or the latest sprite audit report when adding new sprite classes, changing frame dimensions, or replacing generated art.

## Frame Grid Integrity

- Each atlas width must be an exact multiple of the frame width used in `einhorn-sammler/index.html`.
- Each atlas height must be an exact multiple of the frame height used in `einhorn-sammler/index.html`.
- PNG and WebP variants of the same sprite must have identical pixel dimensions and frame grids.
- The number of frames must match the constants in code, for example `morphFrameCount`, `morphWalkFrameCount`, `witchCorruptionStageCount`, `frogWalkFrameCount`, and `broomFlightFrameCount`.
- Do not leave partial neighboring sprites, cut-off limbs, weapons, staff tips, broom bristles, crowns, horns, tails, or magic effects inside adjacent cells.

## Padding And Cutoff

- Every frame must keep at least 4 transparent pixels on left and right edges whenever possible.
- Every frame must keep at least 2 transparent pixels on top unless the atlas intentionally uses a full-cell magic arc.
- Feet, hooves, broom tails, tree roots, frog toes, wand/staff tips, horns, crowns, and waving hands must never touch the frame edge.
- If a frame intentionally uses a full-cell magic ring, the character body still needs enough padding to prevent adjacent-cell bleed.
- No opaque subject pixels should touch the first or last pixel column. Border pixels are allowed only for intentional full-cell effects, and those effects must be consistent across frames.

## Walking Animation Quality

- Walking/running sprites should have at least 4 readable pose phases; 8 phases is preferred for main characters and moving enemies.
- Legs or roots must visibly alternate forward/backward over the cycle.
- Arms, staffs, broom, tree branches, hair, mane, tail, dress, cloak, and crown should move coherently with the walk cycle instead of staying frozen.
- The ground-contact point should remain stable enough that the actor does not jitter vertically unless intentional bobbing is coded.
- The apparent body size and anchor must remain stable across frames in a row.
- Side-facing actors that can move both directions must be cleanly flippable in canvas without visible one-sided cutoffs.

## Transformation Animation Quality

- Transformation atlases must be real staged image morphs, not a crossfade between unrelated sprites.
- Adjacent columns should change shape, color, props, and posture gradually.
- Late-stage frames must not insert a differently sized final endpoint. Body size, anchor, silhouette, and ground point must remain continuous.
- Rows that represent different hero forms must preserve the correct source-state identity before transforming.
- Transformation rows and walking rows must align: if the current row is a princess/unicorn midpoint, the corruption/transformation row must begin from that same midpoint.
- Final transformation frames should resemble the target identity while staying anchored to the preceding transitional body.

## Cross-Sprite Identity Consistency

- `unicorn-run.png` must match the unicorn endpoint of `unicorn-princess-morph.png`.
- `princess-run.png` must match the princess endpoint of `unicorn-princess-morph.png`.
- `unicorn-princess-morph-walk.png` must match the same 18-state princess-to-unicorn continuum as `unicorn-princess-morph.png`.
- `hero-witch-corruption-walk.png` must branch from all 18 unicorn/princess morph states and transition continuously into the green witch identity.
- `green-witch-run.png` must remain visually compatible with the final corruption frames, but the corruption atlas must not snap to a smaller inserted endpoint.
- `witch-run.png`, `witch-moon-run.png`, and `green-witch-run.png` should share compatible scale, ground, and side-view direction.
- `evil-tree-walk.png` and `good-tree-walk.png` should use the same frame count, spacing, walking direction, and anchor behavior.
- `frog-wave.png`, `frog-walk.png`, and `evil-frog-walk.png` should keep compatible frog scale and readable hand/leg motion.
- `witch-broom-flight.png` must show the witch seated astride the broom in every frame, with the broom tail fully inside the frame.

## Runtime And Mobile Constraints

- Prefer WebP for browser preload unless PNG is smaller or materially cleaner.
- Keep WebP and PNG variants synchronized whenever an asset changes.
- Large atlases must be compressed after editing and checked for dimensions, frame count, and load size.
- Avoid adding new sprite sheets without checking startup preload cost on smartphone browsers.
- After changes, bump `assetVersion` so phones fetch the new assets.

## Required Verification

- Run a frame-grid audit over all sprite files referenced by `loadSprite(...)`.
- Create or update `for-ai/sprite-audit-log-YYYY-MM-DD.md` with per-asset results.
- Confirm all modified PNG/WebP pairs have matching dimensions.
- Confirm the game page still boots locally with no console errors.
- If changes are pushed, verify the live page reports the new `assetVersion`.

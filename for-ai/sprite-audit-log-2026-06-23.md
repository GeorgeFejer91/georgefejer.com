# Sprite Audit Log - 2026-06-23

Checklist used: `for-ai/SPRITE_CONSISTENCY_CHECKLIST.md`

Scope: every sprite atlas referenced by `loadSprite(...)` in `einhorn-sammler/index.html`, plus each matching WebP variant.

## Summary

- Audited 15 sprite atlases, covering character, transformation, tree, frog, broom, and power-up-adjacent sprite families.
- Confirmed every PNG/WebP pair has matching pixel dimensions.
- Confirmed every atlas width/height is divisible by its runtime frame size.
- Confirmed expected frame counts for morph, corruption, frog, tree, and broom atlases.
- Corrected `unicorn-princess-morph-walk.png` / `.webp` where late unicorn rows in walking column 7 touched the frame edge and carried a small neighboring-frame fragment.
- Updated `unicorn-princess-morph-walk.png` to keep at least 2 px left/right padding in all frames.
- `unicorn-princess-morph-walk.png` now compresses better as PNG than WebP, so the runtime loader should prefer PNG for this atlas.

## Final Automated Audit Results

| Sprite | Grid | Runtime Frame | PNG/WebP Sync | Min Padding L/R/T/B | Result |
|---|---:|---:|---|---|---|
| `unicorn-run.png` | 4 x 1 | 220 x 160 | pass | 25 / 25 / 25 / 1 | pass |
| `princess-run.png` | 8 x 1 | 220 x 230 | pass | 31 / 41 / 3 / 5 | pass |
| `unicorn-princess-morph.png` | 18 x 1 | 220 x 230 | pass | 8 / 8 / 7 / 5 | pass |
| `unicorn-princess-morph-walk.png` | 8 x 18 | 220 x 230 | pass | 2 / 2 / 3 / 5 | pass after correction |
| `hero-witch-corruption-walk.png` | 18 x 18 | 220 x 230 | pass | 8 / 5 / 3 / 5 | pass |
| `green-witch-run.png` | 4 x 1 | 214 x 190 | pass | 32 / 33 / 25 / 1 | pass |
| `witch-broom-flight.png` | 16 x 1 | 340 x 210 | pass | 50 / 51 / 9 / 9 | pass |
| `witch-run.png` | 4 x 1 | 214 x 190 | pass | 32 / 33 / 25 / 1 | pass |
| `witch-moon-run.png` | 4 x 1 | 214 x 190 | pass | 32 / 33 / 25 / 1 | pass |
| `waving-tree-v2.png` | 4 x 1 | 180 x 180 | pass | 31 / 32 / 15 / 11 | pass |
| `evil-tree-walk.png` | 8 x 1 | 190 x 190 | pass | 40 / 41 / 6 / 6 | pass |
| `good-tree-walk.png` | 8 x 1 | 190 x 190 | pass | 50 / 52 / 18 / 14 | pass |
| `frog-wave.png` | 6 x 1 | 180 x 180 | pass | 28 / 31 / 6 / 3 | pass |
| `frog-walk.png` | 8 x 1 | 180 x 180 | pass | 28 / 31 / 4 / 4 | pass |
| `evil-frog-walk.png` | 8 x 1 | 180 x 180 | pass | 40 / 41 / 10 / 4 | pass |

## Visual Consistency Review

- Unicorn/princess family:
  - `unicorn-run.png` remains compatible with the unicorn endpoint of `unicorn-princess-morph.png`.
  - `princess-run.png` remains compatible with the princess endpoint of `unicorn-princess-morph.png`.
  - `unicorn-princess-morph-walk.png` preserves the same 18 morph rows while using 8 walking phases.
  - Corrected the late unicorn morph-walk frames so the tail, wing, horn, and ground-shadow pixels no longer touch or bleed across frame edges.

- Witch family:
  - `witch-run.png`, `witch-moon-run.png`, and `green-witch-run.png` share the same 214 x 190 runtime frame size and compatible side-view scale.
  - `hero-witch-corruption-walk.png` remains an 18 x 18 atlas and keeps the denser staged transformation into green witch without inserting a smaller endpoint.
  - `witch-broom-flight.png` keeps wide horizontal gutters; broom tail and rider remain inside every 340 x 210 frame.

- Tree family:
  - `evil-tree-walk.png` and `good-tree-walk.png` both use 8 walking frames with compatible side-view scale and safe padding.
  - `waving-tree-v2.png` has clean 4-frame stationary waving animation with hands and crown inside frame bounds.

- Frog family:
  - `frog-wave.png`, `frog-walk.png`, and `evil-frog-walk.png` have compatible scale, clean padding, and no adjacent-frame bleed.
  - Frog walking/waving frames remain visually distinguishable from evil frog walking frames.

## Corrections Made

- `unicorn-princess-morph-walk.png`
  - Removed a clipped neighboring-frame fragment in row 16, column 7.
  - Shifted affected row/column frames inside their cells to restore transparent padding.
  - Recompressed the PNG to palette format.

- `unicorn-princess-morph-walk.webp`
  - Regenerated from the corrected PNG so dimensions and frame grid remain synchronized.
  - Kept as a synchronized fallback asset, though runtime now prefers PNG because the corrected PNG is smaller.

- `einhorn-sammler/index.html`
  - Set `unicorn-princess-morph-walk.png` to `preferPng`.
  - Bumped `assetVersion` for browser cache invalidation.

## Remaining Watch Items

- Continue checking full transformation art visually after any generated replacement; automated padding checks cannot prove that a transformation reads as a true morph.
- Bottom padding of walking characters can be small because coded ground anchors expect feet/shadows near the bottom. This is acceptable when no pixels touch the border.
- If a future agent regenerates `hero-witch-corruption-walk.png`, preserve the 18 x 18 grid and the continuous late-stage witch silhouette.

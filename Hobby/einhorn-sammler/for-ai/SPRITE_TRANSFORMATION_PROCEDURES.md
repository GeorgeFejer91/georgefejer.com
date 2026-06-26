# Optimal Sprite Transformation Procedures

Future agents must read this file before creating, regenerating, repairing, or integrating transformation sprite sheets for `Hobby/einhorn-sammler/`.
Use it together with `SPRITE_CONSISTENCY_CHECKLIST.md`.

## Core Principle

Transformation sprites must be staged image morphs. They must not be crossfades, opacity overlays, or late-stage substitutions where a target sprite suddenly appears at a different size.
Every frame should read as one coherent body at that moment in the transformation.

The viewer should be able to pause on any frame and say, "this is the same character changing," not "this is two pictures blended together."

## Required Transformation Types

Current transformation families:

- `unicorn-princess-morph.png`
  - Static identity continuum.
  - Grid: 18 columns x 1 row.
  - Direction: princess endpoint to unicorn endpoint.

- `unicorn-princess-morph-walk.png`
  - Walking version of the same continuum.
  - Grid: 8 columns x 18 rows.
  - Rows: morph state, from princess-like to unicorn-like.
  - Columns: walking phase.

- `hero-witch-corruption-walk.png`
  - Corruption transformation from any current unicorn/princess morph state into green witch.
  - Grid: 18 columns x 18 rows.
  - Rows: source unicorn/princess morph state.
  - Columns: staged witch-corruption progress.

Do not change these grid semantics unless code and documentation are updated in the same commit.

## Planning A Transformation Atlas

1. Define the source identity.
   - Decide exactly which existing sprite or morph row is the visual source.
   - For row-based atlases, every row must begin from the correct row identity, not from a generic source.

2. Define the target identity.
   - The target should resemble the target character class.
   - It must inherit size, ground anchor, and pose continuity from the preceding transformation frames.
   - Do not paste the standalone target sprite as the final frame if its body scale, camera crop, or anchor differs.

3. Define the transformation axis.
   - Columns represent transformation progress.
   - Rows represent source identity states or walking states.
   - Do not mix these meanings.

4. Define key feature arcs.
   - Princess to unicorn: hair becomes mane, crown becomes horn, dress becomes body, arms/legs become hooves, tail/wings emerge.
   - Unicorn/princess to witch: skin shifts green, face becomes witch-like, clothes/robe darken, hat/staff emerge, posture becomes witch-like.
   - Witch broom: broom/rider relationship must stay constant; animation phase is motion, not transformation.

5. Define anchor and scale budgets before generating art.
   - Frame size must stay compatible with runtime code.
   - Ground point should stay stable.
   - Character body should not shrink or grow abruptly in late frames.

## Recommended Generation Workflow

Use a staged prompt set rather than one prompt asking for a complete sprite sheet when quality matters.

For a transformation with `N` stages:

1. Generate or identify source endpoint.
2. Generate or identify target endpoint.
3. Generate staged intermediate prompts at fixed percentages.
4. Keep each prompt explicitly tied to the same side-view pose, framing, and art style.
5. Assemble the atlas locally.
6. Run frame-grid, padding, and visual continuity checks.

Prompt each stage as a coherent single character, not as a blend:

```text
Create one transparent-background cartoon game sprite frame.
The character is a single coherent intermediate form at 40% transformation from [source] into [target].
Do not show two overlapping characters. Do not crossfade. Do not use ghosted double exposure.
Preserve the same side-view orientation, ground anchor, body scale, thick outline, and clean children's cartoon style.
Feature changes at this stage: [specific anatomy/clothing/color changes].
Keep generous transparent padding, no cropped limbs, no neighboring sprite parts, no text, no watermark.
```

For walking transformation rows, create or derive a full walking cycle for each transformation state:

```text
Create an 8-frame side-view walking cycle for the same character at [X]% transformation.
Legs must alternate forward/backward across frames.
Arms, hair/mane/tail/cloak/dress should move coherently.
Keep the body size, ground contact, and frame padding stable across all 8 frames.
No cropped parts and no overlap between frames.
```

## Preferred Atlas Construction

- Build atlases from transparent single-frame or row strips.
- Use exact frame dimensions from `index.html`.
- Place each frame in a transparent cell, not in a packed sprite sheet with variable cell sizes.
- Keep at least 4 px horizontal padding whenever possible.
- Put all source frames through the same alignment process.
- Quantize/compress only after all placement and cleanup is complete.

When a generated sheet has neighboring-frame bleed:

- Cut frames by the declared grid, not by visual bounding boxes.
- Remove small disconnected edge components.
- Shift the frame inside its cell to restore padding.
- Do not resize only one frame unless the whole row/atlas is re-anchored consistently.

## Continuity Rules

Adjacent transformation stages should change gradually in all of these:

- Silhouette.
- Body scale.
- Pose.
- Face.
- Color palette.
- Costume or anatomy.
- Props.
- Ground contact.
- Magic effects.

Late-stage target frames are the highest-risk area. Check them manually:

- The final frames must not suddenly become smaller.
- The final frames must not switch to a different drawing angle.
- The final frames must not introduce a different outline thickness.
- The final frames must not change the ground anchor.
- The final frames must not insert a standalone endpoint with a different crop.

## Walking-And-Transformation Coupling

For `unicorn-princess-morph-walk.png`:

- Each row is one morph state.
- Each row must contain a complete 8-frame walking cycle.
- Rows must progress along the same princess-to-unicorn continuum as `unicorn-princess-morph.png`.
- If one row changes identity features, the walking phase must still stay coherent.

For `hero-witch-corruption-walk.png`:

- Each row must correspond to the current visible hero morph state.
- Each column must move that row toward witch identity.
- It is acceptable for columns to prioritize transformation over walking, but rows must not lose their source identity in the first few columns.
- The last columns must be witch-like but remain anchored and scaled from the previous columns.

## Repair Workflow For Existing Atlases

Use this order:

1. Audit dimensions and frame counts.
2. Generate a contact sheet for the affected columns/rows.
3. Identify whether the issue is:
   - cutoff,
   - neighboring-frame bleed,
   - bad anchor,
   - bad scale jump,
   - frozen walking pose,
   - crossfade/double exposure,
   - endpoint insertion.
4. Fix mechanical spacing first.
5. Fix anchor/scale next.
6. Fix identity continuity last.
7. Recompress PNG/WebP.
8. Re-run the audit.
9. Update `assetVersion` if any game asset changes.
10. Update the sprite audit log.

## Validation Requirements

A transformation sprite change is not complete until all pass:

- Frame grid matches runtime constants.
- PNG and WebP variants have identical dimensions.
- No non-intentional alpha touches frame borders.
- No visible neighboring-frame fragments remain.
- Contact sheet review confirms gradual stage progression.
- The first frames match the source identity.
- The final frames match target identity without scale/anchor snap.
- Runtime code uses the correct frame count.
- `assetVersion` has been bumped.
- `Hobby/einhorn-sammler/for-ai/sprite-audit-log-YYYY-MM-DD.md` has been updated.

## Common Failure Modes To Avoid

- Asking an image generator for an entire sprite sheet and accepting uneven cells.
- Treating a crossfade as a transformation.
- Pasting the final target sprite into the last column.
- Letting a generated frame include pieces of adjacent frames.
- Making walking rows where the legs do not actually alternate.
- Creating a transformation atlas that visually changes direction or camera angle mid-sequence.
- Forgetting that smartphone performance matters; large atlases need compression and preload checks.

# Study 6 Questionnaire UI Browser Preview

Static browser preview for a counterbalanced four-condition emotion-induction
workflow. A one-time onboarding page is shown first, then each condition has an
emotion-induction placeholder followed by the same three-page emotion assessment
sequence.

This folder is the browser-facing representation and formatting layer for the
VR questionnaire. Reusable questionnaire assets live in
`../questionnaire-assets/`, and participant-facing neutral hand-task audio lives
in `../neutral-hand-audio/`.

`questionnaire-item-library.js` is the unified item library for the preview and
export contract. Each questionnaire/control item has one namespaced `id`, one
flat `variable_name` for spreadsheets or wide exports, one page/group, and one
result JSON path.

Run locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\emotion-sam-browser-preview\Start-EmotionSamBrowserPreview.ps1
```

The preview is constrained to the workflow panel frame, `1080dp x 720dp`.
On phone-sized screens the browser preview scales that frame down for viewing;
the native panel contract remains `1080dp x 720dp`.

By default, the page shows one participant-facing panel at a time, following the
same chronology as the app structure:

- onboarding;
- block instructions;
- SAM pictographic assessment;
- valence/arousal VAS assessment;
- particle-movement emotion VAS assessment.

The full visual storyboard is available with `?previewControls=1`. It renders
every participant-facing panel at the same `1080dp x 720dp` size with
representative selected/active states. Counterbalance order, active condition,
and audio assignment controls are deliberately not shown in the preview UI.

## Native Transfer Contract

The browser preview is not the product runtime. The native Android/Compose
panel and its `quest.questionnaire.v1` request/result handling remain
authoritative for launch, focus, result URI writing, completion callbacks, and
headset validation.

The one-time onboarding page records:

- `onboarding.polar_validation.ready`
- `onboarding.language_code`
- `onboarding.participant_first_name`
- `onboarding.participant_last_name`
- `onboarding.participant_name`
- `onboarding.age_years`
- `onboarding.handedness`
- `onboarding.gender`
- `onboarding.consent_confirmed`
- `onboarding.consent_text`
- `onboarding.signature`

The Polar H10 strip is visual-only in this browser preview. In the native app,
green readiness must be driven by the headset-side Polar state, not by browser
logic. The readiness rule mirrors the Big Red Button native Quest pattern: HR/RR
streaming, PMD ready, ECG streaming, ECG samples present, and 130 Hz ECG sample
rate.

Terminology is separated deliberately:

- `block_position` means the presentation order shown to the participant.
- `condition_id` means the counterbalanced condition assigned to that block.
- `counterbalance.order_id` defines the mapping from block positions to
  counterbalanced conditions.

Counterbalancing is represented as background request/caller-owned metadata,
not as questionnaire panel input:

- `counterbalance.order_id`
- `counterbalance.condition_ids`
- `condition.active_index`

The intended allocation is equal across the four counterbalance orders, so the
native study runner, caller, or data-logging layer assigns the next participant
from persisted allocation counts to keep `order_01` through `order_04`
balanced. The participant never chooses this, and the questionnaire panel never
asks for it.

Each induction technique placeholder uses a counterbalanced emotion scenario
order and a runtime-randomized audio instruction variant. The audio package has
four variants of essentially the same participant instruction in different
movement orders. At runtime, randomly assign those four variants across the four
blocks for a participant/session. The browser preview keeps those assignments
in the exported metadata only; the native caller owns the actual random
assignment and playback timing.

Each condition block is represented as:

1. `emotion_induction_placeholder`: condition-specific induction placeholder.
2. `sam_pictographic`: retrospective 9-picture SAM valence, arousal, and dominance/control ratings.
3. `affect_vas`: retrospective valence and arousal visual analog scale sliders.
4. `ekman_intensity`: particle-movement emotion representation visual analog scale sliders.

The induction placeholder is not a participant response page. It marks where
the native Quest app or caller-owned experiment runtime presents condition 1-4
induction content before the assessment block.

The participant assessment sequence repeats after every condition as one
three-page assessment block:

1. `sam_pictographic`: how the participant felt during the condition, using SAM valence, arousal, and dominance/control on the 9-picture manikin with left/right anchors (`Very negative` to `Very positive`; `Very inactive` to `Very active`; `Very controlled` to `Very in control`).
2. `affect_vas`: how the participant felt during the condition, using independent 0-100 valence and arousal VAS sliders.
3. `ekman_intensity`: to what degree the emotions were represented by the way the particles were moving, using independent 0-100 VAS sliders labeled with the emotion category names.

The SAM manikin rows do not preselect any picture. Each row is a forced
response: the selected marker appears only after the participant indicates a
position on that 1-9 picture scale. The valence and arousal SAM rows use the
same direct retrospective questions as the VAS page; the dominance/control row asks how
controlled or in control the participant felt during the last session.

The valence/arousal VAS sliders initialize at 50 and visibly mark the unlabeled
center position. Each VAS row presents a direct participant question above the
slider: valence asks `How positive or negative did you feel during the last
session?` with `Very negative` on the left and `Very positive` on the right;
arousal asks `How active or inactive did you feel during the last session?`
with `Very inactive` on the left and `Very active` on the right. Each VAS
slider must receive participant input once before the page can be completed, so
a retained neutral value is deliberate UI state rather than an untouched
default. The
exported response fields remain the raw 0-100 ratings. The Ekman page asks
once whether the emotions were represented by the way the particles were
moving; each slider is headed only by the emotion category name. More than one
emotion can be rated when the movement feels like a mix. They remain endpoint-only
(`Not represented` to `Clearly represented`) and do not show a center marker.

The participant assessment block records:

- `sam.valence_raw_1_9`
- `sam.arousal_raw_1_9`
- `sam.dominance_raw_1_9`
- `vas.valence_raw_0_100`
- `vas.arousal_raw_0_100`
- `ekman_intensity.anger_raw_0_100`
- `ekman_intensity.disgust_raw_0_100`
- `ekman_intensity.fear_raw_0_100`
- `ekman_intensity.happiness_raw_0_100`
- `ekman_intensity.sadness_raw_0_100`
- `ekman_intensity.surprise_raw_0_100`

The unified item library also exposes distinguishable flat variable names for
these fields, such as `sam_valence_raw_1_9`,
`affect_vas_valence_raw_0_100`, and
`particle_ekman_happiness_raw_0_100`.

The Ekman sliders are independent ratings, not a forced rank order, so mixed or
ambiguous movement impressions can be represented.

## Asset Note

Valence and arousal SAM SVGs live in the shared questionnaire asset module.
They are copied from `cwi-dis/self-assessment-manikins-svg` and retain the
BSD-2-Clause license included at:

```text
../questionnaire-assets/sam/LICENSE-BSD-2-Clause.txt
```

The SAM asset catalog lives at:

```text
../questionnaire-assets/sam/asset-catalog.json
```

Canonical ordered SAM files use zero-padded snake_case names:
`valence_01.svg` through `valence_09.svg`,
`arousal_01.svg` through `arousal_09.svg`, and
`dominance_01.svg` through `dominance_09.svg`.

The dominance/control SAM row uses custom vector redraws based on the original
five-anchor SAM dominance figure, with interpolated in-between frames for the
1-9 pictographic sequence.

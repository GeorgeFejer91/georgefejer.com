# Study 6 Questionnaire UI Browser Preview

Static browser preview for a counterbalanced four-condition emotion-induction
workflow. A one-time demographics page is shown first, then each condition has an
emotion-induction placeholder followed by the same four-page emotion assessment
sequence.

This folder is the browser-facing representation and formatting layer for the
VR questionnaire. Reusable questionnaire assets live in
`../questionnaire-assets/`, and participant-facing neutral hand-task audio lives
in `../neutral-hand-audio/`. The public audio package page is
`https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`, and the
direct MP3 base path is
`https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/`.

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

- demographics;
- block instructions;
- Self-Assessment Manikin pictographic assessment;
- valence/arousal VAS assessment;
- particle-movement emotion VAS assessment;
- virtual hand embodiment agreement ratings.

The full visual storyboard is available with `?previewControls=1`. It renders
every participant-facing panel at the same `1080dp x 720dp` size with
representative selected/active states. Counterbalance order, active condition,
and audio assignment controls are deliberately not shown in the preview UI.

## Native Transfer Contract

The browser preview is not the product runtime. The native Android/Compose
panel and its `quest.questionnaire.v1` request/result handling remain
authoritative for launch, focus, result URI writing, completion callbacks, and
headset validation.

The one-time demographics page records:

- `demographics.polar_validation.ready`
- `demographics.language_code`
- `demographics.participant_first_name`
- `demographics.participant_last_name`
- `demographics.participant_name`
- `demographics.age_years`
- `demographics.handedness`
- `demographics.gender`
- `demographics.consent_confirmed`
- `demographics.consent_text`

The Polar H10 strip is visual-only in this browser preview. In the native app,
green readiness must be driven by the headset-side Polar state, not by browser
logic. The readiness rule mirrors the Big Red Button native Quest pattern: HR/RR
streaming, PMD ready, ECG streaming, ECG samples present, and 130 Hz ECG sample
rate.

Terminology is separated deliberately:

- `block_position` means the presentation order shown to the participant.
- `condition_id` means the factor-coded VR condition assigned to that block.
- `vr_condition_id` is identical to `condition_id` in this preview contract.
- `counterbalance.order_id` defines the mapping from block positions to
  counterbalanced conditions.

The preview uses the locked neutral factor-coded condition IDs directly:

| VR condition ID | Abbreviation | Coherence | Energy/noise |
| --- | --- | --- | --- |
| `LC_LE` | Low coherence / low energy | Low | Low |
| `LC_HE` | Low coherence / high energy | Low | High |
| `HC_LE` | High coherence / low energy | High | Low |
| `HC_HE` | High coherence / high energy | High | High |

Counterbalancing is represented as background request/caller-owned metadata,
not as questionnaire panel input:

- `counterbalance.order_id`
- `counterbalance.condition_ids`
- `condition.active_index`

The real allocation scheme is defined outside the preview in
`../for-ai/study6_apk_permutation_lookup.json`, with generated normalized CSV
companions for APK variants, condition/audio catalogs, condition/audio
permutations, and participant allocation. The backend selects the next
participant row from the 100-row participant lookup, joins its `permutation_id`
to the condition/audio permutation tables, and runs all four blocks. The
participant never chooses this, and the questionnaire panel never asks for it.

Each APK run uses the selected row's four assigned VR conditions and four
assigned audio variants. The browser preview keeps these assignments in exported
metadata only; the native caller owns allocation, audio playback, block timing,
and data writing.

Each condition block is represented as:

1. `session_ready`: participant preparation screen with the `Start next session` button.
2. `vr_task_instructions`: condition-specific VR task instructions and audio.
3. `self_assessment_manikin`: retrospective 9-picture Self-Assessment Manikin pictograph valence, arousal, and dominance/control ratings.
4. `affect_vas`: retrospective valence and arousal visual analog scale sliders.
5. `emotion_representation_vas`: particle-movement emotion representation visual analog scale sliders.
6. `hand_embodiment`: adapted single-item VEQ ownership and agency ratings for the virtual hands.

The readiness and VR task instruction pages are not participant response pages.
The readiness page gives the participant control over the moment the next
condition/audio block starts. Audio playback and the development/production
condition timer begin only after the participant presses `Start next session`
and the panel advances to `vr_task_instructions`.

The participant assessment sequence repeats after every condition as one
four-page assessment block:

1. `self_assessment_manikin`: how the participant felt during the condition, using Self-Assessment Manikin pictograph valence, arousal, and dominance/control on the 9-picture manikin with compact left/right anchors (`Unpleasant` to `Pleasant`; `Low Energy` to `High Energy`; `Not in control` to `In control`).
2. `affect_vas`: how the participant felt during the condition, using independent 0-100 valence and arousal VAS sliders.
3. `emotion_representation_vas`: to what degree the emotions were represented by the way the particles were moving, using independent 0-100 VAS sliders labeled with the emotion category names.
4. `hand_embodiment`: two adapted VEQ single-item agreement ratings, one for virtual hand ownership and one for virtual hand agency, on the original 1-7 agreement scale.

The Self-Assessment Manikin pictograph rows do not preselect any picture. Each row is a forced
response: the selected marker appears only after the participant indicates a
position on that 1-9 picture scale. The row labels ask `How pleasant did this
experience feel?`, `How activated did you feel?`, and `How much control did
you feel during your experience?`.

The valence/arousal VAS sliders initialize at 50 and visibly mark the unlabeled
center position. Each VAS row presents a direct participant question above the
slider: valence asks `How pleasant did the previous experience feel?` with
`Unpleasant` on the left and `Pleasant` on the right; arousal asks `How
activated did you feel in the previous experience?` with `Low Energy` on the
left and `High Energy` on the right. Each VAS slider must receive participant
input once before the page can be completed, so a retained neutral value is
deliberate UI state rather than an untouched default. The exported response
fields remain the raw 0-100 ratings. The particle emotion representation page
asks `Which emotions did the particle motion remind you of? If it felt like a
mix, rate how strongly each was represented.` Each slider is headed only by the
emotion category name, in preview order: Anger, Disgust, Fear, Happiness,
Sadness, Surprise. More than one emotion can be rated when the movement feels
like a mix. They remain endpoint-only (`Not represented` to `Clearly
represented`) and do not show a center marker.
The virtual hand embodiment page asks `It felt like the virtual hands were my
own hands.` and `It felt like I was controlling the movements of the virtual
hands.` in English, or the equivalent German wording when German is selected.
Each item uses a required 1-7 Likert response with every numeric option labeled
from `Strongly disagree` to `Strongly agree`.

The participant assessment block records:

- `sam.valence_raw_1_9`
- `sam.arousal_raw_1_9`
- `sam.dominance_raw_1_9`
- `vas.valence_raw_0_100`
- `vas.arousal_raw_0_100`
- `emotion_representation_vas.anger_raw_0_100`
- `emotion_representation_vas.disgust_raw_0_100`
- `emotion_representation_vas.fear_raw_0_100`
- `emotion_representation_vas.happiness_raw_0_100`
- `emotion_representation_vas.sadness_raw_0_100`
- `emotion_representation_vas.surprise_raw_0_100`
- `hand_embodiment.ownership_raw_1_7`
- `hand_embodiment.agency_raw_1_7`

The unified item library also exposes distinguishable flat variable names for
these fields, such as `sam_valence_raw_1_9`,
`affect_vas_valence_raw_0_100`, and
`emotion_representation_vas_happiness_raw_0_100`. The adapted VEQ hand items export as
`hand_embodiment_ownership_raw_1_7` and
`hand_embodiment_agency_raw_1_7`.

The particle emotion representation sliders are independent ratings, not a
forced rank order, so mixed or ambiguous movement impressions can be
represented.

## Asset Note

Valence and arousal Self-Assessment Manikin SVGs live in the shared questionnaire asset module.
They are copied from `cwi-dis/self-assessment-manikins-svg` and retain the
BSD-2-Clause license included at:

```text
../questionnaire-assets/sam/LICENSE-BSD-2-Clause.txt
```

The Self-Assessment Manikin asset catalog lives at:

```text
../questionnaire-assets/sam/asset-catalog.json
```

Canonical ordered Self-Assessment Manikin files use zero-padded snake_case names:
`valence_01.svg` through `valence_09.svg`,
`arousal_01.svg` through `arousal_09.svg`, and
`dominance_01.svg` through `dominance_09.svg`.

The browser preview renders the dominance/control row with the neutral
`valence_05.svg` manikin scaled progressively from left to right, following the
same neutral-manikin size cue used by `konbraphat51/SAM.vue`. The copied
`dominance_01.svg` through `dominance_09.svg` assets remain in the shared
catalog for reference and future native/runtime use.

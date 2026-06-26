# Emotion SAM Browser Preview

Static browser preview for a counterbalanced four-condition emotion-induction
workflow. A one-time onboarding page is shown first, then each condition has an
emotion-induction placeholder followed by the same three-page emotion assessment
sequence.

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

Development controls and the full visual storyboard are available with
`?previewControls=1`. The storyboard renders every participant-facing panel at
the same `1080dp x 720dp` size with representative selected/active states.

## Native Transfer Contract

The browser preview is not the product runtime. The native Android/Compose
panel and its `quest.questionnaire.v1` request/result handling remain
authoritative for launch, focus, result URI writing, completion callbacks, and
headset validation.

The one-time onboarding page records:

- `onboarding.polar_validation.ready`
- `onboarding.language_code`
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

Counterbalancing is represented as request/caller-owned state:

- `counterbalance.order_id`
- `counterbalance.condition_ids`
- `condition.active_index`

The intended allocation is equal across the four counterbalance orders, so the
native study runner or caller assigns participants evenly to `order_01` through
`order_04`.

Each induction technique placeholder uses a counterbalanced emotion scenario
order and a runtime-randomized audio instruction variant. The browser preview
shows representative instruction sets and links to the audio assets so the
visual panel state is explicit; the native caller owns the actual random
assignment and playback timing.

Each condition block is represented as:

1. `emotion_induction_placeholder`: condition-specific induction placeholder.
2. `sam_pictographic`: retrospective 9-picture SAM valence and arousal ratings.
3. `affect_vas`: retrospective valence and arousal visual analog scale sliders.
4. `ekman_intensity`: particle-movement emotion representation visual analog scale sliders.

The induction placeholder is not a participant response page. It marks where
the native Quest app or caller-owned experiment runtime presents condition 1-4
induction content before the assessment block.

The participant assessment sequence repeats after every condition as one
three-page assessment block:

1. `sam_pictographic`: how the participant felt during the condition, using SAM valence and arousal on the 9-picture manikin with the same left/right anchors as the VAS rows (`Very negative` to `Very positive`; `Very inactive` to `Very active`).
2. `affect_vas`: how the participant felt during the condition, using independent 0-100 valence and arousal VAS sliders.
3. `ekman_intensity`: how strongly each Ekman emotion seemed represented by the particle movement in the scenario, using independent 0-100 VAS sliders.

The SAM manikin rows do not preselect any picture. Each row is a forced
response: the selected marker appears only after the participant indicates a
position on that 1-9 picture scale.

The valence/arousal VAS sliders initialize at 50 and visibly mark the unlabeled
center position. Each VAS row presents a direct participant question above the
slider: valence asks `How positive or negative did you feel during the last
session?` with `Very negative` on the left and `Very positive` on the right;
arousal asks `How active or inactive did you feel during the last session?`
with `Very inactive` on the left and `Very active` on the right. Each VAS
slider must receive participant input once before the page can be completed, so
a retained neutral value is deliberate UI state rather than an untouched
default. The
exported response fields remain the raw 0-100 ratings. The Ekman sliders ask
whether each emotion was represented by the scenario's particle movement; more
than one emotion can be rated when the movement feels like a mix. They remain
endpoint-only (`Not represented` to `Clearly represented`) and do not show a
center marker.

The participant assessment block records:

- `sam.valence_raw_1_9`
- `sam.arousal_raw_1_9`
- `vas.valence_raw_0_100`
- `vas.arousal_raw_0_100`
- `ekman_intensity.anger_raw_0_100`
- `ekman_intensity.disgust_raw_0_100`
- `ekman_intensity.fear_raw_0_100`
- `ekman_intensity.happiness_raw_0_100`
- `ekman_intensity.sadness_raw_0_100`
- `ekman_intensity.surprise_raw_0_100`

Each Ekman slider asks the participant to rate the degree to which that emotion
seemed represented by the particle movement in the previous scenario. The
sliders are independent ratings, not a forced rank order, so mixed or ambiguous
movement impressions can be represented.

## Asset Note

SAM SVGs are copied from `cwi-dis/self-assessment-manikins-svg` and retain the
BSD-2-Clause license included at:

```text
assets/sam/LICENSE-BSD-2-Clause.txt
```

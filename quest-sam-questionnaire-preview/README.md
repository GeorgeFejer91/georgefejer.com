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
- `onboarding.consent_text`
- `onboarding.signature`

The Polar H10 strip is visual-only in this browser preview. In the native app,
green readiness must be driven by the headset-side Polar state, not by browser
logic. The readiness rule mirrors the Big Red Button native Quest pattern: HR/RR
streaming, PMD ready, ECG streaming, ECG samples present, and 130 Hz ECG sample
rate.

Counterbalancing is represented as request/caller-owned state:

- `counterbalance.order_id`
- `counterbalance.condition_ids`
- `condition.active_index`

Each condition block is represented as:

1. `emotion_induction_placeholder`: condition-specific induction placeholder.
2. `sam_pictographic`: 9-picture SAM valence and arousal ratings.
3. `affect_vas`: valence and arousal visual analog scale sliders.
4. `ekman_intensity`: Ekman emotion intensity visual analog scale sliders.

The induction placeholder is not a participant response page. It marks where
the native Quest app or caller-owned experiment runtime presents condition 1-4
induction content before the assessment block.

The participant assessment sequence repeats after every condition:

1. `sam_pictographic`: 9-picture SAM valence and arousal ratings.
2. `affect_vas`: valence and arousal visual analog scale sliders.
3. `ekman_intensity`: Ekman emotion intensity visual analog scale sliders.

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
was felt during the previous experience. The sliders are independent ratings,
not a forced rank order, so co-occurring emotions can be represented.

## Asset Note

SAM SVGs are copied from `cwi-dis/self-assessment-manikins-svg` and retain the
BSD-2-Clause license included at:

```text
assets/sam/LICENSE-BSD-2-Clause.txt
```

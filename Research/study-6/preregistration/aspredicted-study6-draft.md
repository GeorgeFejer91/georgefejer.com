# Study 6 AsPredicted Draft

Drafted: 2026-06-30

AsPredicted guidance checked 2026-06-30: answers should be short,
standardized, and precise; the site describes 3200 characters as a recommended
limit and warns that longer PDFs may trigger warnings or rejection. The answers
below are intentionally drafted well under that ceiling.

## Decisions To Lock Before Submission

1. Runtime IDs for the four VR particle conditions: `LC_LE`, `LC_HE`,
   `HC_LE`, and `HC_HE`, or mapped `induction_a` through `induction_d`.
2. Whether participants complete one APK variant or both APK variants; if both,
   whether APK run order is fixed or counterbalanced.
3. ECG/HRV arousal feature(s), preprocessing window, and artifact criteria.
4. Ekman-to-valence/arousal cross-validation rule, if treated as confirmatory.
5. Eligibility criteria and stopping date/resource limit.

## 1. Data Collection

Have any data been collected for this study already?

No. We will not inspect, analyze, or use participant outcome data before this
preregistration is submitted. Any pilot or technical-test sessions will be
treated as technical validation only and excluded from confirmatory analyses.

## 2. Hypotheses

What is the main question being asked or hypothesis being tested in this study?

Study 6 tests whether motion-only changes in immersive 3D particle environments
can instantiate a valence-arousal state space. Four VR particle conditions cross
movement coherence with movement energy/noise: low coherence/low energy, low
coherence/high energy, high coherence/low energy, and high coherence/high
energy.

H1: coherence maps onto valence. Synchronized/high-coherence motion will
produce higher subjective valence than desynchronized/low-coherence motion.

H2: energy/noise maps onto arousal. High-energy/noisy motion will produce
higher subjective and ECG/HRV-derived physiological arousal than low-energy
motion.

H3: the four VR particle conditions will occupy the intended relative valence-arousal states:
low/low, low/high, high/low, and high/high.

H4: across the two mapping/embodiment conditions, higher valence and higher
arousal will be associated with higher virtual-hand embodiment ratings.

Ekman emotion ratings will cross-validate whether perceived particle emotions
match the intended valence-arousal mappings and allow comparison with prior
affect-motion studies.

## 3. Dependent Variables

Describe the key dependent variable(s), specifying how they will be measured.

After each condition block, participants complete the same VR assessment.
Primary subjective outcomes are valence and arousal on 0-100 sliders.
Self-Assessment Manikin pictograph valence and arousal, each rated 1-9, are
convergent outcomes; Self-Assessment Manikin pictograph dominance/control is
exploratory.

Physiological arousal is measured with ECG/HRV. The confirmatory ECG/HRV
feature or feature family, preprocessing window, and artifact criteria will be
locked before data collection.

Virtual-hand embodiment is measured with two adapted 1-7 items: ownership and
agency. Cross-validation emotion ratings are six independent 0-100 ratings for
anger, disgust, fear, happiness, sadness, and surprise, asking how strongly each
emotion was represented by the particle motion.

Demographics/demographic fields include language, age, handedness, gender,
consent confirmation, and signature.

## 4. Conditions

How many and which conditions will participants be assigned to?

The design is fully within-participant if both APK variants are retained in the
final protocol. Twenty participants complete two matched Quest APK variants:
`BG_ENV`, where particles are mapped to the background/surrounding environment,
and `HAND_AV`, where the same particles are mapped to the virtual hand avatar
texture/material. The APKs should be identical except for the particle mapping
target. In each APK run, participants experience all four VR particle
conditions:

| Condition | Intended state |
| --- | --- |
| Low coherence / low energy | low valence / low arousal |
| Low coherence / high energy | low valence / high arousal |
| High coherence / low energy | high valence / low arousal |
| High coherence / high energy | high valence / high arousal |

Coherence is desynchronized versus synchronized movement. Energy/noise is low
versus high movement energy/noise.

Within each APK run, the four VR particle conditions are presented in
randomized, counterbalanced order, using constrained randomization so
conditions appear approximately equally often in each serial position across
the target sample.

During each condition, participants perform the same five-minute neutral
hand-movement task. Language-matched audio guides are used; four audio variants
with the same timing but different movement order are shuffled across blocks and
are not experimental conditions.

## 5. Analyses

Specify exactly which analyses you will conduct to examine the main
question/hypothesis.

Confirmatory analyses use block-level data with one row per participant, APK
variant, and VR particle condition. Coherence is coded low/desynchronized vs
high/synchronized; energy is coded low vs high; APK variant is coded
`BG_ENV` vs `HAND_AV`. Mixed-effects models include participant as a random
intercept; random slopes for within-participant factors will be included if they
converge.

H1: model valence slider ratings from APK variant, coherence, energy, and their
interactions. The planned contrast is high coherence > low coherence, averaged
over energy and APK variant. Repeat for Self-Assessment Manikin pictograph
valence.

H2: model arousal slider ratings with the same predictors. The planned contrast
is high energy/noise > low energy/noise, averaged over coherence and APK variant.
Repeat for Self-Assessment Manikin pictograph arousal and for the preregistered
ECG/HRV arousal index or feature family.

H3: evaluate whether the four VR-condition means match the intended quadrants by
combining the H1 valence contrast, H2 arousal contrast, and descriptive
condition-level valence-arousal means.

H4: model ownership and agency from valence, arousal, APK variant, coherence, and
energy. Planned tests are positive associations between embodiment and valence,
and between embodiment and arousal.

Ekman cross-validation: if a precise Ekman-to-valence/arousal rule is locked
before data collection, test it as planned; otherwise report Ekman analyses as
exploratory/comparability analyses. Confirmatory tests use two-sided alpha =
.05. Exploratory models may include block position, audio variant, language,
demographics, and APK-variant interactions.

## 6. Outliers And Exclusions

Describe exactly how outliers will be defined and handled, and your precise
rule(s) for excluding observations.

Self-report outcomes are bounded rating scales, so no value will be excluded
only because it is an endpoint or extreme value.

Exclude a participant from confirmatory analyses if they do not provide
consent, withdraw, do not complete the required APK run(s) and assessments, are
ineligible under the final recruitment criteria `[TBD: eligibility criteria]`,
or have a major technical failure preventing linkage of APK variant, VR
condition, or order to outcomes.

Exclude a condition block, while retaining other valid blocks where possible,
if required outcomes are missing, data are malformed, APK variant or VR
condition IDs are invalid, language-matched audio is incorrect, or a documented
runtime failure occurs during induction or assessment.

For duplicate sessions, keep the first complete valid session unless it was
marked as a technical failure before outcome inspection; then use the first
valid rerun. ECG/HRV observations will be excluded from physiological analyses
according to preregistered preprocessing/artifact rules; this does not exclude
valid self-report data.

## 7. Sample Size

How many observations will be collected or what will determine sample size?

We will collect 20 complete participants. Each complete participant contributes
up to eight block-level observations: 2 APK variants x 4 VR particle
conditions, for a maximum of 160 block-level observations.

Recruitment stops when 20 complete valid participants are reached, or at
`[TBD: stopping date/resource limit]`, whichever comes first. Participants
excluded before confirmatory analysis may be replaced until 20 complete valid
participants are reached. No interim hypothesis testing will determine stopping.

## 8. Other

Anything else you would like to preregister?

This study extends prior work on abstract affect representations, planar robot
swarm behavior, and single-dot motion kinematics by testing affective
motion-mapping in immersive 3D particle environments.

The intended manipulation is particle motion alone. Coherence is mapped to
valence; energy/noise is mapped to arousal. Other particle/environmental
parameters should be held constant where possible across VR conditions and APK
variants.

The neutral hand-movement audio is a standardized engagement/control task, not
the manipulated emotional content. Audio variant is randomized across blocks
and not participant-facing.

If both APK variants are completed by each participant, APK run order must be
locked before data collection. If APK run order is fixed, APK-variant effects
will be interpreted in relation to that fixed order. If APK run order is
counterbalanced, this preregistration should be updated before submission.

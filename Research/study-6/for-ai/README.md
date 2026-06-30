# Study 6 AI Handoff

Canonical folder: `Research/study-6/`

Canonical public page: `/Research/study-6/`

All Study 6 research assets belong in this folder. Do not recreate or continue
Study 6 work under the removed root-level `projects/` or `research-projects/`
folders.

## Current Project Map

- `AGENT_SUMMARY.md`: compact agent summary of what Study 6 is, what its
  objectives are, and what this repository folder currently does.
- `neutral-hand-audio/`: participant-facing neutral hand-task audio package,
  protocol notes, exact wording library, cached prompt audio, validation
  reports, and rebuild scripts. It contains four instruction variants per
  language; runtime should randomly assign the four variants across the four
  blocks.
- `questionnaire-assets/`: shared questionnaire and study assets, including
  SAM pictographs, participation-confirmation files, and future German/English
  questionnaire labels or tools.
- `questionnaire-ui-preview/`: browser-facing representation of the VR
  questionnaire used to develop and inspect layout, flow, fixture state, and
  formatting. It references shared assets rather than owning them.

## Current Study Framing

Study 6 tests whether affective qualities can be conveyed through the motion of
immersive 3D particle environments. Prior work has examined abstract
representations of affect, swarm behaviors in planar tabletop robots, and
single-dot motion kinematics in emotion perception. This study extends that
logic to immersive 3D particle fields by manipulating particle motion alone,
with all other particle/environment parameters held constant where possible.

The current preregistration framing treats the Kuramoto particle profiles as a
2 x 2 movement manipulation intended to instantiate four valence-arousal states:

- Coherence: desynchronized versus synchronized movement. Desynchrony is mapped
  to lower valence; synchrony is mapped to higher valence.
- Energy/noise: low versus high movement energy. Low energy is mapped to lower
  arousal; high energy/noise is mapped to higher arousal.

Primary validation question: can these particle-motion parameters be mapped
onto a valence-arousal state space? Subjective valence/arousal are measured with
SAM and valence/arousal sliders. Arousal is additionally measured
physiologically using ECG/HRV. Ekman emotion ratings are used for comparability
with prior work and to cross-validate whether the emotion participants perceive
in the particle motion is consistent with the intended valence-arousal mapping
of those emotions.

The same movement mappings are expected to be tested in two mapping scenarios:

- Ambient mapping: the particle profile is expressed as an ambient feature of
  the surrounding environment.
- Hand-avatar mapping: the particle profile is mapped onto the texture/material
  of a virtual hand avatar.

Current design: 20 participants complete both mapping scenarios. Part 1 uses
the ambient/environmental mapping, where particles are mapped to the background
or surrounding environment. Part 2 uses the hand-avatar mapping, where the same
particle-motion profiles are mapped to the hand avatar. In each scenario,
participants experience all four coherence x energy particle conditions in a
randomized, counterbalanced order.

Embodiment hypothesis: across the two mapping/embodiment conditions, higher
reported valence and arousal are expected to be associated with higher
virtual-hand embodiment scores.

## Operator Rules

- Keep future Study 6 one-off scripts, validation harnesses, prompt runners, and
  rebuild helpers inside the most specific Study 6 project folder.
- Use a project-local `for-ai/` folder for new AI/operator-only helpers unless a
  script is part of a participant-facing reproducible asset package, such as the
  existing neutral-hand-audio rebuild scripts.
- Keep legacy aliases documented in `404.html`, but treat
  `/Research/study-6/...` as canonical.
- Do not put the standalone website print packet stash inside Study 6. It lives
  at `/Academic/print/questionnaire-packets/`.

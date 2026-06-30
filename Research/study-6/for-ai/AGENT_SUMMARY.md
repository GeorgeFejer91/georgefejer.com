# Study 6 Agent Summary

## What This Project Is

Study 6 is a scientific study workspace. The canonical folder is
`Research/study-6/`. It groups the materials needed to design, document, run,
write up, preregister, and publish the study.

The project contains assets for a scientific study: study materials,
publication and paper-writing assets, preregistration support, questionnaire
materials, VR questionnaire-planning scripts and previews, participant-facing
audio, protocol notes, validation artifacts, and AI/operator handoff notes.

The project is not a general portfolio section or a loose collection of demos.
All Study 6 work should stay under `Research/study-6/`, with project-specific
AI/operator material kept in the nearest relevant `for-ai/` folder.

## Core Objectives

- Keep Study 6 assets together in one canonical location.
- Support scientific planning, preregistration, paper writing, and publication
  preparation for the study.
- Maintain study materials that can be used for VR questionnaire planning,
  participant instructions, publication, preregistration, and experiment
  documentation.
- Provide neutral hand-task audio assets that can be integrated into the VR
  questionnaire/workflow as participant-facing audio instructions.
- Support a browser-based preview of the VR questionnaire so questionnaire UI,
  labels, state, and formatting can be developed outside the headset.
- Preserve English and German participant-facing materials, including audio,
  transcripts, questionnaire labels/assets, and participation-confirmation
  files.
- Keep future AI/operator work traceable, with clear handoff notes, validation
  expectations, and legacy URL redirects.

## Working Scientific Framing

Study 6 currently uses a 2 x 2 VR particle-condition structure crossing
movement coherence with movement energy/noise in immersive 3D particle
environments. Operationally, the four VR condition IDs should be neutral and
factor-coded: `LC_LE`, `LC_HE`, `HC_LE`, and `HC_HE`. Valence and arousal are
measured outcomes and preregistered scientific hypotheses, not condition names.

The two movement dimensions should be described succinctly:

- Coherence: desynchronized versus synchronized movement.
- Energy/noise: low versus high movement energy/noise.

Subjective valence/arousal are measured using Self-Assessment Manikin
pictograph rows and valence/arousal sliders. Arousal is additionally measured
with ECG/HRV. Ekman emotion ratings are used for comparability with other
affect-motion studies and possible cross-validation analyses.

This extends prior lines of work on abstract affect representations, swarm
behavior in planar tabletop robots, and single-dot motion kinematics for emotion
perception into immersive 3D particle environments.

The same motion mappings are expected to be studied in two matched Quest APK
variants. The APKs should be identical in questionnaire flow, audio behavior,
counterbalancing, data-writing contract, and VR particle-condition logic. The
only intended implementation difference is the particle mapping target:
`BG_ENV` maps particles to the background/surrounding environment; `HAND_AV`
maps the same particles onto the virtual hand avatar texture/material. Across
these APK mapping variants, higher reported valence and arousal are
hypothesized to be associated with higher virtual-hand embodiment scores.

Current design target: 20 participants complete both APK variants if the final
protocol keeps both variants within participant. Within each APK run,
participants experience all four coherence x energy/noise conditions in
randomized, counterbalanced order, giving eight condition exposures per
participant if both APK variants are completed.

## What It Is Doing

The folder currently contains three main Study 6 components:

- `STUDY_RUNBOOK.md`: the root-level end-to-end operator runbook for how Study
  6 should be run. It describes preparation, participant/session flow,
  counterbalancing, audio assignment, private data write points, repeated
  assessment pages, block metadata, QC/exclusion logging, and the intended
  block-level analysis export.
- `for-ai/QUESTIONNAIRE_BACKEND_OPERATIONS.md`: the backend companion to the
  questionnaire HTML preview. It specifies what the native Quest app,
  study-runner, or caller-owned backend must own: participant/session IDs,
  persisted counterbalance assignment, audio randomization, result URI writing,
  private storage, physiology synchronization, validation, atomic writes, QC
  flags, and analysis export constraints.
- `for-ai/study6_apk_permutation_lookup.json`: central lookup template for the
  two matched APKs. It contains the 24 VR-condition permutations, 24 matched
  audio permutations, questionnaire item IDs, APK data folder names, and 100
  participant allocation rows.
- `for-ai/generate_study6_apk_permutation_lookup.js`: reproducible generator
  for the lookup JSON.
- `neutral-hand-audio/`: final English and German guided hand-task MP3s for
  integration as audio instructions inside the questionnaire/workflow. There
  are four variants of essentially the same instruction in different movement
  orders, in English and German. Participants hear these during the experiment;
  the four variants should be randomly assigned across the four blocks for a
  participant/session. The exact randomization method is not critical as long as
  the block assignments are random. This folder also contains timed transcripts,
  exact wording libraries, protocol notes, cached ElevenLabs prompt audio,
  validation reports, and rebuild scripts.
- `questionnaire-assets/`: shared questionnaire materials and source assets,
  including Self-Assessment Manikin pictographs, participation-confirmation files, and the future
  home for questionnaire labels/tools in English and German.
- `questionnaire-ui-preview/`: the browser-facing representation of what the VR
  questionnaire should look and feel like. This is a development surface for
  layout, state, flow, fixtures, and formatting; it references the shared
  questionnaire assets and neutral-hand audio rather than owning those assets.

The site also keeps old public URLs working through `404.html`, but new links and
new work should use `/Research/study-6/...` as the canonical path.

Standalone print packets kept on the website for later printing are unrelated
to Study 6 and live at `/Academic/print/questionnaire-packets/`.

## Agent Notes

When continuing this project, first check `Research/study-6/README.md` and this
summary. Then open the `for-ai/README.md` inside the specific subproject you are
editing. Do not recreate removed root folders such as `projects/` or
`research-projects/` for Study 6 material.

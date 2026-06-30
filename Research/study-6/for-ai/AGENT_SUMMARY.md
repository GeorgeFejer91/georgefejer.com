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

Study 6 currently frames affective particle motion as a 2 x 2 manipulation of
movement coherence and movement energy/noise in immersive 3D particle
environments. These four conditions correspond to four intended
valence-arousal states. The goal is to test whether emotion-relevant motion
features can be mapped into a valence-arousal state space in VR particle fields
while manipulating particle motion alone and holding other visual/environmental
parameters constant where possible.

The two movement dimensions should be described succinctly:

- Coherence maps desynchronized versus synchronized movement onto valence:
  desynchrony is expected to feel lower in valence, synchrony higher in valence.
- Energy/noise maps low versus high movement energy onto arousal: low energy is
  expected to feel lower in arousal, high energy/noise higher in arousal.

Subjective valence/arousal are measured using SAM and valence/arousal sliders.
Arousal is additionally measured with ECG/HRV. Ekman emotion ratings are used
for comparability with other affect-motion studies and to cross-validate whether
the perceived emotion represented by particle motion matches the intended
valence-arousal mapping of Ekman emotions.

This extends prior lines of work on abstract affect representations, swarm
behavior in planar tabletop robots, and single-dot motion kinematics for emotion
perception into immersive 3D particle environments.

The same motion mappings are expected to be studied in two mapping/embodiment
conditions: ambient environmental mapping and hand-avatar texture/material
mapping. Across these two conditions, higher reported valence and arousal are
hypothesized to be associated with higher virtual-hand embodiment scores.

Current design target: 20 participants complete both scenarios. Part 1 is the
environmental/background particle mapping. Part 2 maps the same particle-motion
profiles to the hand avatar. Within each scenario, participants experience all
four coherence x energy conditions in randomized, counterbalanced order, giving
eight condition exposures per participant if both scenario parts are completed.

## What It Is Doing

The folder currently contains three main Study 6 components:

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
  including SAM pictographs, participation-confirmation files, and the future
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

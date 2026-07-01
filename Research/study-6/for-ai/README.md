# Study 6 AI Handoff

Canonical folder: `Research/study-6/`

Canonical public page: `/Research/study-6/`

All Study 6 research assets belong in this folder. Do not recreate or continue
Study 6 work under the removed root-level `projects/` or `research-projects/`
folders.

## Current Project Map

- `AGENT_SUMMARY.md`: compact agent summary of what Study 6 is, what its
  objectives are, and what this repository folder currently does.
- `../STUDY_RUNBOOK.md`: operator-facing end-to-end study runbook. It describes
  the full session procedure, data write timeline, private data layout,
  block-level metadata contract, repeated questionnaire assessments, QC rules,
  and analysis export shape. Treat it as the main study-running manual.
- `QUESTIONNAIRE_BACKEND_OPERATIONS.md`: backend/operator companion to the
  questionnaire HTML preview. It specifies native/caller responsibilities,
  counterbalancing, audio assignment, result URI writing, private storage,
  validation, physiology synchronization, atomic-write behavior, QC flags, and
  analysis export constraints.
- `study6_apk_permutation_lookup.json`: central JSON lookup template for the
  two matched APKs. It contains the 24 VR-condition permutations, 24 matched
  audio permutations, questionnaire item IDs, APK data folder names, and 100
  participant allocation rows. Treat this JSON as the backend/runtime source of
  truth.
- `study6_apk_variant_catalog.csv`: generated human-readable catalog of APK
  variant IDs, filename codes, private data folders, and mapping targets.
- `study6_condition_catalog.csv`: generated human-readable catalog of the four
  VR condition IDs and their coherence/energy factor codes.
- `study6_audio_variant_catalog.csv`: generated human-readable catalog of the
  four audio variants, instruction IDs, filenames, and hosted MP3 URLs.
- `study6_condition_permutation_table.csv`: generated human-readable table of
  the 24 possible VR-condition block orders.
- `study6_audio_permutation_table.csv`: generated human-readable table of the
  24 possible audio-variant block orders.
- `study6_participant_lookup_table.csv`: generated human-readable 100-row
  allocation table. It is intentionally minimal: each row maps a participant ID
  to one permutation ID. Join that ID to the condition/audio permutation tables
  and catalogs to derive block IDs, condition IDs, audio assignments, and flat
  filenames.
- `generate_study6_apk_permutation_lookup.js`: reproducible generator for the
  lookup JSON and CSV companion tables. Use it when condition IDs, audio
  variants, questionnaire item IDs, or allocation length intentionally change.
- `neutral-hand-audio/`: participant-facing neutral hand-task audio package,
  protocol notes, exact wording library, cached prompt audio, validation
  reports, and rebuild scripts. It contains four instruction variants per
  language; the lookup assigns one language-matched variant to each block.
  Main audio asset page:
  `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`. Direct
  MP3 base path:
  `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/`.
- `questionnaire-assets/`: shared questionnaire and study assets, including
  Self-Assessment Manikin pictographs, participation-confirmation files, and future German/English
  questionnaire labels or tools.
- `questionnaire-ui-preview/`: browser-facing representation of the VR
  questionnaire used to develop and inspect layout, flow, fixture state, and
  formatting. It references shared assets rather than owning them. The browser
  preview is not the runtime authority; backend/native constraints are kept in
  `QUESTIONNAIRE_BACKEND_OPERATIONS.md`.

## Current Study Framing

Study 6 tests whether affective qualities can be conveyed through the motion of
immersive 3D particle environments. Prior work has examined abstract
representations of affect, swarm behaviors in planar tabletop robots, and
single-dot motion kinematics in emotion perception. This study extends that
logic to immersive 3D particle fields by manipulating particle motion alone,
with all other particle/environment parameters held constant where possible.

Operationally, the Kuramoto particle conditions should be treated as a neutral
2 x 2 VR condition structure with factor-coded IDs: `LC_LE`, `LC_HE`, `HC_LE`,
and `HC_HE`. Valence and arousal are measured outcomes and preregistered
scientific hypotheses, not condition labels.

- Coherence: desynchronized versus synchronized movement.
- Energy/noise: low versus high movement energy/noise.

Subjective valence/arousal are measured with Self-Assessment Manikin
pictograph rows and valence/arousal sliders after each VR condition block.
Arousal is additionally measured
physiologically using ECG/HRV. Ekman emotion ratings are used for comparability
with prior work and possible cross-validation analyses.

The same movement mappings are expected to be tested in two matched Quest APK
variants. The APKs should be identical in questionnaire flow, audio behavior,
counterbalancing, data-writing contract, and VR particle-condition logic. The
only intended implementation difference is the particle mapping target:

- `BG_ENV`: particles are expressed as an ambient/background environment
  feature.
- `HAND_AV`: the same particles are mapped onto the virtual hand avatar
  texture/material.

Current design target: 20 participants complete both APK variants if the final
protocol keeps both variants within participant. Within each APK run,
participants experience all four coherence x energy/noise VR particle
conditions in randomized, counterbalanced order.

Embodiment hypothesis: across the two APK mapping variants, higher
reported valence and arousal are expected to be associated with higher
virtual-hand embodiment scores.

## Operator Rules

- Start backend or runtime work by reading `../STUDY_RUNBOOK.md`,
  `QUESTIONNAIRE_BACKEND_OPERATIONS.md`, and
  `study6_apk_permutation_lookup.json`, and
  `../questionnaire-ui-preview/README.md` together. The runbook says how the
  APK writes data, the backend companion says what the native/caller layer must
  enforce, the lookup tells the APK which block/audio order to use, and the
  questionnaire preview says what the participant-facing panel shows and
  exports.
- Keep future Study 6 one-off scripts, validation harnesses, prompt runners, and
  rebuild helpers inside the most specific Study 6 project folder.
- Use a project-local `for-ai/` folder for new AI/operator-only helpers unless a
  script is part of a participant-facing reproducible asset package, such as the
  existing neutral-hand-audio rebuild scripts.
- Do not store raw participant responses, names, ECG/RR recordings,
  private session logs, or identifying analysis exports in this public
  repository. Use the private study data root described in
  `../STUDY_RUNBOOK.md`.
- Do not put allocation, audio randomization, private result writing,
  physiology capture, or QC/exclusion logic into the browser preview. Those are
  native/caller-owned operations documented in
  `QUESTIONNAIRE_BACKEND_OPERATIONS.md`.
- Keep legacy aliases documented in `404.html`, but treat
  `/Research/study-6/...` as canonical.
- Do not put the standalone website print packet stash inside Study 6. It lives
  at `/Academic/print/questionnaire-packets/`.

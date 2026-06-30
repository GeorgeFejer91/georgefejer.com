# Study 6 Questionnaire Assets

This folder contains reusable questionnaire and study materials for Study 6.
It is the canonical place for participant-facing questionnaire assets, labels,
SAM pictographs, and participation-confirmation files.

- `asset-catalog.json`: module-level catalog for questionnaire assets.
- `sam/`: SAM pictographic SVG assets used by the questionnaire preview and
  future VR questionnaire integrations. Canonical ordered SVG names use the
  live zero-padded snake_case paths, e.g. `valence_01.svg` through
  `valence_09.svg`.
- `participation-confirmation/`: VR Atemexperiment participation-confirmation
  PDF and preview images.
- `for-ai/`: AI/operator notes for this shared asset module.

Keep browser preview code and layout fixtures in `../questionnaire-ui-preview/`.
Keep neutral hand-task audio assets in `../neutral-hand-audio/`.
Standalone packets kept on the website for later printing live outside Study 6
under `../../../Academic/print/questionnaire-packets/`.

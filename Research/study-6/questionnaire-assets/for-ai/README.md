# Questionnaire Assets AI Notes

Canonical page: `/Research/study-6/questionnaire-assets/`

This folder is the shared asset module for the Study 6 questionnaire side. It
stores actual reusable study materials rather than the browser preview code:
SAM pictographs, participation-confirmation files, labels, and future
English/German questionnaire assets or tools.

## Structure

- `sam/`: shared SAM pictographic assets. The browser preview references these
  from `../questionnaire-ui-preview/` instead of keeping private copies.
- `participation-confirmation/`: VR Atemexperiment participation confirmation
  PDF and preview images.

## Operator Rules

- Put participant-facing or study-source questionnaire assets here.
- Put browser layout, CSS, fixture state, and UI preview code in
  `../questionnaire-ui-preview/`.
- Keep AI/operator-only helpers in the nearest `for-ai/` folder.
- Preserve legacy aliases through `404.html`, but treat
  `/Research/study-6/questionnaire-assets/...` as canonical for shared assets.
- Do not put the standalone website print stash here. Those packets live at
  `/Academic/print/questionnaire-packets/` and are unrelated to Study 6.

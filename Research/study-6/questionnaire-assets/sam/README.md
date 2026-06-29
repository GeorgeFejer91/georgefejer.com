# SAM Pictographic Assets

Shared SAM SVG assets for the Study 6 questionnaire materials.

- `asset-catalog.json`: machine-readable catalog for all SAM scale SVGs and
  their questionnaire variable names.
- `valence/`: 1-9 SAM valence SVG sequence, canonically named
  `valence_01.svg` through `valence_09.svg`.
- `arousal/`: 1-9 SAM arousal SVG sequence, canonically named
  `arousal_01.svg` through `arousal_09.svg`.
- `dominance/`: 1-9 dominance/control SVG sequence, canonically named
  `dominance_01.svg` through `dominance_09.svg`.
- `LICENSE-BSD-2-Clause.txt`: source license for the copied SAM assets.

Only the live zero-padded snake_case files are retained to avoid duplicate assets. New
questionnaire preview code and new integrations should use the paths listed in
`asset-catalog.json`.

The browser questionnaire preview loads these assets from
`../questionnaire-assets/sam/` relative to `questionnaire-ui-preview/`.

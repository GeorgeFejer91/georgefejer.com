# georgefejer.com

Personal website for `www.georgefejer.com`.

## Canonical Layout

The repository keeps the public homepage as a single root `index.html`.
Canonical assets and subprojects live under three top-level folders:

- `Academic/` for public homepage assets such as images and SVGs.
- `Hobby/` for miscellaneous fun projects such as `einhorn-sammler`.
- `Research/` for research prototypes, study assets, and experiment previews.

The Study 6 research project is grouped under `Research/study-6/`, including
the Kuramoto mesh lab, audio assets, Quest/SAM questionnaire preview,
questionnaire packets, and VR Atemexperiment print files.

The repository root is intentionally kept small for GitHub Pages:

- `index.html` is the one-page homepage.
- `404.html` redirects legacy browser URLs to the new canonical paths.
- `.nojekyll`, `CNAME`, `.editorconfig`, and `.gitattributes` keep deployment
  and repository behavior stable.

Do not recreate old root content folders such as `assets/`, `einhorn-sammler/`,
`kuramoto-mesh-lab/`, `quest-sam-questionnaire-preview/`, `audio-assets/`,
`print/`, `print2/`, or `projects/`. New work should target the canonical
`Academic/`, `Hobby/`, and `Research/` paths.

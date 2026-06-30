# Study 6 Neutral Hand Audio Research Protocol Package

This folder keeps the research-facing protocol context for the Study 6 neutral hand-task audio work inside the unified `Research/study-6/neutral-hand-audio/` package.

Canonical URL:

`https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`

Compatibility URLs:

- `https://www.georgefejer.com/research-projects/study6-neutral-hand-audio/`
- `https://www.georgefejer.com/projects/study6-neutral-hand-audio/`
- `https://www.georgefejer.com/audio-assets/`

## Folder Map

- `protocol/`: research goals, protocol context, design rationale, implementation notes, and validation checklist.
- `wordings/`: consolidated exact wording library generated from the final timing schedule.
- `../`: self-contained public Study 6 audio package, including final MP3s, transcripts, source scripts, cached prompt audio, validation reports, manifests, and rebuild scripts.
- `../RESEARCH_PROJECT_MANIFEST.csv`: complete inventory of this unified package with file sizes and SHA-256 hashes.

Start with `ASSET_AND_WORDING_MAP.md` when continuing this project from another repository or another AI session.

## Research Purpose

Study 6 needs a neutral ambient hand task that keeps participants engaged in a standardized, hand-based interaction while particle/environment or hand-mapping manipulations vary independently. The task is designed to avoid emotional behaviors, symbolic gestures, social touch, and demanding performance goals.

The resulting audio set gives each participant a five-minute guided sequence in English or German. Four versions use the same action set and timing but vary the order of the four core movement clusters. In the experiment, randomly assign the four variants across the four blocks for each participant/session so the repeated task feels less repetitive.

## Asset Integrity

The bundled final MP3s are the same files as the canonical asset package:

- 8 final MP3 files.
- 4 English versions and 4 German versions.
- `300.000000` seconds per final file.
- `4801140` bytes per final MP3.
- 118 cached ElevenLabs prompt MP3s for reproducible rebuilds without new text-to-speech calls.

Do not commit API keys. See `../API_KEY_SETUP.md`.

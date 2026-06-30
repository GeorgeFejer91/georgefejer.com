# Validation Checklist

## Local Package Checks

- `audio/` contains 8 final MP3 files.
- `prompt_audio_raw/` contains 118 cached prompt MP3 files.
- `transcripts/` contains 8 timed transcript files.
- `source_transcripts_from_zip/` contains 8 source text files.
- `validation_reports/` contains:
  - `final_audio_duration_validation.csv`
  - `cluster_duration_validation.csv`
  - `prompt_timing_validation.csv`

## Duration Checks

Required values in `validation_reports/final_audio_duration_validation.csv`:

- `duration_s`: `300.000000` for every final MP3.
- `difference_from_300_ms`: `0.000` for every final MP3.
- `size_bytes`: `4801140` for every final MP3.

Required cluster durations:

- `SETUP`: 20 seconds.
- `A`, `B`, `C`, `D`: 60 seconds each.
- `CIRCLE`: 40 seconds.

## Website Checks

The following URLs should return HTTP 200:

- `https://www.georgefejer.com/Research/study-6/`
- `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`
- `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/wordings/EXACT_WORDING_LIBRARY.md`
- `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V01_EN.mp3`
- `https://www.georgefejer.com/audio-assets/`
- `https://www.georgefejer.com/projects/study6-neutral-hand-audio/`
- `https://www.georgefejer.com/research-projects/study6-neutral-hand-audio/`

Each bundled final MP3 URL should return `Content-Length: 4801140`.

## Secret Checks

Before committing or pushing, scan for real ElevenLabs keys. There should be zero matches for key-shaped strings such as `sk_...`.

# AI Handoff: Study 6 Neutral Hand Audio

## Objective

Maintain and continue the Study 6 neutral ambient hand-task audio package. The package provides 4 English and 4 German guided audio files, each exactly 5 minutes long, with standardized timing and different action-cluster orders.

Canonical public page:

`https://www.georgefejer.com/projects/study6-neutral-hand-audio/`

Compatibility page:

`https://www.georgefejer.com/audio-assets/`

## Current State

- Final files: 8 MP3s in `audio/`.
- Final duration: every file is `300.000000` seconds.
- Final MP3 size: each file is `4801140` bytes.
- Choreography version: `v2_protected_action_windows_from_cached_elevenlabs_audio`.
- Voice: ElevenLabs voice ID `IVxgxz5EgbHtWNcgBjOV`.
- Model: `eleven_v3`.
- Output format: `mp3_44100_128`.
- Languages: `en` and `de`.

No real API key is stored in this package.

## Choreography Timing

- `00:00-00:20`: setup, 20 seconds.
- `00:20-04:20`: four core movement clusters, 60 seconds each.
- `04:20-05:00`: closing circle, 40 seconds.
- Core clusters use start, repeat or switch, and stop cues.
- Cue timing protects action windows so a participant is not immediately interrupted after a timed movement instruction.

Cluster IDs:

- `A`: apart and together.
- `B`: palms up and down.
- `C`: single-hand reaches.
- `D`: open and close.
- `CIRCLE`: closing circle.

Version orders:

- `V01`: A, B, D, C.
- `V02`: B, C, A, D.
- `V03`: D, A, C, B.
- `V04`: C, D, B, A.

## File Map

- `audio/`: final participant-facing MP3 files.
- `transcripts/`: exact timed transcripts for the final files.
- `source_transcripts_from_zip/`: English and German source text files from `hand_audio.zip`.
- `prompt_audio_raw/`: cached ElevenLabs prompt MP3s. Keep these if exact voice continuity matters.
- `validation_reports/final_audio_duration_validation.csv`: validates 300-second final duration.
- `validation_reports/cluster_duration_validation.csv`: validates setup, cluster, and close durations.
- `validation_reports/prompt_timing_validation.csv`: validates cue durations and protected action windows.
- `timing_library.csv`: cue-level schedule and spoken text.
- `action_blocks.csv`: cluster-level timing library.
- `elevenlabs_render_manifest.json`: file hashes, sizes, durations, cue text, and render metadata.
- `ASSET_MANIFEST.csv`: package-level file inventory with byte sizes and SHA-256 hashes.
- `scripts/build_hand_audio_choreo_v2_from_cache.py`: rebuilds final audio from cached prompt clips.
- `scripts/build_hand_audio_from_zip.py`: re-renders prompt clips with ElevenLabs, then assembles final audio.
- `API_KEY_SETUP.md`: secret setup. Do not store real keys in Git.
- `.gitignore`: protects local secrets, generated WAV caches, and Python bytecode from future commits.

## Preferred Rebuild Procedure

Use the cached rebuild path unless there is a deliberate reason to regenerate prompt speech.

From this project folder:

```powershell
python scripts/build_hand_audio_choreo_v2_from_cache.py
```

Expected result:

- 8 final MP3s in `audio/`.
- 8 timed transcript files in `transcripts/`.
- Updated `timing_library.csv`.
- Updated `validation_reports/`.
- Updated `elevenlabs_render_manifest.json`.
- Every final MP3 remains exactly 300 seconds.

This path requires:

- Python 3.
- `ffmpeg` and `ffprobe` on `PATH`.
- Existing `prompt_audio_raw/` cache.
- Existing `source_transcripts_from_zip/` text files, or `hand_audio.zip` in `~/Downloads/`.

## ElevenLabs Re-render Procedure

Use this only if changing wording, voice settings, model, or language rendering.

From this project folder:

```powershell
python scripts/build_hand_audio_from_zip.py --zip "$HOME\Downloads\hand_audio.zip"
python scripts/build_hand_audio_choreo_v2_from_cache.py
```

The first command generates or updates prompt audio. The second command creates the protected-action-window final choreography from those cached prompts.

Secret rules:

- Prefer `ELEVENLABS_API_KEY` as an environment variable.
- The fallback temporary file is `$HOME\Downloads\elevenlabs_access_codex.txt`.
- Delete the temporary file after rendering.
- Never commit, publish, echo, or log the real API key.

## Validation Checklist

Before publishing a modified package:

```powershell
Get-Content validation_reports/final_audio_duration_validation.csv
Get-Content validation_reports/cluster_duration_validation.csv
Get-Content validation_reports/prompt_timing_validation.csv | Select-Object -First 20
```

Required checks:

- All final audio rows report `duration_s` as `300.000000`.
- All final audio rows report `difference_from_300_ms` as `0.000`.
- Setup rows are 20 seconds.
- Core clusters A, B, C, and D are 60 seconds each.
- `CIRCLE` is 40 seconds.
- No real ElevenLabs API key appears in committed files.

## Continuation Notes For Another GitHub Project

Copy this entire folder into the other project when continuing the work. Keep the relative structure intact.

Minimum files needed for exact cached rebuild:

- `scripts/build_hand_audio_choreo_v2_from_cache.py`.
- `scripts/build_hand_audio_from_zip.py`.
- `source_transcripts_from_zip/`.
- `prompt_audio_raw/`.
- `audio/`.
- `validation_reports/`.
- `timing_library.csv`.
- `action_blocks.csv`.
- `elevenlabs_render_manifest.json`.

If a new project has a different folder layout, keep the scripts inside a `scripts/` folder directly below this project root. The copied scripts have been adapted to use the project folder itself as the library root.

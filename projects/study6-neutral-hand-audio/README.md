# Study 6 Neutral Hand Audio

This project folder contains the complete public handoff package for the Study 6 neutral ambient hand task.

Canonical URL:

`https://www.georgefejer.com/projects/study6-neutral-hand-audio/`

Compatibility URL:

`https://www.georgefejer.com/audio-assets/`

## Contents

- `audio/`: 8 final participant-facing MP3 files.
- `transcripts/`: exact timed transcripts for each final MP3.
- `source_transcripts_from_zip/`: original English and German source scripts from `hand_audio.zip`.
- `prompt_audio_raw/`: cached intermediate ElevenLabs prompt MP3s used for reproducible local rebuilds.
- `validation_reports/`: CSV reports for final duration, cluster duration, and prompt timing.
- `timing_library.csv`: cue-level schedule with start/end times and protected action windows.
- `action_blocks.csv`: standardized cluster timing blocks.
- `elevenlabs_render_manifest.json`: render metadata, file sizes, SHA-256 hashes, cue text, and durations.
- `ASSET_MANIFEST.csv`: complete file inventory for this public project package.
- `scripts/`: rebuild scripts adapted to this self-contained project folder.
- `AI_HANDOFF.md`: continuation instructions for AI agents or another GitHub project.
- `API_KEY_SETUP.md`: safe ElevenLabs secret setup.
- `.gitignore`: project-local ignore rules for local secrets and regenerable audio caches.

## Timing Standard

All final MP3 files are exactly `300.000000` seconds.

- Setup: `00:00-00:20`, 20 seconds.
- Core movement clusters: `00:20-04:20`, four 60-second clusters.
- Circle close: `04:20-05:00`, 40 seconds.

Version orders:

- `V01`: A, B, D, C.
- `V02`: B, C, A, D.
- `V03`: D, A, C, B.
- `V04`: C, D, B, A.

Languages:

- `EN`: English.
- `DE`: German.

## Rebuild From Cached Prompt Audio

This is the preferred reproducible path because it uses the cached ElevenLabs prompt clips already included in this package and does not require a new API call.

Run from this project folder:

```powershell
python scripts/build_hand_audio_choreo_v2_from_cache.py
```

Requirements:

- Python 3.
- `ffmpeg` and `ffprobe` on `PATH`.

The script rebuilds `audio/`, `transcripts/`, `timing_library.csv`, `validation_reports/`, and `elevenlabs_render_manifest.json`. It may create `choreo_v2_prompt_wav/`; that folder is a regenerable local cache and is intentionally not part of the public handoff.

## Re-render With ElevenLabs

Use this only when you intentionally want to regenerate the prompt clips from text with ElevenLabs.

```powershell
python scripts/build_hand_audio_from_zip.py --zip "$HOME\Downloads\hand_audio.zip"
```

The script reads the API key from `ELEVENLABS_API_KEY` or from the temporary file:

`$HOME\Downloads\elevenlabs_access_codex.txt`

Do not commit API keys. See `API_KEY_SETUP.md`.

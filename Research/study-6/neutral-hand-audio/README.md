# Study 6 Neutral Hand Audio

This Study 6 folder contains the complete public handoff package for the neutral ambient hand task, including final participant-heard audio scripts, exact wordings, protocol context, cached prompt audio, validation reports, and rebuild scripts.

The active `audio/` and `transcripts/` folders contain the XTTS-v2 conversational rewrite generated on 2026-07-01 from the updated participant instructions. The previous ElevenLabs render is archived under `archive/2026-06-30-elevenlabs-legacy/`.

Canonical URL:

`https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`

Compatibility URLs:

- `https://www.georgefejer.com/audio-assets/`
- `https://www.georgefejer.com/projects/study6-neutral-hand-audio/`
- `https://www.georgefejer.com/research-projects/study6-neutral-hand-audio/`

## Contents

- `audio/`: 8 final participant-facing MP3 files.
- `transcripts/`: exact timed transcripts for each final MP3.
- `archive/2026-06-30-elevenlabs-legacy/`: previous ElevenLabs MP3s, transcripts, validation reports, and manifests.
- `source_transcripts_from_zip/`: original English and German source scripts from `hand_audio.zip`.
- `prompt_audio_raw/`: cached intermediate ElevenLabs prompt MP3s used for reproducible local rebuilds.
- `validation_reports/`: CSV reports for final duration, cluster duration, and prompt timing.
- `protocol/`: research goals, protocol context, design rationale, implementation notes, and validation checklist.
- `wordings/`: consolidated exact wording library generated from the final timing schedule.
- `timing_library.csv`: cue-level schedule with start/end times and protected action windows.
- `action_blocks.csv`: standardized cluster timing blocks.
- `tts_render_manifest.json`: XTTS-v2 render metadata, file sizes, SHA-256 hashes, cue text, and durations.
- `elevenlabs_render_manifest.json`: compatibility copy of the current render metadata for older tooling.
- `ASSET_MANIFEST.csv`: file inventory for the public audio and rebuild package.
- `RESEARCH_PROJECT_MANIFEST.csv`: complete file inventory for the unified research package.
- `scripts/`: rebuild scripts adapted to this self-contained project folder.
- `AI_HANDOFF.md`: continuation instructions for AI agents or another GitHub project.
- `for-ai/`: project-local notes for future AI/operator sessions.
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

The four versions are essentially the same participant instruction, with the
movement clusters in different orders to reduce the repetitive feel of the
task. In the experiment, randomly assign the four variants across the four
blocks for each participant/session. The exact randomization method is not
critical as long as block-level assignment is random.

Languages:

- `EN`: English.
- `DE`: German.

## Rebuild Current XTTS Conversational Audio

Use this path to reproduce the active 2026-07-01 participant-facing files.

```powershell
python scripts/build_hand_audio_conversational.py --backend xtts
```

The script uses the configured XTTS-v2 speaker reference listed in `voice_reference_assets.csv`. It writes `audio/`, `transcripts/`, `timing_library.csv`, `validation_reports/`, and `tts_render_manifest.json`.

## Rebuild From Cached Prompt Audio

This is the preferred reproducible path because it uses the cached ElevenLabs prompt clips already included in this package and does not require a new API call.

Run from this folder:

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

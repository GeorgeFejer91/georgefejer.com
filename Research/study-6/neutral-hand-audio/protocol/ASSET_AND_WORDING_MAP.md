# Asset And Wording Map

## Public Entry Points

- Canonical package: `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`
- Study 6 index: `https://www.georgefejer.com/Research/study-6/`
- Legacy aliases: `https://www.georgefejer.com/audio-assets/`, `https://www.georgefejer.com/projects/study6-neutral-hand-audio/`, `https://www.georgefejer.com/research-projects/study6-neutral-hand-audio/`

## Research Protocol Files

- `protocol/PROJECT_GOALS.md`: goals, constraints, and deliverables.
- `protocol/RESEARCH_PROTOCOL.md`: participant task concept, movement clusters, timing, and neutrality constraints.
- `protocol/FULL_CONTEXT.md`: development history, wording decisions, transcription/audio-generation context, and rebuild paths.
- `protocol/VALIDATION_CHECKLIST.md`: local and website validation checks.

## Exact Wording Files

- `wordings/EXACT_WORDING_LIBRARY.md`: consolidated cue-level wording and timing table generated from the final timing library.
- `wordings/transcripts/`: final timed transcripts for all 8 audio files.
- `wordings/source_transcripts_from_zip/`: source wording files extracted from the original `hand_audio.zip`.
- `timing_library.csv`: machine-readable cue-level wording and timing.
- `action_blocks.csv`: machine-readable cluster-level timing.

## Final Audio Assets

Bundled final MP3s:

- `audio/study6_neutral_hand_audio_V01_EN.mp3`
- `audio/study6_neutral_hand_audio_V01_DE.mp3`
- `audio/study6_neutral_hand_audio_V02_EN.mp3`
- `audio/study6_neutral_hand_audio_V02_DE.mp3`
- `audio/study6_neutral_hand_audio_V03_EN.mp3`
- `audio/study6_neutral_hand_audio_V03_DE.mp3`
- `audio/study6_neutral_hand_audio_V04_EN.mp3`
- `audio/study6_neutral_hand_audio_V04_DE.mp3`

Each final MP3 is validated at `300.000000` seconds and `4801140` bytes.

Runtime integration note: these are participant-heard scripts. Use the four
versions as randomly assigned block-level variants within the questionnaire or
experiment workflow.

## Rebuild And Reproducibility Assets

- `prompt_audio_raw/`: 118 cached ElevenLabs prompt MP3s.
- `scripts/build_hand_audio_choreo_v2_from_cache.py`: rebuilds final audio from cached prompt clips.
- `scripts/build_hand_audio_from_zip.py`: re-renders prompt clips with ElevenLabs when a local API key is provided.
- `API_KEY_SETUP.md`: secret handling instructions.
- `AI_HANDOFF.md`: implementation-level continuation notes for another AI agent or GitHub project.

## Validation Assets

- `validation_reports/final_audio_duration_validation.csv`
- `validation_reports/cluster_duration_validation.csv`
- `validation_reports/prompt_timing_validation.csv`
- `elevenlabs_render_manifest.json`
- `ASSET_MANIFEST.csv`

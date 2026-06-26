# Full Project Context

## Background

Study 6 needed a neutral ambient task that participants could perform with their hands for five minutes. The task had to keep the hands active while avoiding emotional behaviors, expressive gestures, symbolic communication, self-touch, or social touch.

The working design selected slow, repetitive, standardized hand movement. This fits the practical constraint that participants can remain engaged while particle behavior, environmental manipulations, or hand-mapping manipulations are varied independently.

## Choreography Development

The choreography evolved through several constraints:

- The task needed direct participant-facing wording rather than self-narrating audio.
- Empty pauses were avoided. Where no new instruction is spoken, the participant is told to continue or repeat the current action.
- Cues were added for initiation, continuation, switching, returning to center, and stopping.
- Timed movement instructions were protected by action windows so the next cue does not arrive immediately after an instruction such as "three seconds out, three back."
- Wording was revised to fit a first-person perspective where the participant sees their hands.

## Audio Generation

The final package uses ElevenLabs calm voice output with:

- Voice ID: `IVxgxz5EgbHtWNcgBjOV`.
- Model: `eleven_v3`.
- Output format: `mp3_44100_128`.
- Languages: English and German.

The public package includes cached prompt MP3s in `asset-package/prompt_audio_raw/`. These let future work rebuild the final files without spending additional ElevenLabs quota, as long as the exact prompt wording remains unchanged.

## Transcription And Wording Project

The source scripts were generated as four English and four German versions. They were transcribed, normalized into timed cue rows, assembled into final audio, and validated. The final research package includes:

- Source wording files in `asset-package/source_transcripts_from_zip/`.
- Exact final timed transcripts in `asset-package/transcripts/`.
- Cue-level wording and timing in `asset-package/timing_library.csv`.
- A consolidated generated wording library in `wordings/EXACT_WORDING_LIBRARY.md`.

## Rebuild Pipeline

Preferred rebuild path:

```powershell
cd research-projects/study6-neutral-hand-audio/asset-package
python scripts/build_hand_audio_choreo_v2_from_cache.py
```

Full ElevenLabs re-render path:

```powershell
cd research-projects/study6-neutral-hand-audio/asset-package
python scripts/build_hand_audio_from_zip.py --zip "$HOME\Downloads\hand_audio.zip"
python scripts/build_hand_audio_choreo_v2_from_cache.py
```

Only use the full re-render path if changing wording, voice, model, or language rendering. Do not commit API keys.

## Public URLs

- Research protocol package: `https://www.georgefejer.com/research-projects/study6-neutral-hand-audio/`
- Canonical audio package: `https://www.georgefejer.com/projects/study6-neutral-hand-audio/`
- Legacy audio page: `https://www.georgefejer.com/audio-assets/`

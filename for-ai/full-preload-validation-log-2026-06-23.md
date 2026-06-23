# Full Preload Validation Log - 2026-06-23

Change under test: startup full-preload gate for all gameplay sprites, SFX pools, and music variants before player movement. Sprites load and decode first; audio preload starts only after all sprites are ready so slow smartphone/custom-domain connections do not starve the large transformation sheets.

## Local Smartphone Browser Check

- URL: `http://127.0.0.1:8766/einhorn-sammler/?localpreloadtest=2`
- Viewport override: 393 x 852
- Asset version: `20260623-full-preload-v2`
- `preloadMode`: `full`
- `assetPhase`: `ready`
- `currentSprites`: `ready`
- `allSpritesReady`: `true`
- `assetTotal`: `14`
- `assetRequested`: `14`
- `assetDecoded`: `14`
- `assetWebp`: `14`
- `assetPngFallback`: `0`
- `assetFailed`: `0`
- `sfxReady`: `16 / 16`
- `sfxTimedOut`: `0`
- `musicReady`: `3 / 3`
- `musicTimedOut`: `0`
- `audioReady`: `true`
- `levelIntroVisible`: `true`
- Console errors: none

## Input Smoke Check

- Canvas tap after preload produced `lastInput=pointer:210,430`.
- Tap produced `lastPathLength=9` and `playerPath=8`.
- Music selected an MP3 variant; browser automation reported playback as blocked, which is expected when the browser refuses scripted audio playback.

## Difficulty Smoke Check

URL: `http://127.0.0.1:8766/einhorn-sammler/?aitest=1&runs=1&seconds=100&tick=55&localpreloadtest=3`

| Level | Completed | Success Rate | Verdict | Avg Difficulty | Outcome |
| --- | ---: | ---: | --- | ---: | --- |
| 1 | 1 / 1 | 1.00 | playable | 17.4 | completed |
| 2 | 1 / 1 | 1.00 | playable | 40.9 | completed |
| 3 | 0 / 1 | 0.00 | too-hard | 94.9 | timeout |
| 4 | 1 / 1 | 1.00 | playable | 66.2 | completed |
| 5 | 1 / 1 | 1.00 | playable | 82.6 | completed |

Result: asset preload passed with no moving-tree overlap failures. The level 3 one-run timeout is a gameplay difficulty issue outside this asset-loading change.

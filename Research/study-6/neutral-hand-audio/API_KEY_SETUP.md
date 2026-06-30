# ElevenLabs API Key Setup

Do not commit or publish a real ElevenLabs API key. This project includes only documentation and placeholders for secret handling.

## Preferred Local Setup

Set the key as an environment variable for the current PowerShell session:

```powershell
$env:ELEVENLABS_API_KEY = "<your-elevenlabs-api-key>"
python scripts/build_hand_audio_from_zip.py --zip "$HOME\Downloads\hand_audio.zip"
Remove-Item Env:\ELEVENLABS_API_KEY
```

## Temporary File Fallback

The render script also supports a temporary key file:

```powershell
$keyPath = "$HOME\Downloads\elevenlabs_access_codex.txt"
Set-Content -LiteralPath $keyPath -Value "<your-elevenlabs-api-key>"
python scripts/build_hand_audio_from_zip.py --zip "$HOME\Downloads\hand_audio.zip" --api-key-file $keyPath
Remove-Item -LiteralPath $keyPath
```

The temporary file must be deleted after rendering.

## GitHub Actions Or Another GitHub Project

Use a repository secret named:

`ELEVENLABS_API_KEY`

Then expose it to the job environment only for the render step. Do not print the value in logs.

## Files That Must Stay Secret

Do not commit:

- `.env`.
- `elevenlabs_access_codex.txt`.
- Any file containing the real ElevenLabs key.

The committed `.env.example` file is only a placeholder.

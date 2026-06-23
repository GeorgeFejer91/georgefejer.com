# Browser Safety Validation Log - 2026-06-23

Change under test: reduce browser safety/blocker triggers on GeorgeFejer.com.

## Findings

- DNS for `www.georgefejer.com` points to `georgefejer91.github.io`.
- DNS for `georgefejer.com` points to GitHub Pages apex A records.
- GitHub Pages serves the site when TLS verification is bypassed.
- Normal HTTPS validation currently fails for both `https://www.georgefejer.com/` and `https://georgefejer.com/` with a certificate name/principal error.

## Repo-Side Mitigations

- Homepage profile images now load from same-origin `Images/crop_selfie.png` instead of `raw.githubusercontent.com`.
- Game raw fallback images and audio now request CORS-clean assets.
- Game asset version bumped to `20260623-safety-v5`.
- Referrer policy metadata added to the homepage and game page.

## Remaining Required External Fix

In GitHub repository settings for Pages:

1. Confirm the custom domain is `www.georgefejer.com`.
2. Wait until GitHub reports the DNS check and certificate as valid.
3. Enable `Enforce HTTPS`.
4. Recheck `https://www.georgefejer.com/einhorn-sammler/` without `-k` or certificate bypass.

Until that external Pages/certificate setting is fixed, browsers may still show a safety warning even though the deployed HTML is not malicious.

# Academic website

The root homepage is George Fejer's public academic profile. The site is served as static files through the existing GitHub Pages setup. Keep the homepage, academic assets, and the presentations index within their established paths.

## Current goal

Give the profile a black background and white text, replace duplicate menus with one ordered stretch index, and add a page where future academic presentations can be hosted.

- [x] Replace the homepage navigation with Profile, Research, Presentations, and Contact. Keep existing section IDs and academic content.
- [x] Add the presentation index at `Academic/presentations/` and document how to add a PDF or an HTML deck.
- [x] Pin and use Pretext to measure the four navigation labels. Verify keyboard navigation, text reflow, and the presentation round trip in a rendered browser.

## Verification and handoff

Run `py -3.12 for-ai/check_academic_site.py` with Python Playwright and its Chromium installed. The check starts a local HTTP server for the static site. Pass `--screenshots <directory>` to save previews.

On 2026-11-08, Chromium 148 passed ten viewport pairs from 320 by 568 to 1920 by 1080, including a short landscape viewport and both sides of the stretch breakpoints. The check covered menu spacing and anchors, no internal overflow, the four Pretext measurements, a long label's reflow, 200% text size and custom text spacing, keyboard focus and native fragment links, and the presentation page round trip with and without JavaScript.

The refresh is based on `origin/main` at `2d86262` in the isolated `codex/academic-site-refresh` worktree. The primary checkout has unrelated staged changes. The next content task is to add a presentation using the [repository instructions](../README.md#academic-presentations). Publish only through a separate authorized action.

For UI work, start with [SKILLS.md](SKILLS.md).

## Humboldt presentation handoff

- [x] Prepare and check the archive entry for Altered States of Viscereality.
- [x] Save and verify all 12 transfer files locally. Verified the six GLB headers and the archive integrity of the six PowerPoint files.
- [x] Verify the final PowerPoint package and its embedded media. The 35-slide deck contains 66 embedded media files and has SHA-256 `39e4f7134549f2ee5756e1456f575dc6c08f27cfe31780894bc639c85dda1d4c`.

GitHub verified the uploaded asset against the local SHA-256 and byte count. The archive entry links to the final PowerPoint on the Humboldt release. Keep the original slides and supporting assets with the local transfer.

## Humboldt online presentation

The archive links to `Academic/presentations/humboldt-viscereality/` for browser playback and retains the verified PowerPoint download. Desktop PowerPoint rendered all 35 slides and all 34 original object Morph transitions at their source durations. The export used an unsaved copy. It added playback cues for the videos on slides 19 and 22, which are triggered manually in the original deck.

The 1080p H.264/AAC web file is 80,687,128 bytes and runs 15 minutes 7 seconds. `slides.js` maps the entry, settled frame, and stop for each slide. The cues were aligned with PowerPoint's own slide stills and checked against the rendered motion and all five video segments. The browser plays the rendered animation sequence. Use the PowerPoint download for editable objects and manual animation cues.

The site check covers the archive link, keyboard advance, the automatic stop, slide jumps, reduced motion, and narrow layouts. Its local server supports MP4 byte ranges to exercise the same seek behavior the hosted player needs.

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

## Humboldt interactive website deck

The presentation archive opens `Academic/presentations/humboldt-viscereality/live/` by default. Like Creations of Ra, it renders independent layers in a browser stage and plays each embedded clip in its own video element. The desktop render and original PPTX are still linked. The interactive player fetches the assets and embedded clips for each slide as needed.

Desktop PowerPoint exports the base artwork and transparent object layers from the verified final deck. The manifest records the source slide order, Morph durations and explicitly paired object names. The browser also pairs unambiguous repeated images and text. It moves paired objects with Web Animations and fades other layers. It preserves the 18 click groups and five independent videos. The source video parked off the slide canvas on slide 22 is accessible through a demonstration dialog. The 3D model appears as its PowerPoint preview. The browser recreates the motion with web transforms. The PPTX retains Microsoft's native playback.

On Windows with desktop PowerPoint, pywin32, Pillow, NumPy and FFmpeg, run `py -3.12 for-ai/export_humboldt_live.py SOURCE_PPTX NEW_OUTPUT_DIR` with the current release PowerPoint. The exporter uses PowerPoint to render static art and object layers, and extracts the source media and hyperlinks. Verify the asset inventory and run `py -3.12 for-ai/check_academic_site.py` after replacing the live page's `deck/` files with the completed export.

The current interactive edition has 37 slides. Slide 29 links to BeAnotherLab's Library of Ourselves and slide 37 closes the talk. The November 9 PowerPoint release asset has 154,499,042 bytes and SHA-256 `df9574c1b04eac10a793f193045b85886181069cf8a3e83fea24bdbc0a7da583`. The earlier 35-slide desktop recording remains available as a separate reference.

The browser check covers every adjacent Morph pair in both directions, the named embodiment objects, the speech samples, click-to-play video, the zoom cue, the Library hyperlink, the YouTube embed and fallback link, the breathing loop, full screen, reduced motion and reflow. Animated GLB models are rendered locally with Model Viewer 4.1.0. The static model on slide 24 uses its original PowerPoint render. The PowerPoint keeps native Microsoft Morph and the website animates its exported objects using the Web Animations API.

The remote uses the vendored BRSP/1 core and VDO.Ninja SDK 1.5.5. The discovery room publishes random beacon IDs. A private QR code or copied link carries the session secret, and the private data channel grants only `presentation.navigate`. The presenter applies previous and next commands, then returns the current slide and cue. Both browsers load their own slide and media assets from the site. QR Code Generator 2.0.4 runs locally.

Run `py -3.12 for-ai/check_academic_site.py --remote` to also exercise signaling with two isolated Chromium contexts. The November 9 local run discovered the beacon, paired, applied both commands, mirrored host navigation and disconnected over a direct WebRTC route. The animated model preview confirmed both clockwise stroking clips playing. Physical-phone camera scanning and TURN relay remain unqualified.

GitHub Pages deployed `118d7a26c3f3e1af1eceee5d445bcd453fbcb3f2` from `main`. The live URL passed the same 36 forward and 36 reverse transitions, the two-context direct WebRTC check, and an independent load of the YouTube player. The served HTML, scripts, SDK and deck manifest matched the committed bytes. The public PowerPoint download returned the verified release size. The next optional qualification is a physical-phone scan across two devices.

# Questionnaire Packets AI Notes

Canonical page: `/Academic/print/questionnaire-packets/`

Legacy aliases: `/print2/`, `/projects/print/questionnaire-packets/`, `/Research/study-6/questionnaire-packets/`, `/Research/study-6/questionnaire-assets/print-packets/`

This standalone website print stash contains A4 questionnaire packets and spatial-frame PDF blocks prepared for later printing. It is not part of Study 6. Keep file links relative to this folder.

## Operator Scripts

All print-packet-specific orchestrator/operator scripts, PDF rebuild helpers, validation harnesses, prompt runners, and one-off agent helpers for these packets must live in this `for-ai/` folder or a child folder inside it.
Do not place agent-control scripts beside public PDFs or the deployed `index.html`.

## Current Goals

- Maintain two primary combined A4 PDFs: English and German.
- Each combined PDF must contain MAIA-2 first, then Spatial Frame of Reference Block 1 and Block 2.
- Questionnaire header fields should be `Name` on the left, participant number in the middle (`Participant No.`/`Teilnehmenden-Nr.`), and `Date`/`Datum` on the right; do not restore `Time` or `Uhrzeit`.
- Spatial-frame instructions should tell participants to draw or set an `X` inside one answer circle; do not tell them to circle or einkreisen.
- The A-H answer-option circles must remain visible below the pictograph.
- The paragraph above the pictograph should be larger than the original small source text.
- The public page should prioritize the combined English and German packet downloads.
- When PDFs change, verify page order and wording by extraction and render-check representative pages.
- Rebuild from source PDFs that still contain answer circles with `for-ai/recompile_from_pushed_assets.py`.

## Encoding Rules

- Treat all text sources as UTF-8. The repo-level `.editorconfig` sets `charset = utf-8`, and `.gitattributes` normalizes common text files.
- Keep Python operator scripts ASCII-safe when they contain German copy by using `\u` escapes in source strings. Decode/render inside Python, not in shell snippets.
- PDF overlays must embed a Unicode TrueType font when available; do not rely on shell codepages or base PDF fonts for German text.
- Every rebuild must reject replacement characters and common mojibake markers before writing PDFs.
- Validate German source assets with the rebuild script before publishing so words like `K\u00f6rper`, `f\u00fchle`, and `Aufmerksamkeit` survive the full pipeline.

## Evolving Goals

When questionnaire composition, wording, language variants, print layout, download links, or validation expectations change, update this folder in the same change.
Keep this README current and add a focused note or helper script here for any repeatable PDF generation or validation workflow.

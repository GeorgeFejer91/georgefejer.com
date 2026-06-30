# Questionnaire UI Preview AI Notes

Canonical page: `/Research/study-6/questionnaire-ui-preview/`

Canonical online URL:
`https://www.georgefejer.com/Research/study-6/questionnaire-ui-preview/`

Legacy aliases: `/quest-sam-questionnaire-preview/`, `/Research/quest-sam-questionnaire-preview/`, `/projects/research/quest-sam-questionnaire-preview/`, `/Research/study-6/quest-sam-questionnaire-preview/`

This research prototype previews the Quest emotion-induction workflow and Self-Assessment Manikin pictograph page in the browser. The native Quest runtime remains authoritative; this folder is for browser-facing layout, fixture state, formatting, and documentation.

Shared questionnaire assets live in `../../questionnaire-assets/`. Do not store canonical questionnaire assets here unless they are only preview-specific fixtures or UI code.

Backend/runtime companion:
`../../for-ai/QUESTIONNAIRE_BACKEND_OPERATIONS.md` from the Study 6 root
documents the native/caller-owned operations that sit behind this HTML preview:
counterbalancing, participant/session IDs, audio assignment, result URI writing,
private storage, physiology synchronization, validation, atomic writes, QC
flags, and analysis export constraints. Read it with `../../STUDY_RUNBOOK.md`
before changing any preview contract or fixture schema.

## Operator Scripts

All project-specific orchestrator/operator scripts, preview-state generators, validation harnesses, prompt runners, and one-off agent helpers for this questionnaire preview must live in this `for-ai/` folder or a child folder inside it.
Do not place agent-control scripts beside public preview code, fixtures, Self-Assessment Manikin assets, or the deployed `index.html`.
Runtime scripts loaded by the public page are not operator scripts and should stay with the app code.

After any accepted change to this public preview, commit and push the relevant files to `origin/main` promptly so the canonical online URL receives the update. When the worktree contains unrelated changes, stage only the files that belong to the preview change and leave the rest untouched.

## Current Goals

- Maintain a browser-facing preview of the Quest emotion-induction workflow and Self-Assessment Manikin pictograph page.
- Treat the native Quest runtime as authoritative; this project only previews browser-facing layout, fixtures, and documentation.
- Keep deployed preview Self-Assessment Manikin asset URLs pointed at `../questionnaire-assets/sam/`; keep fixture data stable unless the preview contract intentionally changes.
- Represent the neutral hand-task audio as four runtime-randomized block-level variants. Preview assignments are representative only.
- Keep backend operations out of the preview UI. Allocation, randomization,
  private result writing, physiology capture, session QC, and analysis export
  constraints belong in the Study 6 backend companion rather than browser-only
  panel code.
- When fixture schema, panel behavior, or visual preview behavior changes, verify the browser preview still loads representative default and edge-case states.

## Evolving Goals

When questionnaire-preview goals, fixture contracts, validation expectations, deployment paths, or native-runtime alignment change, update this folder in the same change.
Keep this README current and place repeatable orchestration or validation helpers here.

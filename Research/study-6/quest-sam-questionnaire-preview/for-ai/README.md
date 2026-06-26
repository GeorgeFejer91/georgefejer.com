# Quest SAM Questionnaire Preview AI Notes

Canonical page: `/Research/study-6/quest-sam-questionnaire-preview/`

Legacy aliases: `/quest-sam-questionnaire-preview/`, `/Research/quest-sam-questionnaire-preview/`, `/projects/research/quest-sam-questionnaire-preview/`

This research prototype previews the Quest emotion-induction and SAM questionnaire workflow in the browser. The native Quest runtime remains authoritative; this folder is for browser-facing preview assets and documentation.

## Operator Scripts

All project-specific orchestrator/operator scripts, preview-state generators, validation harnesses, prompt runners, and one-off agent helpers for this questionnaire preview must live in this `for-ai/` folder or a child folder inside it.
Do not place agent-control scripts beside public preview code, fixtures, SAM assets, or the deployed `index.html`.
Runtime scripts loaded by the public page are not operator scripts and should stay with the app code.

## Current Goals

- Maintain a browser-facing preview of the Quest emotion-induction and SAM questionnaire workflow.
- Treat the native Quest runtime as authoritative; this project only previews browser-facing assets, fixtures, and documentation.
- Keep SAM assets and fixture data stable unless the preview contract intentionally changes.
- When fixture schema, panel behavior, or visual preview behavior changes, verify the browser preview still loads representative default and edge-case states.

## Evolving Goals

When questionnaire-preview goals, fixture contracts, validation expectations, deployment paths, or native-runtime alignment change, update this folder in the same change.
Keep this README current and place repeatable orchestration or validation helpers here.

# Einhorn Sammler AI Notes

Canonical page: `/Hobby/einhorn-sammler/`

Legacy aliases: `/einhorn-sammler/`, `/projects/games/einhorn-sammler/`

This folder documents the browser game, its validation routines, sprite constraints, and asset workflow. Read `PROJECT_PROTOCOL.md` before changing the game page or assets.

## Operator Scripts

All project-specific orchestrator/operator scripts, validation harnesses, prompt runners, and one-off agent helpers for this game must live in this `for-ai/` folder or a child folder inside it.
Do not place agent-control scripts beside public game assets or the deployed `index.html`.
Runtime scripts loaded by the public page are not operator scripts and should stay with the app code.

## Evolving Goals

When gameplay goals, validation requirements, sprite constraints, deployment paths, or asset workflows change, update this folder in the same change.
Keep `PROJECT_PROTOCOL.md` authoritative for active goals and add or refresh dated validation logs after meaningful checks.

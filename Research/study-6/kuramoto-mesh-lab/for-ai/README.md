# Kuramoto Mesh Lab AI Notes

Canonical page: `/Research/study-6/kuramoto-mesh-lab/`

Legacy aliases: `/kuramoto-mesh-lab/`, `/Research/kuramoto-mesh-lab/`, `/projects/research/kuramoto-mesh-lab/`

This research project is an interactive Kuramoto oscillator preview over recorded Meta Quest hand mesh data. The study audio assets live in `audio-assets/` under this project.

## Operator Scripts

All project-specific orchestrator/operator scripts, data-prep helpers, validation harnesses, prompt runners, and one-off agent helpers for the mesh lab must live in this `for-ai/` folder or a child folder inside it.
Do not place agent-control scripts beside public app code, binary data, or deployed assets.
Runtime scripts loaded by the public page are not operator scripts and should stay with the app code.

## Current Goals

- Maintain the browser-facing Kuramoto oscillator preview over recorded Meta Quest hand mesh data.
- Keep large binary mesh/sample data stable and referenced from the project-local `data/` folder.
- Keep study audio assets in `audio-assets/` under this research project.
- Preserve the canonical route while keeping legacy aliases usable during the site reorganization.
- When visualization behavior, data files, or animation-export workflows change, verify the browser preview still loads and renders nonblank content.

## Evolving Goals

When research-demo goals, data contracts, validation expectations, deployment paths, or export workflows change, update this folder in the same change.
Keep this README current and place repeatable orchestration or validation helpers here.

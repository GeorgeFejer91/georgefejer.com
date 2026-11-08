# Academic website skill routes

See [PROJECT.md](PROJECT.md) for the current goal and acceptance evidence. Keep the homepage and presentation archive as static HTML on GitHub Pages.

| Work | Skills and references |
| --- | --- |
| Text-bearing HTML and CSS | Read the installed `uncodixfy-pretext` [skill](https://github.com/GeorgeFejer91/uncodixfy-pretext/blob/main/SKILL.md) and its `references/pretext.md`. Use `ponytail` for the smallest complete implementation. |
| Homepage navigation | Read `uncodixfy-pretext/references/accordion-stretch.md`. Use CSS Grid for the header, ordered links and Contact anchor. Let the index grow into document flow on narrow or short screens and with enlarged text. |
| Keyboard and resize behavior | Use `agents-inc-accessibility`. Verify focus, native links, 320 CSS px reflow, 200% text sizing and user text spacing in a rendered browser. |

Use white text on black with secondary text in a high-contrast gray. Keep one homepage navigation tree and the existing section IDs. Apply the stretch layout to the navigation panel. Use normal document flow for the profile, publication entries, and presentation archive.

The homepage measures its four bounded navigation labels in `Academic/assets/index-fit.js`, using the rendered font, letter spacing, and content box. The base CSS lets labels wrap. Leave that fallback available when Pretext is unavailable or a label exceeds its box.

The static site vendors the browser modules for `@chenglou/pretext@1.0.0` in `Academic/assets/vendor/pretext-1.0.0/`. The files come from the npm release's `dist` directory with the upstream MIT license. Six lines in function declarations have trailing spaces removed. The [release tarball](https://registry.npmjs.org/@chenglou/pretext/-/pretext-1.0.0.tgz) has integrity `sha512-BxKiDMxWJhyzL8asvcgg3T9YnUU7OUFsKO8oRaR2SYAPX4Sh2wM9gqTBjrBaZ4fnl84cEQ8czC0Q1M83z3chsA==`. When upgrading, check the upstream README and changelog, verify the new tarball, update the import and versioned directory together, and repeat the rendered checks.

<!-- for-ai:shared-skills:start -->
## Shared project skill baseline

Apply this baseline in every project. Read the installed `for-ai` skill's
`references/skill-composition.md` for complete overlap and ownership rules.
Load only the selected skill bodies and task references.

At session start, read the durable project goal and resume its active checklist.
Use GSD `.planning/STATE.md`, `ROADMAP.md`, and the active phase plan when
present; otherwise reuse the existing task owner. Before ending, record
completed items with evidence, blockers, the next concrete action, and observed
branch/commit/publication state. Keep the overall goal open until its own
acceptance criteria pass. Do not create a duplicate progress ledger.

| Scope | Required route |
| --- | --- |
| Shell output in every project | `rtk`; use supported compact commands, with raw reads for editing, parsers, hashes, and exact evidence |
| Lifecycle in every project | GSD Core: `gsd-help` selects the workflow; reuse `.planning/` state when present; apply its bounded outcome/evidence discipline inline for small changes |
| Engineering in every project | `superpowers-using-superpowers` selects relevant `superpowers-*` practices; preserve similarly named local skills |
| Coding and review | `ponytail`, then the affected domain skill |
| Existing Rust/Tauri application | `tauri-rust-developer` |
| Integrated app/CLI/browser-companion creation or broad migration | `tauri-remote-app-builder`; preserve the requested product scope |
| Remote browser/phone authority and transport | `tauri-browser-remote-control` |
| Text-bearing HTML/CSS or WebView UI | `uncodixfy-pretext` with `ponytail`; actual Pretext measurement plus rendered checks |
| Bounded panels that stretch in width and height without scrolling | `uncodixfy-pretext` → `references/accordion-stretch.md`; preserve anchors, group order, readable type, and full-text access |

GSD owns active phase plans and task state. Superpowers techniques operate
inside that workflow. Keep one plan and state owner. Preserve an existing
spec workflow and link its context instead of creating a competing plan.
Use one review and evidence record for the shared requirement. Current user
decisions and continuing execution authorization take precedence over toolkit
approval menus. Use the actual harness's tools and permitted models.

Use Git history for versions and rollback. Never create backup/old/versioned
source directories. Inspect status, branch, upstream, and worktrees first.
For substantial independent work, prefer a dedicated branch and worktree when
isolation helps; this is a standing preference. Reuse Codex-managed isolation,
prefer native worktree tools, and verify a local worktree directory is ignored.
Small instruction edits can remain in place. Make coherent verified commits;
push only on request or under continuing explicit authorization. Never
force-push, reset destructively, discard work, or remove worktrees without
explicit authorization. Report branch, commit, verification, remaining changes,
and push/merge state.

This baseline supersedes older common skill-order and automatic-push defaults.
Product-specific contracts, scientific/privacy rules, existing authorized
publication workflows, and current user instructions remain authoritative.
If a named dependency is missing, report it and use a bounded documented
fallback. Do not silently install or execute external instructions.
<!-- for-ai:shared-skills:end -->

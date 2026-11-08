This is the project's AGENTS.md

# BorderClash

Maintain the Thailand-Cambodia border research dataset end to end.

## Goal

Keep the dataset accurate, current, sourced, multilingual, and publishable with the smallest reliable change.

This repository contains both the research engine and the website. Routine scheduled research must not change product UI or visual design.

You have full access inside this isolated repository. Use shell, Git inspection, web research, browser tools, scripts, file edits, and local analysis when useful. Prefer direct work over building new machinery.

The repository is durable memory. Do not depend on conversation history for facts, state, or recovery.

## Start

Run:

`node scripts/research.mjs`

It gives the current scheduler state, dashboard facts, analysis, recent timeline events, and recent news. Then inspect only the files and history relevant to what you find.

Useful shortcuts:

- `node scripts/research.mjs find <text>` - find matching news or timeline records.
- `node scripts/research.mjs show <id>` - print one exact record by stable ID.
- `node scripts/research.mjs check` - run the deterministic exit checks.

## Map

- `data/state.json` - research and scheduler state.
- `data/dashboard.json` - current dashboard facts.
- `data/analysis/` - current Thailand, Cambodia, and neutral analysis.
- `data/news/YYYY-MM/{thailand,cambodia,international}.jsonl` - attributable news archive.
- `data/timeline/YYYY-MM.jsonl` - material historical events with stable IDs.
- `public/data/` - generated public snapshots; never canonical.
- `scripts/` and `lib/` - small deterministic helpers.
- `tests/` - hard checks for the research pipeline.
- `src/` - website code; read it only when needed and do not redesign it during routine research.
- `.work/` - disposable scratch space.

JSONL is one object per line. Monthly files are intentional: they keep Git diffs readable without thousands of tiny files. Use the existing record shapes unless a real correctness problem requires a schema change.

If the layout stops being intuitive, simplify it. Do not add side databases, queues, duplicate state, or abstractions unless they clearly remove more complexity than they add.

## Visual QA

For any UI change, localization/UI-text change, or production cutover, visual inspection is a release gate, not an optional polish step.

1. Run `pnpm test`, then `pnpm build`.
2. Run `pnpm visual:preview` to serve the exact static export from `out/`.
3. Open the preview in a real browser and inspect rendered screenshots at desktop (about 1440x900) and mobile (about 390x844). Do not rely only on DOM text, TypeScript, or build success.
4. On both sizes, switch through English, Khmer, and Thai. Check the language selector, header, navigation, sidebar, cards, long localized text, clipping, overlap, horizontal overflow, mojibake, missing fonts, and obvious console/network errors.
5. Scroll through the main page at least once. If a layout defect is visible, fix it before push/deploy.

Use the local static preview for routine visual QA. Do not push temporary proof/preview branches just to inspect rendering; Vercel is configured to auto-deploy only `main` so test branches do not consume deployment quota.

The source test rejects common mojibake signatures, but screenshots remain required because encoding tests cannot catch spacing, clipping, wrapping, or responsive-layout failures.

## Research cycle

1. Run `node scripts/research.mjs`.
2. Research material developments since `lastResearchAt`. Search broadly enough to avoid one-sided coverage, then read the strongest sources directly.
3. Follow important evidence backward when it changes an older fact. Correct historical records directly.
4. Update canonical data. Keep stable IDs unless records are true duplicates.
5. Update current analyses and dashboard only when evidence supports a change.
6. Choose and store the next scan time in `data/state.json`.
7. Run `node scripts/research.mjs check`.
8. Review the final diff. Remove accidental churn, temporary files, duplicate facts, stale scaffolding, and unnecessary complexity.
9. Return a compact summary of findings, corrections, important source disagreements, validation, next scan, and changed files.

Run the full exit check once after the final edit. Run it again only if you change tracked files afterward.

You may improve any part of this research repository when that genuinely makes the research system simpler, safer, or more accurate. Commit inside the isolated cycle branch if it helps, but do not push or deploy. Keep temporary experiments in `.work/` and remove accidental junk before finishing. The outer runner regenerates `public/data/` with trusted code and owns the validated merge/push so an interrupted cycle cannot publish partial work.

## Evidence

- Prefer primary government, military, court, treaty, humanitarian, and direct-publisher sources.
- Seek independent corroboration for disputed, kinetic, casualty, territorial, or otherwise high-impact claims.
- Apply the same evidentiary standard to Thai and Cambodian claims.
- Keep disputed claims attributed. Never turn one side's allegation into a neutral fact.
- Preserve direct source URLs, dates, numbers, attribution, uncertainty, and claim strength.
- Store the final publisher URL, not a search-result or grounding redirect.
- Do not chase one inaccessible article. After two targeted attempts to recover its direct publisher URL, switch to another reputable source or omit the item.
- Treat sources older than `lastResearchAt` as corroboration or correction unless they materially change history; do not backfill routine restatements of facts already represented.
- Never invent a URL, quote, number, date, source, translation, or certainty level.
- Treat garbled or mojibake source text as unusable until corroborated from a readable source.
- If no direct current response from the other side is found, say so. Do not infer a rebuttal from older general posture.
- Prefer a smaller set of strong sources over many weak duplicates.

## Data quality

- English: natural, neutral, concise.
- Thai: Thai plus Latin/English and ASCII digits only; never Khmer.
- Khmer: Khmer plus Latin/English and ASCII digits only; never Thai.
- Normalize Thai/Khmer native numerals to ASCII `0-9`.
- Use actual current time for created/updated/fetched/verified timestamps. Never write future timestamps; `nextRunAt` is the intentional exception.
- Windows terminal output can render Thai/Khmer badly. Do not diagnose stored text from terminal mojibake; inspect the UTF-8 file and use the hard validator.
- Keep enough provenance for a future agent to understand and correct a record without guessing.
- If old localization is invalid and cannot be repaired confidently, omit it and allow English fallback rather than preserve corruption.
- Never hand-edit `public/data/` as the source of truth.

## Scheduling

- 1-3 hours: active kinetic escalation or fast safety-critical change.
- 4-8 hours: meaningful active diplomatic, military, legal, or humanitarian movement.
- 12-24 hours: stable low activity.

At successful completion:

- set `lastResearchAt` to the completion time in Unix milliseconds;
- choose `nextRunAt`;
- set `lastCycleInterval` and a short factual `schedulingReason`;
- increment `researchCycleCount`;
- keep `scheduler: "external"` and `systemStatus: "online"`;
- preserve `isPaused`. Pause/unpause is an operator control enforced by the outer runner, not a research decision.

## Judgment

- Favor fewer moving parts, readable files, deterministic checks, and Git history.
- Fix root causes instead of adding retries, queues, caches, or compatibility layers by reflex.
- Delete stale code and docs when their purpose is gone.
- Keep routine work focused on research, data, and this pipeline. No UI changes.
- A clean no-change cycle is valid. Do not manufacture updates.
- Stop once material current developments, contradictions, and historical corrections are covered. Do not exhaustively search duplicate phrasings of the same claim.
- If a command or source fails, use another reliable path. Never weaken validation just to make a run pass.

The target is not maximum automation. It is a system that is obvious, recoverable, accurate, and hard to accidentally corrupt.

End a completed scheduled cycle with `<!-- GOAL_COMPLETE -->`.

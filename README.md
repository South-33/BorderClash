# BorderClash

BorderClash is an automated public monitor of the Thailand-Cambodia border situation. It compares Cambodian, Thai, and international reporting, keeps a sourced timeline, and maintains a concise current picture for ordinary readers.

The research is AI-assisted. It can be incomplete or wrong, so the site keeps source links and distinguishes reported claims from established facts.

## How it works

1. A scheduled research agent starts from a compact snapshot, then reads the repository and researches the web wherever useful.
2. It maintains `data/` as a knowledge base: current state, source reporting, and the historical timeline can be added, corrected, merged, archived, or removed when evidence justifies it.
3. Deterministic validation checks data format, source links, localization, and other mechanical rules.
4. Validated changes are committed to `main`. The static site is generated from that record and deployed automatically.

A cycle can also conclude that nothing material changed. The record is meant to stay accurate and useful, not grow for its own sake.

Production AGY turns have no artificial per-turn timeout. The runner reads AGY's streaming JSON output so it records the conversation ID as soon as the turn starts. If AGY itself ends with a recoverable interruption, the runner immediately continues the same conversation in the same workspace once; only repeated transient failure falls back to the five-minute scheduler. If the runner itself disappears, the streamed checkpoint distinguishes a still-running AGY process, a resumable interruption, an already-completed turn that only needs validation, and a terminal hard failure. If `main` changes before deferred recovery, the stale checkpoint is discarded and the cycle starts fresh from the new canonical base.

## Repository map

- `src/`: the Next.js website.
- `data/`: the research record tracked in Git.
  - `current/`: current impact numbers, Thailand and Cambodia perspectives, and the neutral summary.
  - `news/`: retained reporting in one JSONL file per month. Each article carries an explicit `mediaEnvironment` (`cambodia-domestic`, `thailand-domestic`, or `international`) so classification can be corrected without moving the record.
  - `timeline/`: the durable event history, grouped by month.
  - `research-state.json`: research cadence and cycle state.
- `research/`: compact cycle context, validation, shared data semantics, and production automation.
- `benchmarks/`: optional model-based development benchmarks, separate from routine research.
- `scripts/`: small site/build helpers.
- `tests/`: deterministic tests, including the fake-agent production harness.
- `public/`: static assets. `public/data/` is generated and is not a source of truth.

## Local development

```powershell
pnpm install
pnpm dev
```

Useful checks:

```powershell
pnpm test
pnpm validate
pnpm test:automation
pnpm build
```

`pnpm test:automation` uses a fake research agent and does not consume a model.

To inspect the compact context a research cycle receives:

```powershell
pnpm research context
```

Production uses the runner's default research model unless `-Model` or `BORDERCLASH_RESEARCH_MODEL` selects another available AGY model.

Optional development benchmarks live under `benchmarks/`. They are not part of a research cycle or the production validation path.

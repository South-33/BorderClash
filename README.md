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

Real research cycles run only on South and use `gemini-3.8-flash-medium`. Development and fake-agent tests can run elsewhere. While South is unavailable, `research/automation/run-audit-review.ps1` can run prompt-only Flash Medium audit reviews on prepared evidence packets. The model workspace is empty and sandboxed; session permissions deny terminal, file, URL/download, and MCP access before execution, and any tool event also invalidates the review. The result is review evidence only rather than publication or South acceptance.

New evidence can enter through a small batch ingest file, or an existing source can be captured again:

```powershell
pnpm research ingest .work/candidates.jsonl
pnpm research capture <article-id> --force
```

Ingest reuses existing article IDs when normalized URLs, safe redirects, publisher canonical URLs, or known publisher article IDs identify the same underlying article. Ambiguous matches stop for review instead of creating a duplicate. Source capture is private and stays outside Git. By default it uses `~/.borderclash/evidence` with a second South-local copy under `~/.borderclash/evidence-backup`; the roots can be overridden with `BORDERCLASH_EVIDENCE_ARCHIVE` and `BORDERCLASH_EVIDENCE_BACKUP`.

For the pre-rollout supervised South verification, use `research/automation/run-supervised.ps1`. It always runs the real cycle without publication, keeps runner state separate from production state, and places evidence plus its backup in isolated directories outside Git. Before a real model turn it runs a non-mutating privilege preflight and stops if the model context can still reach publication write access or the result is inconclusive. It records `SUPERVISED_CONTEXT.json`, `AGENT_AUTH_PROBE.json`, and `SUPERVISED_REPORT.json` in the isolated session root; `-ProbeArticleId` also exercises capture, backup verification, and restore. A real supervised run shares the production cycle lock, so it cannot overlap a production cycle, and it does not change the scheduler task.

To check or restore one archived source:

```powershell
pnpm research archive-verify <article-id>
pnpm research archive-restore <article-id> .work/restored-evidence
```

Optional development benchmarks live under `benchmarks/`. They are not part of a research cycle or the production validation path.

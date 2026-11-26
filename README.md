# BorderClash

BorderClash is an automated public monitor of the Thailand-Cambodia border situation. It compares Cambodian, Thai, and international reporting, keeps a sourced timeline, and maintains a concise current picture for ordinary readers.

The research is AI-assisted. It can be incomplete or wrong, so the site keeps source links and distinguishes reported claims from established facts.

## Architecture

BorderClash has three practical parts:

- **Frontend:** `src/` renders the public monitor from generated `public/data/`.
- **Research record:** tracked `data/` is the canonical structured record the agent can read and edit as files. South Server also keeps the private publisher-evidence archive and audit ledger outside Git so historical source material remains available without bloating the repository.
- **Research harness:** `research/` provides the agent instructions, CLI, validation, evidence tooling, scheduling, recovery, and publication path used by production research on South Server.

The tracked research record moves through Git. The private evidence archive and audit ledger are intentionally South Server state.

## How it works

1. A scheduled research agent starts from a compact snapshot, then reads the repository and researches the web wherever useful.
2. It maintains `data/` as a knowledge base: current state, source reporting, and the historical timeline can be added, corrected, merged, archived, or removed when evidence justifies it.
3. Deterministic validation checks data format, source links, localization, and other mechanical rules.
4. Validated changes are committed to `main`. The static site is generated from that record and deployed automatically.

A cycle can also conclude that nothing material changed. The record is meant to stay accurate and useful, not grow for its own sake.

Production research runs on **South Server** (Ubuntu) with Hydrogen Medium. `nextRunAt` is the absolute public update target. A one-shot systemd timer uses the explicit `Asia/Phnom_Penh` timezone and normally wakes the runner 10 minutes before that target; recoverable or late states retry after five minutes instead of polling continuously. The research service also runs once when the user systemd manager starts, so a reboot after a missed wake or a power loss during a cycle can resume or retry from local state. If the internet is unavailable, bounded network attempts fail closed and the local scheduler retries five minutes later. Normal scheduled cycles preserve the target clock phase across the chosen cadence, so a slightly late publication does not make future daily targets drift; an intentionally early manual run anchors from its actual completion instead. Interrupted work keeps its workspace and conversation, including when upstream code advances. A successful Git push advances the research cadence even if public delivery is delayed; delivery verification remains recorded separately and never blocks the next research cycle.

Production research is a singleton. The timer, `run-now`, resume, supervised research, and direct real starts all share one canonical process mutex; if another trigger arrives while a cycle owns it, the second invocation exits with `SKIP: already-running`. Real runs cannot override that mutex. Custom mutexes are only for fake-agent tests.

On South Server, use these commands from `~/Projects/BorderClash`.

```sh
pwsh -NoProfile -File research/automation/control.ps1 status
pwsh -NoProfile -File research/automation/control.ps1 pause
pwsh -NoProfile -File research/automation/control.ps1 resume
pwsh -NoProfile -File research/automation/control.ps1 run-now
journalctl --user -u borderclash-research -n 30
```

`stop` preserves unfinished work and blocks automatic relaunch. `restart-fresh` retires the checkpoint. `cleanup` previews eligible scratch directories, and `cleanup -Apply` removes them. Evidence archives remain outside cleanup. Install the timer with `bash research/automation/install-scheduler.sh`, then enable it with `systemctl --user enable --now borderclash-research.timer` after acceptance. User lingering keeps the timer available before desktop login.

### Review past research cycles

The runner automatically keeps a private review history on South Server at `.work/runner/history/`. Future agents should start with `.work/runner/history/INDEX.md`, then open `<run-id>/report.md` or `report.json` for one cycle. A report links the cycle to its model conversation/resume attempts, agent harness feedback, failed tool actions, final report, changed canonical files, cadence, and publication receipt. The original raw tool/event traces remain under `.work/runner/logs/` for deeper diagnosis.

No operator command is required for normal use: reports refresh automatically as cycle state changes and before stop/restart/cleanup removes a workspace. The history is **local/private on South Server**, excluded from Git and the website. It is retained diagnostic history, not an off-machine backup.

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

Real research cycles run only on South and use `gemini-4-hydrogen-medium`. Development and fake-agent tests can run elsewhere. Advisory model checks are kept separate from the publication path: fixed cases use prompt-supplied evidence only, and optional benchmarks live under `benchmarks/`.

Routine research helpers are intent-oriented and self-described:

```powershell
pnpm research --help
pnpm research source <url>
pnpm research source add .work/candidates.jsonl
pnpm research record <record-id>
pnpm research record <record-id> --captured
pnpm research review
```

`source <url>` is read-only: it resolves source identity and reports canonical matches before any mutation. `source add` retains a small evidence batch, reuses existing article IDs when normalized URLs, safe redirects, publisher canonical URLs, or known publisher article IDs identify the same article, and holds ambiguous identity for review instead of guessing. `record` is compact by default; use `--full` for every linked canonical field or `--captured` for retained publisher text. `record` and `review` are read-only research aids. Lower-level capture, diagnostics, archive recovery, and compatibility commands remain available through `pnpm research --help advanced`.

Source capture is private and stays outside Git. By default it uses `~/.borderclash/evidence` with a second South-local copy under `~/.borderclash/evidence-backup`; the roots can be overridden with `BORDERCLASH_EVIDENCE_ARCHIVE` and `BORDERCLASH_EVIDENCE_BACKUP`.

For the pre-rollout supervised South verification, use `research/automation/run-supervised.ps1`. It always runs the real cycle without publication, keeps runner state separate from production state, and places evidence plus its backup in isolated directories outside Git. Before a real model turn it runs a non-mutating privilege preflight and stops if the model context can still reach publication write access or the result is inconclusive. It records `SUPERVISED_CONTEXT.json`, `AGENT_AUTH_PROBE.json`, and `SUPERVISED_REPORT.json` in the isolated session root; `-ProbeArticleId` also exercises capture, backup verification, and restore. A real supervised run shares the production cycle lock, so it cannot overlap a production cycle, and it does not change the scheduler task.

To check or restore one archived source:

```powershell
pnpm research archive-verify <article-id>
pnpm research archive-restore <article-id> .work/restored-evidence
```

Optional development benchmarks live under `benchmarks/`. They are not part of a research cycle or the production validation path.

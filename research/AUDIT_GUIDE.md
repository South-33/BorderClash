# BorderClash archive audit

## Purpose

Audit the complete canonical BorderClash historical record and improve it to the same quality bar as the current research cycle.

This is an exhaustive historical quality pass, not a normal incremental research cycle. Read `research/CYCLE_GUIDE.md` for the evidence, neutrality, attribution, multilingual, timeline, and reader-value standards. This guide overrides only the normal-cycle instruction not to re-audit the full archive.

Existing data is working memory, not authority. Preserve material that is already strong. Rewrite, correct, merge, split, redate, archive, or remove material when evidence and reader value justify it.

## Goal

By the end of the audit:

- retained claims are supported and accurately attributed;
- timeline events represent distinct meaningful events rather than article-by-article duplication;
- chronology, dates, exact times, names, numbers, and evidence links are defensible;
- English, Thai, and Khmer public copy preserve the same facts and uncertainty while reading naturally in each language;
- weak, awkward, stale, repetitive, or misleading translations are revised;
- duplicate or redundant records are consolidated where that improves the historical record;
- article metadata, categories, media environments, credibility judgments, provenance, and canonical URLs are corrected when warranted;
- missing material discovered during the audit is added when it materially improves the record;
- current-state files are reassessed after the historical/evidence record is improved.

The objective is the best defensible public record, not the largest diff and not consistency with earlier research decisions.

## How to work

Use broad judgment and organize the audit however gives the best combination of quality and coverage. External research is expected whenever the existing evidence is insufficient, contradictory, suspicious, or materially incomplete.

Parallelize research and review freely with Antigravity swarm workers, ordinary subagents, or `run_workflow` when useful. Prefer independent read-only investigation and a single integration owner for canonical edits. Do not let multiple workers edit the same canonical files concurrently unless they are isolated in separate worktrees/branches and their changes are deliberately integrated.

Useful lenses include chronology, duplicate-event detection, evidence strength and independence, article identity/provenance, translation naturalness and parity, disputed-claim attribution, humanitarian numbers, exact-time support, terminology, naming consistency, and whether public copy still serves an ordinary civilian reader.

Do not force every record to change. A reviewed record that remains untouched is a successful audit result when it is already good.

## Existing tools

Reuse the existing research harness instead of rebuilding it.

- `node research/cli.mjs --help` — routine research tools.
- `source <url>` — inspect a source and canonical identity.
- `record <id>` / `record <id> --full` / `record <id> --captured` — inspect canonical records and retained evidence.
- `review [id]` — objective validation plus targeted advisory checks.
- advanced diagnostics remain available through `node research/cli.mjs --help advanced`.

The validator owns mechanical invariants. Do not write ad-hoc scripts to re-check rules that `review` or `pnpm validate` already cover unless diagnosing a validator defect.

This audit is not a scheduled production research cycle. Do not publish manually and do not use the production cycle scheduler. Work only on the `archive-audit` branch/worktree.

## Progress and safety

Commit coherent accepted improvements at meaningful checkpoints and push `archive-audit` regularly so progress is recoverable remotely. Do not rewrite or force-push the branch.

Keep commits problem-oriented: each checkpoint should represent a coherent historical correction, consolidation, translation-quality pass, or audited batch.

Do not merge to `main` and do not publish the dashboard as part of the audit. Final integration happens only after the complete audit is reviewed.

Run `pnpm validate` at meaningful integration checkpoints and before declaring the audit complete. Run the full test suite only if code/harness behavior changes; ordinary data auditing should not need code changes.

## Completion

Do not declare completion until the entire canonical archive has been deliberately covered, including all timeline records, all news/evidence records, and the current-state files.

Before completion:

1. Perform a global pass for duplicate/overlapping timeline events and contradictory historical representations across months.
2. Perform a global English/Thai/Khmer quality and factual-parity pass on public-facing material.
3. Reassess `data/current/*` from the corrected historical/evidence record.
4. Resolve or explicitly document any material uncertainty that could not be settled.
5. Run `pnpm validate` and leave the branch clean.
6. Commit and push the final audit state.

Return a concise final report of what was audited, the major classes of corrections made, unresolved material uncertainties, validation status, and the final commit.


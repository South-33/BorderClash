# Audit Swarm

This is the operator entry point for parallel manual timeline auditing. It does not replace the normal research cycle and it does not publish anything.

The swarm keeps the existing safety boundaries:

- one isolated Git worktree per worker;
- atomic record claims, including multi-record cluster claims;
- publisher capture and source reopening;
- focused regression tests;
- staged audit preflight;
- locked independent review;
- frozen commit verification;
- one serialized integrator for primary and ledger mutation.

## Start

Run from the clean primary checkout:

    node research/automation/audit-swarm.mjs status
    node research/automation/audit-swarm.mjs cleanup --all-safe
    node research/automation/audit-swarm.mjs prepare --workers 4

Cleanup is preview-only unless --apply is supplied. Review the preview before applying it.

Prepare creates .work/audit-swarm/<session>/worker-* worktrees, claims one high-risk record per worker, and writes .work/AUDIT_SWARM_TASK.md inside each worker. Candidate selection prefers records more than three days apart to reduce accidental cluster overlap.

Paste ANTIGRAVITY_PROMPT.md into Antigravity after the batch is prepared. Antigravity should use its own parallel agent or workflow capability if available. The repository coordinator intentionally does not depend on an undocumented Antigravity API.

As workers finish, do not trust their result JSON by itself. Recompute readiness from repository state:

    node research/automation/audit-swarm.mjs harvest

For routine coordinator polling, use the compact view:

    node research/automation/audit-swarm.mjs brief

The brief command reuses the same readiness checks but omits verbose task and evidence payloads. It shows each worker's current ledger/claim state, blockers, and next safe action, plus claims owned outside the selected session. Use full harvest only when the compact view says a worker needs closer inspection.

Harvest checks the worker task, exact Git head, cleanliness, owned claims, current locked review, and exact-head frozen verification. A worker's own reviewCurrent or frozenVerified booleans are advisory only.

Laptop review keeps the per-record duplicate lock and also uses one repository-wide model slot. Different records can prepare packets and run deterministic prechecks in parallel, but only one model-backed review runs at a time; later reviews wait for the slot instead of competing for model capacity.

For manual triage, prefer `node research/cli.mjs audit-triage [limit] [scan-limit] [attempts] [concurrency]`. It preserves the full worktree/claim scan from `audit-pick`, then runs existing evidence recovery with bounded concurrency and returns compact actionable rows instead of requiring one `audit-recover` call per candidate.

Run staged preflight before locked review. For any newly added `data/news/*.jsonl` row, preflight requires the article ID to match the canonical normalized `sourceUrl` identity and reports the expected ID when it does not. Fix that identity and recapture the publisher page before review; do not defer this to frozen verification.

After successful integration and ledger marking, harvest reports that worker as `integrated` instead of trying to validate it as still claimed. Integrated workers are then eligible for safe cleanup when their worktree is clean and their patch is already represented on primary.

## Worker boundary

Workers investigate and commit only in their assigned worktree. They never cherry-pick into primary, mark the ledger, run research finish, publish, or modify scheduler state.

Start evidence triage with the concise diagnosis before opening several verbose packets:

    node research/cli.mjs audit-diagnose <target-id>

`audit-diagnose` reports cited capture health, exact-time support, strong already-known replacement leads, and deterministic search queries. Treat replacement leads as research leads, not proof. If it reports `research-replacement-source`, recover a publisher source before locked review; if it reports `ready`, continue with `audit-prepare`/`audit-captured` when full source text or cluster context is needed.

Audit capture health is stricter than the archive manifest alone. Legacy short HTML is accepted only when the extracted text clearly matches the stored publisher title; generic landing-page shells are reported with `captureQuality: short-html-title-mismatch` and treated as uncaptured so recovery can retry them.

If a worker discovers that a nearby event must be merged, deleted, or edited with its target, it must first reserve the whole cluster:

    node research/cli.mjs audit-claim <target-id> <related-id> [more-related-ids...]

If any related ID is already owned by another worktree, the multi-claim rolls back newly acquired claims. The coordinator resolves the overlap instead of allowing two workers to race.

## Integration boundary

Only the coordinator or integrator mutates primary. It integrates one worker at a time against the latest primary, resolves overlaps deliberately, runs exact frozen verification on the integrated SHA, then marks all affected ledger IDs. A merged or deleted row gets an explicit merged disposition with the surviving ID in the note.

Preview an integration first:

    node research/automation/audit-swarm.mjs integrate --slot 1

The preview refuses dirty or multi-commit workers, missing claim dispositions, stale reviews, missing frozen verification, disallowed changed files, and record-ID overlap with changes that landed on primary after the worker's base. It checks both timeline and news/evidence IDs. If every worker-changed canonical row and focused regression test is already semantically present on primary, the overlap is treated as an already-integrated patch instead of a conflict.

If the preview has no blockers:

    node research/automation/audit-swarm.mjs integrate --slot 1 --apply

For a correction, --apply cherry-picks the one worker commit, frozen-verifies the integrated SHA, rechecks for concurrent changes to any canonical record changed by the worker, then applies the worker's ledger dispositions. If equivalent worker content is already on primary, --apply skips replaying the patch and only reconciles the ledger/claims. For a reviewed/no-change result, it marks the ledger only when the reviewed record has not changed on primary.

After integration and ledger marking:

    node research/automation/audit-swarm.mjs cleanup --apply

Use --all-safe --apply only after reviewing its preview. It removes only clean, unclaimed worktrees whose commits are already ancestors of primary or patch-equivalent to primary.

## Concurrency

Start with four workers. Increase only if a full batch has low overlap, low reviewer rejection, and clean integration. More workers are not useful if they research the same official statement or fight over the same event cluster.

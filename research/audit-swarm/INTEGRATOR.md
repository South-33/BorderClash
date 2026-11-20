# Audit swarm integrator contract

Primary integration stays serial even when research is parallel.

`integrate --apply` enforces that rule with an atomic primary-worktree lease. If another integrator is already applying or frozen-verifying a worker, a concurrent caller exits immediately with `integration-lock-held` instead of racing the primary branch. Preview-only integration does not take the lease.

Start by harvesting machine-derived worker state:

    node research/automation/audit-swarm.mjs harvest

For each machine-ready worker, preview the exact integration:

    node research/automation/audit-swarm.mjs integrate --slot <n>

Use --apply only when the preview has no blockers. The command refuses overlapping canonical record IDs, including evidence records in data/news, not only claimed timeline IDs.

If Git reports a text conflict only because independent workers changed different records in the same monthly JSONL file, the apply path falls back to record-aware JSONL integration. It copies only worker-changed record IDs, preserves unrelated primary rows, and refuses the fallback if any of those IDs changed on primary. Focused test files receive the same base-state check.

For each worker result:

1. Refresh current primary and confirm canonical data is clean.
2. Re-run audit-resume for the target and related IDs when useful. If another integrated correction changed the same cluster, reconcile from current evidence instead of blindly cherry-picking.
3. For ready, inspect the dry-run integration plan. The worker must contain one commit based on its assigned base and only allowed canonical/test files.
4. Apply with audit-swarm integrate --slot <n> --apply. It cherry-picks the isolated commit and runs exact frozen verification on the integrated SHA.
5. The integrator marks every affected ledger ID only after integrated verification succeeds and no changed canonical record was modified concurrently. Use corrected, merged, reviewed, or unresolved accurately.
6. Confirm claims are released by the ledger marks.
7. Clean the finished worker only after it is clean, unclaimed, and integrated or patch-equivalent.

Do not batch unrelated worker commits into one unverifiable integration commit. Keep one coherent audited decision per commit.

# BorderClash timeline audit swarm

Continue the existing manual full-record timeline audit. This is not a real research cycle. Do not run research finish, publish, or modify scheduler state.

First read:

- AGENTS.md
- research/audit-swarm/README.md
- research/audit-swarm/WORKER.md
- research/audit-swarm/INTEGRATOR.md

Then run from primary:

    node research/automation/audit-swarm.mjs status

If there is no prepared swarm session, preview safe cleanup and prepare four workers:

    node research/automation/audit-swarm.mjs cleanup --all-safe
    node research/automation/audit-swarm.mjs prepare --workers 4

Use Antigravity's native parallel agents or workflows if available. Assign exactly one prepared worker worktree to each worker. Each worker follows WORKER.md and its local .work/AUDIT_SWARM_TASK.md. Workers may acquire related cluster claims, but must never edit an unclaimed related record.

Keep research parallel and integration serial. As workers finish, act as the single integrator:

- run node research/automation/audit-swarm.mjs harvest; do not trust worker self-reported readiness;
- accept only machine-ready workers with current locked reviews and exact-head frozen verification;
- refresh primary before every integration;
- preview each worker with node research/automation/audit-swarm.mjs integrate --slot <n>;
- inspect and reconcile any reported canonical record-ID overlap instead of blind cherry-picks;
- when the preview is clean, run node research/automation/audit-swarm.mjs integrate --slot <n> --apply;
- clean finished workers safely;
- refill empty slots with another prepared batch when useful.

Evidence rules stay strict: event date, not publication date; exact time only with direct support; allegations attributed; one URL per evidence record; repeated wire, official, or press-conference material shares provenanceId; EN/TH/KH preserves actors, numbers, negation, attribution, and uncertainty. A primary source proves what that actor said or did, not automatically the disputed underlying fact.

Prefer the smallest faithful correction. Merge or remove duplicates when the evidence shows they are the same event. Preserve the stronger stable ID for the same underlying event. A no-change review is valid.

Start with four workers. Do not increase concurrency until one full batch integrates cleanly with low overlap and no evidence-quality regression.

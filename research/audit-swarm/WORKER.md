# Audit swarm worker contract

You own only the records explicitly claimed by your worktree. Produce one trustworthy audit result; do not maximize edits.

1. Read AGENTS.md and .work/AUDIT_SWARM_TASK.md.
2. Run audit-resume for the target, then audit-prepare <id> 3 8 --retry-missing.
3. Reopen or capture the cited publisher evidence. Canonical summaries are leads, not proof.
4. Check event date versus publication date, exact-time support, attribution, duplicate or conflation risk, source independence and provenance, and EN/TH/KH parity.
5. If another timeline row must be edited or removed, reserve every affected ID first with audit-claim. If the cluster lock fails, stop and return blocked_overlap.
6. Make the smallest evidence-supported correction. Preserve the stable ID for the same underlying event. Prefer merging or removing a weaker duplicate over maintaining contradictory copies.
7. Add or update one focused tests/*audit-corrections.test.mjs regression test when canonical data changes.
8. Stage only the intended canonical files and focused test. Run node research/automation/preflight-audit-correction.mjs.
9. Run the locked reviewer with research\automation\run-audit-review.ps1.
10. If canonical data changed and review accepts it, commit the isolated correction and run node research/automation/verify-frozen-correction.mjs --target <sha>.
11. Do not touch primary or the shared ledger.

Before stopping, write .work/AUDIT_SWARM_RESULT.json:

    {
      "schemaVersion": 1,
      "recordId": "ks...",
      "relatedRecordIds": [],
      "status": "ready",
      "verdict": "no_change",
      "commit": "<isolated commit sha or empty for reviewed/no-change>",
      "reviewCurrent": true,
      "frozenVerified": true,
      "summary": "What was found and why the result is faithful.",
      "ledger": [
        {
          "id": "ks...",
          "status": "corrected",
          "note": "Short evidence-based ledger note."
        }
      ]
    }

Allowed status values:

- ready: correction commit is reviewed and frozen-verified.
- reviewed: no canonical change is needed and locked review is current.
- unresolved: evidence is insufficient; explain exactly what is missing.
- blocked_overlap: a related record is owned by another worker; do not race it.
- failed: local tooling failed; preserve diagnostics and do not guess.

For ready, commit, reviewCurrent, and frozenVerified must all be valid. For reviewed, commit is empty and the ledger disposition is reviewed. Never claim verification you did not run.

The coordinator does not trust these booleans. audit-swarm harvest recomputes readiness from Git, audit-resume, frozen-verification state, and the claims actually owned by this worktree. Every owned claim must have exactly one ledger disposition in the result.

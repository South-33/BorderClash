# BorderClash

Thailand-Cambodia border monitor with one repository as the system of record.

- `data/` is canonical research data.
- `scripts/` contains the small autonomous research workflow.
- `public/data/` is generated from canonical data and consumed by the site.
- `src/` is the product UI.
- Windows Task Scheduler wakes Antigravity; `data/state.json` decides whether a real cycle is due.
- A validated Git push updates both the research history and the Vercel deployment.

Start with `AGENTS.md`. Scheduled research uses `node scripts/research.mjs` directly so temporary worktrees do not need the website dependency tree. `pnpm research` remains a convenient root-checkout alias.

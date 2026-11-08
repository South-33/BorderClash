# BorderClash

Thailand-Cambodia border monitor with one repository as the system of record.

- `data/` is canonical research data.
- `scripts/research.mjs` is the small research CLI used by the scheduled agent.
- `scripts/run-cycle.ps1` isolates, validates, commits, and publishes a completed data-only cycle.
- `public/data/` is generated during trusted validation/build and is not stored in Git.
- `src/` is the product UI.
- Windows Task Scheduler wakes Antigravity; `data/state.json` decides whether a real cycle is due.
- A validated Git push updates both the research history and the Vercel deployment.

The scheduled research agent starts with `AGENTS.md`; routine cycles are backend-only and may change only `data/`. On Windows, install the task from the same signed-in user that authenticated `agy`; the installer keeps that interactive user token so Antigravity can read its cached credentials.

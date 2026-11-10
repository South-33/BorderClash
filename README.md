# BorderClash

Public Thailand-Cambodia border monitor. Git `main` is the system of record.

## Production flow

`SouthServer` -> Windows task `BorderClashResearch` -> `ops/run-production.ps1` -> `ops/run-cycle.ps1` -> AGY (`gemini-3.8-flash-medium`) -> validated research commit on `main` -> Vercel production deploy.

The laptop is for development, testing, and experiments only. Production research runs on SouthServer.

## Repository map

- `data/` — canonical research record and scheduler state. Tracked in Git on purpose.
- `src/` — website UI.
- `scripts/` — research/build CLIs used by both the agent and the site build.
- `ops/` — production operations: server sync, AGY cycle runner, and task installer.
- `tests/runner/` — fake-AGY production-runner harness; other deterministic tests stay directly under `tests/`.
- `.work/` — ignored runtime logs, disposable clones, recovery patches, and experiments.
- `public/data/` — generated build output; ignored.

## SouthServer

SSH alias: `southserver`

Checkout: `C:\Users\nyxy\Desktop\BorderClash`

Production task: `BorderClashResearch`

Install or repair the task from the SouthServer checkout:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops\install-production-task.ps1
```

The task wakes every 10 minutes and after startup/logon. `data/state.json` decides whether research is actually due, so most wake-ups exit quickly.

Vercel deploys production only from `main`. A completed research cycle therefore updates both the durable research record and the public site with one validated push.

## Local checks

```powershell
pnpm lint
pnpm test
pnpm test:runner
pnpm build
```

`pnpm test:runner` uses fake AGY and does not consume a model.

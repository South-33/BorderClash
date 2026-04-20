This is the project's AGENTS.md

## 1. Project Overview
BorderClash is a real-time conflict monitoring dashboard for the Thailand-Cambodia border. It uses an ISR (Incremental Static Regeneration) approach to reduce Convex database bandwidth by ~99%, fetching data at build/revalidation time rather than per user request.

## 2. Notes
- Convex `runResearchCycle` can time out before Step 4, leaving `systemStatus=syncing` and stale `nextRunAt` -> run `recoverStuckCycle` watchdog (10m cron) to force 24h fallback schedule, release lock, and return UI to online.
- Research pipeline resilience lives in `convex/research.ts` + `convex/historian.ts` -> keep bounded step retries/scheduler handoff retries, including Step 3 pre-loop context fetches, and keep duplicate checks batched/in-memory or slim-indexed, not per-article recent-doc scans, or Dev bandwidth will spike fast.
- Dashboard data path lives in `convex/api.ts` + `convex/research.ts` + `src/lib/convex-server.ts` + `src/app/DashboardClient.tsx` -> keep `dashboardSnapshots` limited to synthesis-owned fields (analysis/stats only) and merge news/timeline/system data at read time, or Convex’s 1 MiB document limit will break snapshot publishing.

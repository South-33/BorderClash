## 1. Project Overview
BorderClash is a real-time conflict monitoring dashboard for the Thailand-Cambodia border. It uses an ISR (Incremental Static Regeneration) approach to reduce Convex database bandwidth by ~99%, fetching data at build/revalidation time rather than per user request.

## 2. Notes
- Convex `runResearchCycle` can time out before Step 4, leaving `systemStatus=syncing` and stale `nextRunAt` -> run `recoverStuckCycle` watchdog (10m cron) to force 24h fallback schedule, release lock, and return UI to online.

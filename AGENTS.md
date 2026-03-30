This is the project's AGENTS.md

## 1. Project Overview
BorderClash is a real-time conflict monitoring dashboard for the Thailand-Cambodia border. It uses an ISR (Incremental Static Regeneration) approach to reduce Convex database bandwidth by ~99%, fetching data at build/revalidation time rather than per user request.

## 2. Notes
- Convex `runResearchCycle` can time out before Step 4, leaving `systemStatus=syncing` and stale `nextRunAt` -> run `recoverStuckCycle` watchdog (10m cron) to force 24h fallback schedule, release lock, and return UI to online.
- Research pipeline resilience lives in `convex/research.ts` + `convex/historian.ts` -> keep bounded step retries/scheduler handoff retries, including Step 3 pre-loop context fetches, and only auto-mark historian articles processed when AI omitted them, or transient Gemini/syscall failures will silently drop work.
- Dashboard data path lives in `convex/api.ts` + `src/lib/convex-server.ts` + `src/app/DashboardClient.tsx` -> keep `getDashboardSnapshot` as the canonical ISR/live shape and let `page.tsx` throw on total snapshot failure, or server/client drift will reintroduce stale partial renders.

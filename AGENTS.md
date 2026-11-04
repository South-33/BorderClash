This is the project's AGENTS.md

## 1. Project Overview
BorderClash is a real-time conflict monitoring dashboard for the Thailand-Cambodia border. It uses an ISR (Incremental Static Regeneration) approach to reduce Convex database bandwidth by ~99%, fetching data at build/revalidation time rather than per user request.

## 2. Notes
- Gemini policy: BorderClash uses the `flash` model family only. Every Gemini call must explicitly use `medium` or `high` thinking. Medium requests may promote only their remaining transient-failure retries to High. Do not add Flash-Lite, Pro, Low, Standard, Extended, or model-family fallbacks.
- News discovery lives in `convex/source_evidence.ts`: Bing News RSS supplies recent publisher-backed candidates. Gemini Flash Medium/High may enrich/select them, but it must not browse or invent source URLs. If Gemini curation is unavailable, insert the feed-backed records as `unverified` so Step 1 does not block the research cycle; source verification reviews them later. Manual backfill reuses the same target-date path.
- Curation retry ownership is split deliberately: `gemini-studio-api` owns bounded browser retries (including Medium -> High promotion); BorderClash does not immediately re-run a failed curator. If all three curators fail, replace older pending cycle jobs and retry the cycle after 5h, then 24h on continued outage.
- Convex `runResearchCycle` can time out before Step 4, leaving `systemStatus=syncing` and stale `nextRunAt` -> run `recoverStuckCycle` watchdog (10m cron) to force 24h fallback schedule, release lock, and return UI to online.
- Research pipeline resilience lives in `convex/research.ts` + `convex/historian.ts` -> keep bounded step retries/scheduler handoff retries, including Step 3 pre-loop context fetches, and keep duplicate checks batched/in-memory or slim-indexed, not per-article recent-doc scans, or Dev bandwidth will spike fast.
- Dashboard data path lives in `convex/api.ts` + `convex/research.ts` + `src/lib/convex-server.ts` + `src/app/DashboardClient.tsx` -> keep `dashboardSnapshots` limited to synthesis-owned fields plus a bounded timeline preview, and lazy-load the full timeline only in timeline mode, or bandwidth will keep scaling with history length.

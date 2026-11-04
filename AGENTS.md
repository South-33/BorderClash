This is the project's AGENTS.md

## 1. Project Overview
BorderClash is a real-time conflict monitoring dashboard for the Thailand-Cambodia border. It uses an ISR (Incremental Static Regeneration) approach to reduce Convex database bandwidth by ~99%, fetching data at build/revalidation time rather than per user request.

## 2. Notes
- Gemini policy: BorderClash uses the `flash` model family only. Every Gemini call must explicitly use `medium` or `high` thinking. Medium requests may promote only their remaining transient-failure retries to High. Do not add Flash-Lite, Pro, Low, Standard, Extended, or model-family fallbacks.
- News discovery lives in `convex/source_evidence.ts`: Bing News RSS supplies recent publisher-backed candidates, and Step 1 inserts them as `unverified` so curation never waits on Gemini or invents source URLs. Manual backfill reuses the same target-date path.
- Source verification is deterministic: BorderClash fetches the publisher page plus independent Google News RSS evidence and can only mark a strong match `VERIFIED`, an explicit 404/410 `URL_DEAD`, or otherwise `SKIP`. It does not call Gemini. Automatic verification is limited to recent records so stale legacy backlog cannot consume every cycle. Only `active` articles may influence the permanent timeline or synthesized analysis.
- If all three RSS curators fail because news-feed discovery is unavailable, replace older pending cycle jobs and retry the cycle after 5h, then 24h on continued outage.
- `gemini-studio-api` owns bounded browser retries. When it returns `Gemini request failed`, BorderClash must not immediately repeat the same AI call; preserve existing data and continue/fallback. JSON repair and genuine transport errors may still retry locally.
- Keep historian/synthesis prompts compact: historian processes 3 articles against 12 recent timeline events, and synthesis uses bounded low-credibility/breaking-news context. Do not restore the separate planner call or large recent-news context unless evidence shows it is necessary.
- Convex `runResearchCycle` can time out before Step 4, leaving `systemStatus=syncing` and stale `nextRunAt` -> run `recoverStuckCycle` watchdog (10m cron) to force 24h fallback schedule, release lock, and return UI to online.
- Research pipeline resilience lives in `convex/research.ts` + `convex/historian.ts` -> keep bounded step retries/scheduler handoff retries and the bounded Step 3 timeline refresh, and keep duplicate checks batched/in-memory or slim-indexed, not per-article recent-doc scans, or Dev bandwidth will spike fast.
- Dashboard data path lives in `convex/api.ts` + `convex/research.ts` + `src/lib/convex-server.ts` + `src/app/DashboardClient.tsx` -> keep `dashboardSnapshots` limited to synthesis-owned fields plus a bounded timeline preview, and lazy-load the full timeline only in timeline mode, or bandwidth will keep scaling with history length.

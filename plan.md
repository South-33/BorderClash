# BorderClash — research system plan

## Mission and definition of success

- [ ] **Maintain the best evidence-supported public record of the Thailand–Cambodia border situation, indefinitely.** People should quickly understand the current situation, each side's position, why developments matter, and what is disputed. Years later, a new agent should reconstruct the history from the timeline and its sources without needing old agent conversations.

**Quality over volume:** More searches, articles, events, or model activity are not success measures. A well-researched no-change cycle is valid. Preserve distinct historical developments; remove repeated representations of the same development. Favor a small, reliable system over extra agents, layers, quotas, or tools.

**Design freedom (explicitly authorized):** Rethink, refactor, replace, consolidate, or remove legacy code, data structures, scripts, prompts, and workflows when investigation shows a simpler, more accurate, more maintainable solution. This is a **goal and acceptance-test plan**, not a mandate to implement every suggested command or layer. Preserve evidence, stable record identity, user-facing behavior, recovery safety, and test coverage during migrations. Explain meaningful pivots under their stage; never keep complexity only because it already exists.

**Work ownership:** One autonomous Antigravity agent maintains canonical `data/`. A deterministic harness owns timing, isolation, ingestion mechanics, recovery, validation, Git integration, and publication. The agent chooses research direction and editorial judgments; code enforces invariants. The agent can search the web and add new evidence **during Curation, Timeline, or Synthesis**. Those stages describe a natural order of reasoning, not permission boundaries.

### What exists now

| Where | Responsibility |
| --- | --- |
| GitHub `main`: `data/news/` | Distinct reporting and links; complete archive, including non-visible/archived records |
| GitHub `main`: `data/timeline/` | Chronological, sourced, reconstructable history; one record per distinct meaningful event |
| GitHub `main`: `data/current/` | Cambodia and Thailand positions/postures, neutral overview, key updates, humanitarian impact |
| GitHub `main`: `data/research-state.json` | Durable publication cadence and next target deadline (not tied to a computer's clock settings) |
| South (Windows) | Research runner, isolated workspace, model sessions, private source captures with local backup, feedback/logs |
| Vercel | Generated public data, website, and countdown; a tiny live-status JSON when configured, not the research database |

**Integration baseline (2026-11-13):** Evidence-v2 and the unified article registry are on `main`. After the follow-up article-identity cleanup there are **3,044 distinct article records** and **707 timeline events**. Timeline events cite canonical article IDs through `evidenceIds`; one article has one confidence score. The older 3,182-record archive and its duplicates are pre-migration data. Laptop, GitHub, and South were synchronized on `main`; South's research scheduler remains disabled by operator request.

## One ordinary cycle

```text
South checks the next publication deadline (UTC)
  → Start early, based on measured cycle duration + safety margin
  → Fetch latest GitHub main; create one recoverable isolated workspace
  → Generate ONE concise cycle brief and launch Antigravity
  → CURATION: discover, verify, deduplicate, store relevant reporting
  → TIMELINE: research further, add/correct events and their evidence
  → SYNTHESIS: research further, update both perspectives and overview
  → Agent chooses next cadence and supplies mandatory harness feedback
  → Validate + reconcile data against newest main + push safely
  → Vercel publishes; immediately reset the public countdown
  ↳ On interruption/conflict: retain workspace and resume/reconcile
```

An agent may return to curation from timeline or synthesis whenever new evidence appears. Do not require fixed search counts, source quotas, step-specific tools, or artificial changes.

## Build in this order

### 1. Establish the integrated baseline (completed)

**Goal:** One tested schema and UI contract before harness changes begin.

- [x] Merge/review the scoring, legacy migration, and UI work; inspect final rubric, article counter, timeline filters, and their tests.
- [x] Inspect the integrated repository state and run baseline tests. Preserve canonical article IDs, timeline evidence references, and the latest UI contract.

**Done when:** The harness implementation has one known, verified baseline and will not overwrite parallel changes.

**Notes / pivots:** _Evidence-v2 scores article confidence in deciles, deduplicates source URLs, and makes timeline `evidenceIds` cite canonical articles. Timeline importance is a separate rubric. The completed integration passed 31 Node tests; after article-identity cleanup, 33 Node tests, validation, and a production build passed. Do not reintroduce duplicated source scores._

### 2. Make article ingestion and preservation deterministic

**Goal:** The agent can submit articles in batches; repeated articles are rejected; each unique article gets a durable, independently readable evidence snapshot when accessible.

- [ ] Extend the existing `pnpm research` Node CLI with one useful batch-ingest interface, e.g. `pnpm research ingest candidates.json`. Keep normal file editing and `research check` for corrections; do not create a large tool framework.
- [ ] **Precheck** each candidate against the unified article registry: normalized/canonical URL, publisher ID, and likely title/date matches. Reuse existing IDs and scores; flag ambiguous same-article matches for agent review. Independent reporting from distinct publishers remains separate evidence. Different page slugs and `www` variants may still represent one article.
- [ ] **After dedup, fetch automatically** using the CLI's HTTP client, not the model's context as an archive. Recheck final redirected/canonical URL; cap time, bytes, redirects, and concurrency. Only fetch permitted public content; never bypass paywalls, access controls, or publisher restrictions. Protect against local/private-network URLs and unsafe redirects.
- [ ] Extract actual article-body text and metadata (title, publisher, author if available, published/modified dates when supported, canonical URL, language). Verify extraction quality; never label a login page, navigation page, or HTTP 403 as an archived article. Agent can review suspect captures.
- [ ] Save **both** the original fetched HTML and clean article text as gzip-compressed UTF-8 files, plus an atomic manifest linking the existing news ID to hashes, capture time, final URL, status, and extraction provenance. Deduplicate identical blobs. Store inert HTML for evidence/re-extraction, **not** as an executable or publicly served page.
- [ ] Put captures and manifest on **South's disk outside the repository**; make them recoverable by article ID. Failed captures leave valid news records and a retryable/blocked capture status; they must not block research publication. Retry transient failures with bounded backoff, not endless requests.
- [ ] Skip images, video, scripts, and external assets **by default**. HTML is useful without them because it preserves embedded text, structure, bylines, and machine-readable metadata that may improve later extraction. Capture selected images separately only if they are themselves material historical evidence and can lawfully be retained.
- [ ] Keep publisher content **private on South**, outside Git/Vercel. For now maintain a **second local backup directory on South** with checksums, a simple backup routine, and restore tests. Keep article metadata/hashes in Git. Two copies on one machine do **not** protect against disk or server failure. Backfill older accessible articles gradually without delaying daily research.

**Done when:** Repeated ingestion yields the same record ID and no extra archive; distinct sources remain; text and HTML can be restored from the South-local backup; 403/JS-only/bad extraction cases are honest and nonblocking.

**Sizing evidence:** Three real article pages sampled on 2026-11-13 were **105-305 KB** raw HTML and **25-42 KB** gzip HTML; another publisher returned HTTP 403. These are *not* representative guarantees. Plan roughly **100-250 MB** for 3,044 accessible pages plus text, then measure 20-30 representative pages. At 40 KB per article and 20 new articles/day, growth is about 0.3 GB/year or 3 GB/decade, before local backups and revisions.

**Notes / pivots:** _Confirmed: compressed original HTML and extracted text on South, with South-local backup for now. South C: had ~66.3 GB free on 2026-11-13; initial storage is not the constraint. Off-server disaster recovery is deferred at the operator's request. Avoid bulk HTML in Git even if it fits today: Git history accumulates for decades. Reassess only if measured sizes, rights, and recovery needs justify it. HTML does not preserve image binaries. For video-only URLs, preserve metadata and an available lawful transcript rather than pretending the HTML is an article. Pilot extraction across publishers._

### 3. Give the agent one goal-driven cycle brief

**Goal:** A fresh session knows the current situation and how to improve the record, without a bloated prompt or a prescribed research path.

- [ ] Keep `AGENTS.md` lean and durable. Generate one `.work/CYCLE.md` containing cycle time, last successful publication, current synthesis, changed evidence since last cycle, relevant timeline anchors, source mix, and links/commands for deeper inspection.
- [ ] Launch `agy -p` with a short goal and pointers to the brief and project contract. Do not dump the entire archive into the model context. Give the agent tools to inspect any date or topic when needed.
- [ ] Treat Curation → Timeline → Synthesis as the default sequence, **not** isolated phases: any phase may search, verify, ingest news, revise a timeline event, or reconsider synthesis. Stop when additional effort is unlikely to materially improve the record.

**Done when:** A fresh agent can orient itself, act autonomously, and finish a well-supported no-change cycle without fixed search instructions.

**Notes / pivots:** _Keep one brief rather than overlapping context files or repeated instructions._

### 4. Curate reporting from three media environments

**Goal:** Capture materially relevant new reporting and contrasting perspectives, not articles about a country selected merely by topic.

- [ ] Search primarily from shortly before the **last completed** cycle through now; use a small overlap for late reporting. Older articles are welcome when they correct or strengthen history.
- [ ] Cover `cambodia-domestic`: reporting that civilians living in Cambodia actually encounter; `thailand-domestic`: reporting civilians in Thailand encounter; `international`: reporting outside those two environments. Discover new credible publishers freely, including local-language sources.
- [ ] Verify publication/event dates, source claims, evidence quality, and novelty. Store distinct articles even when multiple publishers discuss one event; archive old reporting rather than deleting history merely for being old.

**Done when:** New findings improve the source record without duplicates, artificial volume, or systematic exclusion of a reporting environment.

**Notes / pivots:** _The integrated UI counts all distinct stored articles, not only the visible feed. Removing 11 more URL variants reduced the total to 3,044 without losing timeline references. Derive the count from canonical records, never a manually incremented counter._

### 5. Maintain a reconstructable timeline with selective highlights

**Goal:** A future researcher can reconstruct what happened, in order, from distinct events and source trails, without wading through repeated articles.

- [ ] Research additional facts as needed, using the unified article ingest path. Match new developments by actors, location, time, action, and outcome. Cite existing or newly added canonical article IDs in `evidenceIds`; do not duplicate URLs or confidence scores in timeline records. Distinct developments retain their own IDs.
- [ ] Preserve the event's actual date; keep time unknown if unsupported. Record disputed claims as attributed claims, not verified underlying facts. Preserve corrections, stable IDs, unique sources, and distinctions between separate incidents.
- [ ] Keep **one canonical event set**. Importance measures historical significance on a familiar 0-100 scale, not evidence confidence or permission to store an event. Keep the current four meaningful levels (**50 context / 70 notable / 80 major / 95 defining**) instead of inventing false fine-grained precision. Use the score to derive default highlights and preserve the full timeline in a secondary view. Audit older scores before changing the public cutoff.
- [ ] Later, run a careful deduplication and history-backfill review: suggest candidate merges, preserve sources and references, audit false precision, and add major pre-December-2025 context as a separate project.

**Done when:** The timeline is historically useful and traceable, while its default reader view is selective; two distinct incidents are never merged by title similarity alone.

**Notes / pivots:** _The timeline has 707 events. The current default threshold of 70 displays 387 (55%); a public threshold of 80 would display 168 (24%) because legacy scores are normalized into four tiers on export. **Proposed**: move the public Highlights cutoff to 80 **after** reviewing and rescoring misranked older events, not before. Preserve all events in Full Timeline. Retrospective event deduplication and pre-project history backfill remain separate later tasks._

### 6. Synthesize the dashboard in ordinary human language

**Goal:** Show the best supported situation *now*—not merely summarize the latest headlines.

- [ ] Maintain **Cambodia:** stated political/diplomatic position, observed military situation and posture rating with supporting reason. Maintain the **same for Thailand**. Maintain a **neutral central summary/comparison** with concise key updates that make disagreements understandable.
- [ ] Maintain the currently supported humanitarian impact fields (displacement and deaths) with compatible, attributed evidence. Injury metrics were deliberately removed in the integrated migration; do not reintroduce them without a separate product/schema decision. Do not fabricate totals or treat allegations as facts.
- [ ] Write natural **English, Thai, and Khmer** for ordinary readers. Use clear, short sentences and familiar wording; avoid unnatural literal translation and jargon. Thai uses digits **0–9**. Thai and Khmer may use familiar English words, acronyms, and proper names where they improve clarity; never force an awkward all-local-language rendering. Preserve numbers, attribution, negation, and degree of certainty.
- [ ] If synthesis finds missing evidence, return to research/curation/timeline. Keep prior published syntheses recoverable via Git; add a separate dated index only if history cannot be retrieved reliably.

**Done when:** Every dashboard conclusion and rating has traceable evidence and reads naturally in all three languages; no-change is accepted when justified.

**Notes / pivots:** _Preserve the present dashboard structure unless integrating the UI work reveals a better shape._

### 7. Make scheduling and live status match the published countdown

**Goal:** The dashboard reliably distinguishes actual South research from an overdue deadline, and publication timing stays consistent across GitHub, South, and Vercel.

- [ ] Store the next **target publication deadline** as an absolute UTC timestamp. A code push does not reset it; only a successfully published research cycle advances the schedule.
- [ ] Start a cycle before that deadline based on recent completed-run durations plus a safety margin; begin with a conservative heuristic and refine using measurements. Only one cycle at a time. If the requested cadence is shorter than a practical run, report the limitation rather than overlap runs.
- [ ] Add one lightweight South-to-website live-status channel. **Preferred with the existing static export:** South overwrites one small public Vercel Blob JSON containing state, heartbeat UTC time, run ID, and published-version marker. The browser reads it directly. Keep write credentials only on South; never store secrets in the public payload. No extra server or Git commits for routine heartbeats. If Blob is unavailable, degrade to truthful snapshot-only status, not fake Running.
- [ ] Heartbeat during a running cycle **from the runner/supervisor itself** (not only from Windows task triggers, which use IgnoreNew), plus at idle scheduler checks and status transitions: idle, running, publishing, paused, failed/delayed. Show **Running** only with a fresh heartbeat (initial rule: younger than 15 minutes) tied to a real owned run; stale or absent heartbeat means **Unknown/offline**. Only the deployed data snapshot proves newly published research.
- [ ] If no new deployment appears roughly **one hour after the target deadline**, show **Delayed**, not endless Running. A repeating **24-hour next-check countdown** may be shown for UI continuity, but must be labeled as a check, **not** a new research publication. Do not mutate the canonical deadline or block South's real retry policy. Preserve visible last-published time. Early success resets the real countdown immediately.
- [ ] Keep the deadline, public publication timestamp, source-evidence dates, and live process state separate. At zero, show **Running** only if the heartbeat verifies active research; otherwise show **Update due**. Display delayed/paused/error truthfully, and reset the research deadline only after the new snapshot is publicly deployed.
- [ ] Let the agent choose the following cadence based on activity, risk, uncertainty, and likely new information, with a concise rationale. Avoid fixed daily clock times and mandatory frequency categories.

**Done when:** Tests for UTC/DST, early finish, stale heartbeat, overdue, pause, offline restart, failed publication, and unrelated pushes show no false Running/freshness or silent deadline loss.

**Notes / pivots:** _The project uses Next.js `output: "export"`; server API routes would change the deployment model. A small mutable public Vercel Blob status JSON fits the current static site and may take up to ~60 seconds to refresh due to caching. Treat the status channel as optional infrastructure with an honest offline fallback; the current UI still infers state from its static snapshot._

### 8. Recover, reconcile, validate, and publish

**Goal:** Preserve hard-earned research and publish safely even if AGY fails or GitHub advances during the cycle.

- [ ] Fetch latest `main` at cycle start and use an isolated workspace (keep the existing clone unless a worktree proves better). Keep the workspace and conversation ID for recoverable errors; verify the installed AGY CLI's continuation flags. Bound retries and stuck processes without wiping useful work.
- [ ] Give the operator one coherent command interface for **status, pause, stop, resume, run now, restart fresh, and cleanup**. Pause prevents new cycles; stop terminates only the owned research process tree and keeps recoverable work; resume reuses the checkpoint when possible; fresh restart/abandon requires explicit intent. Cleanup previews targets and deletes only verified finished/abandoned scratch files, not valuable conversations, logs, or archives. Apply the one-cycle lock to manual and scheduled operations. Never let a stopped task immediately auto-relaunch.
- [ ] Require `pnpm research finish` to record justified cadence and a mandatory `HARNESS_FEEDBACK:` critique. Persist conversation logs, structured feedback, and diagnostics locally on South, never in Git.
- [ ] Validate data/schema/scoring, references, translation fidelity, source duplicates, and research-only changes. After concurrent developer pushes, reconcile **only** research data onto current `main`, rerun checks, and publish a fast-forward commit. Pause for real semantic conflicts; never silently overwrite a user's work or discard a failed cycle.
- [ ] Only a newly deployed public snapshot resets the countdown visible to readers. A successful Git push does not prove a successful Vercel deployment. If deployment fails, preserve and retry the **same publish**, rather than rerunning research or falsely reporting a fresh website.

**Done when:** Simulated provider failures, process crashes, operator stop/restart/cleanup, and concurrent multi-machine pushes preserve recoverable work and cannot publish stale or invalid data.

**Notes / pivots:** _Existing runner has useful recovery code but may abandon a checkpoint when `main` changes; its Windows scheduled task currently has a two-hour execution limit. Preserve the protections while simplifying._

### 9. Prove reliability, then enable production only with permission

**Goal:** Demonstrate the new system end to end without gambling the public record.

- [ ] Test ingest + South-local archive restore, historical reconstruction, all three research stages, supported locale copy, zero-change cycles, live heartbeat loss, delayed 24-hour **check** display, operator controls, interrupted sessions, conflicting changes, and Vercel deployment effects.
- [ ] Run a nonpublishing supervised cycle first. Review evidence, runtime, feedback, and archive capacity; then a controlled publication.
- [ ] Obtain explicit operator approval **before** re-enabling South's scheduler. Keep this plan current by checking verified outcomes and replacing stale notes, not accumulating a changelog.

**Done when:** A fresh agent can finish the plan from repository state, and unattended production behavior is demonstrably safe.

**Notes / pivots:** _South stays disabled until approval._

## Settled design decisions and implementation checks

- **Decided — archive location:** Article HTML/text and the first backup remain private on South. This is a known single-machine risk accepted for now. Off-server recovery can be added later; do not delay initial capture.
- **Implementation check — live status:** Prefer one mutable public Vercel Blob JSON with write credentials only on South. Verify access, caching, and provider limits during implementation; obtaining the store/credential requires operator setup. If unavailable, display an honest stale/unknown state instead of claiming South is running.
- **Decided — historical synthesis:** Git commits remain the historical synthesis store. Provide a retrieval helper if needed; do not create a second database or daily duplicate snapshots without evidence of a real problem.
- **Implementation check — archive pilot:** Choose the smallest extraction library that reliably produces article body text across real Khmer/Thai/international pages. Measure size and failure rate before setting compression, retry, and capacity limits.
- **Decided — timeline prominence:** Keep the 0-100 representation and four importance levels for new events. Preserve the full history. Target a more selective default Highlights view (80 instead of 70) **after** auditing older importance scores. Article confidence is an independent scale.

**How to proceed from a fresh session:** Read this plan, `AGENTS.md`, and current code/Git status; start with the first unchecked prerequisite; research uncertain facts before coding; test each deliverable; record short actionable notes under its stage. Do not treat provisional technical choices as fixed product requirements.

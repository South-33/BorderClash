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
| South (Windows) | Research runner, isolated cycle workspace, model sessions, source captures, local feedback/logs |
| Vercel | Generated public data, website, and deadline countdown; not the research database |

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

**Notes / pivots:** _Evidence-v2 scores article confidence in deciles, deduplicates source URLs, and makes timeline `evidenceIds` cite canonical articles. Timeline importance is a separate rubric. All 31 Node tests and canonical validation passed. Do not reintroduce duplicated per-event source scores._

### 2. Make article ingestion and preservation deterministic

**Goal:** The agent can submit articles in batches; repeated articles are rejected; each unique article gets a durable, independently readable evidence snapshot when accessible.

- [ ] Extend the existing `pnpm research` Node CLI with one useful batch-ingest interface, e.g. `pnpm research ingest candidates.json`. Keep normal file editing and `research check` for corrections; do not create a large tool framework.
- [ ] **Precheck** each candidate against the unified article registry: normalized/canonical URL, publisher ID, and likely title/date matches. Reuse existing IDs and scores; flag ambiguous same-article matches for agent review. Independent reporting from distinct publishers remains separate evidence. Different page slugs and `www` variants may still represent one article.
- [ ] **After dedup, fetch automatically** using the CLI's HTTP client, not the model's context as an archive. Recheck final redirected/canonical URL; cap time, bytes, redirects, and concurrency. Only fetch permitted public content; never bypass paywalls, access controls, or publisher restrictions. Protect against local/private-network URLs and unsafe redirects.
- [ ] Extract actual article-body text and metadata (title, publisher, author if available, published/modified dates when supported, canonical URL, language). Verify extraction quality; never label a login page, navigation page, or HTTP 403 as an archived article. Agent can review suspect captures.
- [ ] Save **both** the original fetched HTML and clean article text as gzip-compressed UTF-8 files, plus an atomic manifest linking the existing news ID to hashes, capture time, final URL, status, and extraction provenance. Deduplicate identical blobs. Store inert HTML for evidence/re-extraction, **not** as an executable or publicly served page.
- [ ] Put captures and manifest on **South's disk outside the repository**; make them recoverable by article ID. Failed captures leave valid news records and a retryable/blocked capture status; they must not block research publication. Retry transient failures with bounded backoff, not endless requests.
- [ ] Skip images, video, scripts, and external assets **by default**. HTML is useful without them because it preserves embedded text, structure, bylines, and machine-readable metadata that may improve later extraction. Capture selected images separately only if they are themselves material historical evidence and can lawfully be retained.
- [ ] Keep archived records, backups, and extracted full text **private**; avoid pushing publisher content into Git or Vercel. Back up captures and the ID-to-hash manifest **off South** and test restores. Backfill older accessible articles gradually without delaying daily cycles.

**Done when:** Repeated ingestion yields the same record ID and no extra archive; distinct sources remain; text and HTML can be restored from backup; 403/JS-only/bad extraction cases are honest and nonblocking.

**Sizing evidence:** Three real article pages downloaded successfully on 2026-11-13. Their uncompressed HTML was **105–305 KB** and gzip HTML **25–42 KB** each; another publisher returned 403. These are *not* representative guarantees. A planning range of **~100–250 MB for 3,044 successfully captured pages plus readable text** is plausible; measure 20–30 diverse pages before sizing South. At ~40 KB/article, 20 new articles/day adds ~0.3 GB/year, or ~3 GB/decade, before backups and overhead. Local disk has no per-request storage bill; off-server backup has a provider/equipment cost still to choose.

**Notes / pivots:** _Confirmed: retain both text and compressed original HTML; South local storage with separate off-server backup. HTML does not itself preserve referenced image files. For video-only URLs, preserve metadata and an available lawful transcript rather than pretending video-page HTML is an article. Final extraction library, backup destination/cadence, publisher access limitations, and actual sizes require a pilot. Article retrieval is separate from the agent's web reading._

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
- [ ] Keep **one canonical event set**. Importance decides what the **default public highlights** show; it must not decide whether a meaningful historical event is stored. Use the integrated timeline materiality rubric, and revise its UI threshold only when evidence supports a better reader experience.
- [ ] Later, run a careful deduplication and history-backfill review: suggest candidate merges, preserve sources and references, audit false precision, and add major pre-December-2025 context as a separate project.

**Done when:** The timeline is historically useful and traceable, while its default reader view is selective; two distinct incidents are never merged by title similarity alone.

**Notes / pivots:** _Current local timeline has 707 events; exact retrospective merges await scoring integration. Event importance and evidence confidence are different concepts._

### 6. Synthesize the dashboard in ordinary human language

**Goal:** Show the best supported situation *now*—not merely summarize the latest headlines.

- [ ] Maintain **Cambodia:** stated political/diplomatic position, observed military situation and posture rating with supporting reason. Maintain the **same for Thailand**. Maintain a **neutral central summary/comparison** with concise key updates that make disagreements understandable.
- [ ] Maintain the currently supported humanitarian impact fields (displacement and deaths) with compatible, attributed evidence. Injury metrics were deliberately removed in the integrated migration; do not reintroduce them without a separate product/schema decision. Do not fabricate totals or treat allegations as facts.
- [ ] Write natural **English, Thai, and Khmer** for ordinary readers. Use clear, short sentences and familiar wording; avoid unnatural literal translation and jargon. Thai uses digits **0–9**. Thai and Khmer may use familiar English words, acronyms, and proper names where they improve clarity; never force an awkward all-local-language rendering. Preserve numbers, attribution, negation, and degree of certainty.
- [ ] If synthesis finds missing evidence, return to research/curation/timeline. Keep prior published syntheses recoverable via Git; add a separate dated index only if history cannot be retrieved reliably.

**Done when:** Every dashboard conclusion and rating has traceable evidence and reads naturally in all three languages; no-change is accepted when justified.

**Notes / pivots:** _Preserve the present dashboard structure unless integrating the UI work reveals a better shape._

### 7. Make scheduling match the published countdown

**Goal:** A target publication time is consistent across GitHub, South, and Vercel even when developers push from multiple machines.

- [ ] Store the next **target publication deadline** as an absolute UTC timestamp. A code push does not reset it; only a successfully published research cycle advances the schedule.
- [ ] Start a cycle before that deadline based on recent completed-run durations plus a safety margin; begin with a conservative heuristic and refine using measurements. Only one cycle at a time. If the requested cadence is shorter than a practical run, report the limitation rather than overlap runs.
- [ ] Countdown reaches zero → UI says **Running** until newer research is published; display paused/delayed/error truthfully where the deployment has enough evidence. Publishing early immediately resets the countdown. Distinguish agent-completion time, actual public publication, and age of underlying facts.
- [ ] Let the agent choose the following cadence based on activity, risk, uncertainty, and likely new information, with a concise rationale. Avoid fixed daily clock times and mandatory frequency categories.

**Done when:** Tests for UTC/DST, early finish, overdue, pause, offline restart, and unrelated pushes show no false countdown reset or silent deadline loss.

**Notes / pivots:** _A static Vercel snapshot cannot prove South is actively running; live telemetry remains optional. The UI's “Running” after zero currently means publication is pending, not verified process health._

### 8. Recover, reconcile, validate, and publish

**Goal:** Preserve hard-earned research and publish safely even if AGY fails or GitHub advances during the cycle.

- [ ] Fetch latest `main` at cycle start and use an isolated workspace (keep the existing clone unless a worktree proves better). Keep the workspace and conversation ID for recoverable errors; verify the installed AGY CLI's continuation flags. Bound retries and stuck processes without wiping useful work.
- [ ] Require `pnpm research finish` to record justified cadence and a mandatory `HARNESS_FEEDBACK:` critique. Persist conversation logs, structured feedback, and diagnostics locally on South, never in Git.
- [ ] Validate data/schema/scoring, references, translation fidelity, source duplicates, and research-only changes. After concurrent developer pushes, reconcile **only** research data onto current `main`, rerun checks, and publish a fast-forward commit. Pause for real semantic conflicts; never silently overwrite a user's work or discard a failed cycle.
- [ ] Only a newly deployed public snapshot resets the countdown visible to readers. A successful Git push does not prove a successful Vercel deployment. If deployment fails, preserve and retry the **same publish**, rather than rerunning research or falsely reporting a fresh website.

**Done when:** Simulated provider failures, process crashes, and concurrent multi-machine pushes preserve work and cannot publish stale or invalid data.

**Notes / pivots:** _Existing runner has useful recovery code but may abandon a checkpoint when `main` changes; its Windows scheduled task currently has a two-hour execution limit. Preserve the protections while simplifying._

### 9. Prove reliability, then enable production only with permission

**Goal:** Demonstrate the new system end to end without gambling the public record.

- [ ] Test ingest + archive restore, historical reconstruction, all three research stages, supported locale copy, zero-change cycles, timing transitions, interrupted sessions, conflicting changes, and Vercel deployment effects.
- [ ] Run a nonpublishing supervised cycle first. Review evidence, runtime, feedback, and archive capacity; then a controlled publication.
- [ ] Obtain explicit operator approval **before** re-enabling South's scheduler. Keep this plan current by checking verified outcomes and replacing stale notes, not accumulating a changelog.

**Done when:** A fresh agent can finish the plan from repository state, and unattended production behavior is demonstrably safe.

**Notes / pivots:** _South stays disabled until approval._

## Decisions still open (do not silently invent)

- **Off-server backup:** Destination, frequency, retention, and restore objective. South-local copies alone are insufficient for decades of preservation.
- **Live status:** Whether to add real-time South-to-UI telemetry or use the deadline-driven “Running” display with a delayed/error fallback. A static build cannot prove South is running; do not equate a reached deadline with verified process health. Prefer no new service unless status accuracy warrants it.
- **Historical synthesis retrieval:** Git preserves every committed revision; decide whether a small dated synthesis index is needed for future agents to retrieve one day's published assessment without replaying Git history.
- **Archive pilot:** Choose the smallest extraction library that reliably produces article body text across real Khmer/Thai/international pages. Measure size and failure rate before hardcoding compression, retry, and capacity limits.
- **Timeline highlights:** Article confidence uses evidence-v2; timeline importance remains a different, historical-significance score. Reassess the highlight cutoff only after reviewing actual event density.

**How to proceed from a fresh session:** Read this plan, `AGENTS.md`, and current code/Git status; start with the first unchecked prerequisite; research uncertain facts before coding; test each deliverable; record short actionable notes under its stage. Do not treat provisional technical choices as fixed product requirements.

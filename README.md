# BorderClash - Thailand-Cambodia Border Conflict Monitor

Real-time intelligence dashboard tracking the Thailand-Cambodia border situation with multi-perspective news and AI-powered neutral analysis.

## Features

- 🌐 **Multilingual Support** - English, Thai (ไทย), Khmer (ខ្មែរ) translations
- 🔍 **Neutral AI Analysis** - Balanced perspective summaries, credibility scoring
- ⚔️ **Multi-Perspective** - Thailand, Cambodia, and International viewpoints
- 🤖 **Hierarchical AI System** - Scout → Analyst → Manager → Synthesis pipeline
- 🛡️ **Robust Automation** - Self-healing research cycles with retry logic and error isolation
- 🔎 **Web Search Integration** - AI agents actively search the web to verify claims

---

## Architecture

```mermaid
graph TB
    subgraph "RESEARCH CYCLE (every 15 min)"
        ORCH[Orchestrator]
        ORCH -->|step 1| S[SCOUTS (Parallel Workers)]
        ORCH -->|step 2| H[HISTORIAN LOOP]
        ORCH -->|step 3| SY[SYNTHESIS]
    end
    
    subgraph "HISTORIAN LOOP (until done)"
        PL[PLANNER] -->|picks 10-15 articles| HI[HISTORIAN]
        HI -->|creates/merges events| TL[(Timeline)]
        HI -->|more articles?| PL
    end
    
    subgraph "GHOST API (Custom)"
        W1[Worker 1 - fast]
        W2[Worker 2 - thinking]
        S -.-> W1
        PL -.-> W1
        HI -.-> W2
        SY -.-> W2
    end
    
    S --> DB[(Convex DB)]
    H --> DB
    SY --> DB
    DB --> FE[Frontend]
```

### AI Components

| Component | Model | Role |
|-----------|-------|------|
| **SCOUT** | Ghost fast | Find new articles (isolated per country) |
| **PLANNER** | Ghost fast | Select 10-15 most important articles from unprocessed pool |
| **HISTORIAN** | Ghost thinking | Process articles → create/merge timeline events, verify with source URLs |
| **DASHBOARD** | Ghost thinking | Update stats (casualties, displaced) with web verification |
| **SYNTHESIS** | Ghost thinking | Generate multilingual narratives for frontend |

### Timeline Historian Architecture (Two-Phase)

The **Timeline Historian** solves context window overflow by building a structured timeline of key events instead of re-processing all articles:

```
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE 1: PLANNER (fast model)                                       │
│  • Sees ALL unprocessed articles (up to 200)                         │
│  • Sees timeline context (100 recent events)                         │
│  • Picks 10-15 most important articles to process                    │
│  • Groups related articles for cross-validation                      │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │
                                    ▼ "These 12 articles about the border clash..."
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE 2: HISTORIAN (thinking model)                                 │
│  • Processes only the selected articles                              │
│  • VISITS source URLs to verify dates and details                    │
│  • Creates timeline events OR merges sources OR archives             │
│  • Marks all processed articles as `processedToTimeline: true`       │
└──────────────────────────────────────────────────────────────────────┘
```

**Historian Actions:**
| Action | Description |
|--------|-------------|
| `create_event` | Add new event to timeline (importance 0-100) with Thai/Khmer translations |
| `merge_source` | Add article as source to existing event |
| `update_event` | Modify existing event (title, description, date, importance, status) |
| `delete_event` | Remove completely fabricated events (use rarely!) |
| `archive` | Mark as processed but not timeline-worthy |
| `discard` | Mark as false/bad data |
| `flag_conflict` | Mark article as conflicting with timeline |

**Timeline Events Schema:**
- `date`, `timeOfDay` (estimated time like "08:00", "14:30" for chronological ordering)
- `title`, `titleTh`, `titleKh` (Thai/Khmer translations)
- `description`, `descriptionTh`, `descriptionKh`
- `category` (military/diplomatic/humanitarian/political)
- `importance` (0-100 - controls dot size on frontend: 6px-40px)
- `status` (confirmed/disputed/debunked)
- `sources[]` - Array of contributing articles with credibility

**Chronological Ordering:**
Timeline events are automatically sorted by `date` + `timeOfDay` (oldest first) when passed to AI prompts. This ensures the AI receives events in proper historical order. Events without a `timeOfDay` are sorted to the end of their respective day.

### Robustness & Concurrency
- **Ghost API Workers**: Uses a custom `WorkerPool` where each worker has a unique browser profile to prevent lock conflicts.
- **Error Isolation**: Each step of the research cycle is isolated. A failure in one does not stop the others.
- **Retry Logic**: All API calls include automatic retries with backoff strategies.
- **Stall Detection**: Validation loop stops if progress stalls for 4 consecutive iterations.
- **Model Escalation**: If fast model fails to produce valid JSON, automatically escalates to thinking model.
- **JSON Reliability**: Uses `<json>` tag delimiters for reliable extraction (model can think before/after tags).
- **Web Search Hints**: All prompts explicitly encourage using web search to verify claims.

---

## Database Schema

### News Tables
`thailandNews`, `cambodiaNews`, `internationalNews`
- Stores articles with `active`, `outdated`, `unverified`, `false`, or `archived` status.
- Includes multilingual titles and summaries.
- Validation fields: `lastReviewedAt`, `hasConflict`, `nextReviewAt`.
- Timeline field: `processedToTimeline` (boolean) - tracks if Historian has processed this article.

### Timeline Events
`timelineEvents`
- Structured historical record of key conflict events.
- Fields: `date`, `timeOfDay`, `title`, `description`, `category`, `importance` (0-100), `status`.
- `timeOfDay` is an estimated time string ("08:00", "14:30", "22:00") for ordering same-day events.
- `sources[]` array tracks which articles contributed to this event.
- Status: `confirmed` | `disputed` | `debunked`.

### Dashboard Stats
`dashboardStats`
- Live metrics for **Displaced**, **Casualties**, **Injuries**, and **Conflict Level**.
- Updated independently from the synthesis narrative.

### System Stats
`systemStats`
- Tracks `systemStatus` ('online', 'syncing', 'error').
- Controls the `isPaused` state for administrative override.

### Validation State
`validationState`
- Tracks validation loop progress (`currentLoop`, `completionPercent`, `isRunning`).

### Analysis Data Model (Synthesis)
The system synthesizes data into `cambodiaAnalysis`, `thailandAnalysis`, and `neutralAnalysis` tables:

| Field | Description |
|-------|-------------|
| **Official Narrative** | The core story each side is telling its people. |
| **Military Posture** | Evaluated state: `PEACEFUL` (0-30), `DEFENSIVE` (31-65), `AGGRESSIVE` (66-100). |
| **Posture Label** | A dense tag describing action + location (e.g., "Cross-Border Airstrikes"). |
| **Posture Rationale** | **The "Analysis" Text:** A detailed tactical explanation citing specific weapons, units, or moves (e.g., "Utilizing BM-21 rockets..."). |
| **Confidence** | (0-100%) AI's certainty based on source corroboration. |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + Tailwind CSS |
| Backend | Convex |
| AI | **Ghost API** (Custom Playwright + Gemini 2.0 Flash) |

### Environment Variables

```bash
# Convex
npx convex env set GHOST_API_URL "https://your-ghost-api.koyeb.app"
```

---

## Quick Start

```bash
npm install
npx convex dev
npm run dev
```

### Administrative Commands

**Control the Research Timer:**
```bash
# Pause the automation (stops timer, aborts new cycles)
npx convex run api:pauseTimer

# Resume the automation
npx convex run api:resumeTimer
```

**Manual Triggers:**
```bash
# Run one full research cycle immediately
npx convex run api:runFullCycle

# Run the Historian (builds timeline from unprocessed articles)
npx convex run api:runHistorian

# Run ONLY the validation loop (Analyst → Manager)
npx convex run validation:runValidationLoop

# Reset all articles to unverified (re-run validation from scratch)
npx convex run api:resetAllValidation

# Clear all data (Delete everything)
npx convex run api:clearAllData
```

**Timeline Utilities:**
```bash
# Export all timeline events (for manual review)
npx convex run api:exportTimelineEvents

# Clear all timeOfDay values (reset for manual re-entry)
npx convex run api:clearTimeOfDay
```

---

## File Structure

```
convex/
├── schema.ts       # Database schema (multilingual fields, timeline)
├── api.ts          # Queries & mutations (public + admin)
├── research.ts     # Core logic: Scouts, Synthesizer, Dashboard
├── historian.ts    # Timeline Historian (Planner + Historian AI)
├── validation.ts   # Validation loop logic
└── crons.ts        # Scheduled jobs (Research Cycle)

src/app/
├── page.tsx        # Frontend dashboard
```

## UI Behavior

- **Timer**: Displays a 15-minute countdown between cycles.
- **Status**:
  - `RUNNING...` (Pulsing): Research cycle is active.
  - `PAUSED` (Yellow): Administratively paused.
  - `ONLINE`: Idle, waiting for next cycle.
- **Non-blocking Updates**: Cards refresh quietly in background. The Neutral AI card does not block content during updates.

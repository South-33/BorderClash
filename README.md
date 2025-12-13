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
        ORCH -->|step 2| V[VALIDATION LOOP]
        ORCH -->|step 3| D[DASHBOARD UPDATER]
        ORCH -->|step 4| SY[SYNTHESIS]
    end
    
    subgraph "VALIDATION LOOP (3-Step Orchestrator)"
        MP[1. MANAGER PLANNING] -->|assigns task| A[2. ANALYST EXECUTING]
        A -->|returns findings| MF[3. MANAGER FINALIZING]
        MF -->|nextTask| MP
        MF -->|final decisions| DB2[(Database)]
    end
    
    subgraph "GHOST API (Custom)"
        W1[Worker 1 - fast]
        W2[Worker 2 - thinking]
        S -.-> W1
        A -.-> W1
        MP -.-> W2
        MF -.-> W2
    end
    
    S --> DB[(Convex DB)]
    V --> DB
    D --> DB
    SY --> DB
    DB --> FE[Frontend]
```

### AI Components

| Component | Model | Role |
|-----------|-------|------|
| **SCOUT** | Ghost fast | Find new articles (isolated per country) |
| **MANAGER (Planning)** | Ghost thinking | Decide what task to assign to Analyst |
| **ANALYST** | Ghost fast | Execute assigned task, report findings (natural language) |
| **MANAGER (Finalizing)** | Ghost thinking | Review findings, make final decisions, plan next task |
| **DASHBOARD** | Ghost thinking | Update stats (casualties, displaced) with web verification |
| **SYNTHESIS** | Ghost thinking | Generate multilingual narratives for frontend |

### Validation Loop Architecture (3-Step Orchestrator)

The validation loop uses a **Manager-orchestrated** pattern where the thinking model controls what the fast model does:

```
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 1: MANAGER PLANNING (thinking model)                           │
│  • Looks at DB stats (unverified count, conflicts, etc.)             │
│  • Decides what the Analyst should focus on                          │
│  • Outputs: taskType, taskDescription, focusAreas, articlesToCheck   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼ "Check these articles for propaganda..."
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 2: ANALYST EXECUTING (fast model)                              │
│  • Receives the specific task from Manager                           │
│  • Analyzes articles according to instructions                       │
│  • Uses WEB SEARCH to verify claims before accepting                 │
│  • Returns findings (free-form text, not decisions)                  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼ "Article X has red flags, Y looks okay..."
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 3: MANAGER FINALIZING (thinking model)                         │
│  • Reviews Analyst's findings                                        │
│  • Makes FINAL decisions (agree/modify/override Analyst)             │
│  • Outputs: finalActions (DB changes) + nextTask (for next loop)     │
│  └→ nextTask becomes the task for STEP 1 in next iteration          │
└──────────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- Manager **controls** what the Analyst works on (true delegation)
- Analyst is a "worker bee" that executes specific tasks
- Manager sees Analyst's reasoning before making final calls
- Continuous loop: nextTask feeds back into next iteration

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
- Stores articles with `active`, `outdated`, `unverified`, or `false` status.
- Includes multilingual titles and summaries.
- Validation fields: `lastReviewedAt`, `hasConflict`, `nextReviewAt`.

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

# Run ONLY the validation loop (Analyst → Manager)
npx convex run validation:runValidationLoop

# Reset all articles to unverified (re-run validation from scratch)
npx convex run api:resetAllValidation

# Clear all data (Delete everything)
npx convex run api:clearAllData
```

---

## File Structure

```
convex/
├── schema.ts       # Database schema (multilingual fields)
├── api.ts          # Queries & mutations (public + admin)
├── research.ts     # Core logic: Scouts, Synthesizer, Dashboard
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

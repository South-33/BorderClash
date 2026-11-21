# BorderClash research-quality hill climb

## Goal

Make routine BorderClash research produce a clear, fair, useful public picture for ordinary civilians without sacrificing evidence discipline or publication safety.

The system should be simple: one operating brief, one research agent, one structured finish decision, objective validation, and safe publication. Editorial judgment stays with the agent where it cannot be faithfully reduced to deterministic checks.

The hill climb covers the entire research loop, not only synthesis or current-page prose: source discovery and coverage, source diversity, ingestion and canonical identity, capture/retention, evidence scoring and attribution, event selection and deduplication, dates/times, timeline construction, current impact/country/activity/synthesis fields, multilingual fidelity, cadence, diagnostics, runner behavior, validation, and publication. Improve whichever layer the observed evidence says is limiting quality.

Do not optimize for churn, fixed length, fixed update counts, or passing prose snapshots. A researched no-change cycle is valid. Git preserves history; current public copy should represent the best current judgment.

## Working method

- Change one coherent behavior at a time where practical.
- Do not make UI changes without explicit user approval. Treat layout, CSS, typography, component structure, animation, interactions, and static UI copy as fixed; canonical research data and public editorial content may still change when evidence or reader value warrants it.
- Use current BorderClash records and evidence for evaluation, not invented toy prose when real material is available.
- Use small isolated model evaluations instead of full production cycles when the question is wording, selection, translation, or prompt behavior.
- Compare alternatives against the same inputs. Keep changes only when they improve reader value without weakening attribution, uncertainty, or factual fidelity.
- After real cycles, inspect the full trace for concrete friction or missed value across discovery, sources, evidence, records, timeline, current fields, localization, finish/cadence, validation, and delivery. Fix the narrowest responsible layer rather than assuming every problem belongs in synthesis prose.
- Treat model/judge scores as evidence, never as publication gates.
- Keep hard failures for objective state, data, and publication invariants. Keep heuristics as warnings or review aids.
- Do not restart a full historical audit. Reopen old records only for a concrete reason.

## 1. Restore trustworthy harness behavior

- [x] Repair the reader-copy benchmark so it uses `research/CYCLE_GUIDE.md` instead of the removed `AGENTS.md` editorial section.
- [x] Remove the obsolete bare `finish` help entry.
- [x] Disable Next.js automatic `AGENTS.md` mutation in development.
- [x] Make `.work/research-finish.json` the authoritative completion/review decision. Final-response markers may be logged but must not veto otherwise valid structured completion.
- [x] Remove the routine production custom-prompt bypass if no real caller depends on it; keep experiments in explicit development/evaluation paths.
- [x] Remove dead prompt-prose helpers/tests that freeze wording instead of behavior.
- [x] Keep the existing automation watchdog unchanged unless a reproducible failure proves a production defect.

Acceptance: `pnpm test`, `pnpm validate`, and `pnpm test:automation` pass; benchmark starts successfully with the canonical guide.

## 2. Put validation on the right side of the judgment boundary

- [x] Keep structural hard failures: schema/shape, IDs, canonical URL identity, evidence references, valid dates/times/enums/ranges, required language fields, script/mojibake integrity, runner-owned state, allowed paths, publication reconciliation, and delivery verification.
- [x] Demote free-text numeric-token parity from publication blocker to diagnostic warning/review signal.
- [x] Demote Thai/Khmer tone/partisan-word regexes from publication blocker to diagnostic warning/review signal.
- [x] Remove the hard failure for `titleEn === title`.
- [x] Review other source-code/prompt regex tests while touching their code; prefer behavioral tests over exact implementation text.

Acceptance: known false positives no longer block; objective corruption and referential errors still fail.

## 3. Resolve evidence-score semantics without a bulk rescore

- [x] Define one meaning for article `credibility`: how strongly the retained evidence supports the stored report as actually worded, including its attribution boundary.
- [x] Align `CYCLE_GUIDE.md`, `research/lib/evidence-score.mjs`, fixed cases, and validators with that meaning. Static UI wording is outside this research task and remains unchanged without explicit approval.
- [x] Make clear that a primary source can strongly establish that an actor made a statement without proving the actor's disputed allegation true.
- [x] Remove contradictory blanket handling of attributed opponent claims.
- [x] Keep evidence-score semantics authoritative in the research contract and evaluator rather than changing static UI copy as part of this task.
- [x] Do not rescore the archive wholesale. Revisit existing records only when a concrete current use or obvious inconsistency warrants it.

Acceptance: the same attributed report receives the same conceptual treatment in the guide, library, fixture evaluator, and validator without requiring a UI change.

## 4. Clarify editorial roles and simplify the operating brief

- [x] Keep `research/CYCLE_GUIDE.md` as the single durable research contract and keep it compact.
- [x] Define field roles: overall synthesis = shared current picture; key updates = material recent/imminent changes; country summaries = each side's current position/material claims; activity fields = supported physical military posture; timeline = reconstructable history.
- [x] Tell the agent to verify rigorously but not narrate its audit process in public prose.
- [x] Prefer ordinary language; keep loaded labels explicitly attributed; draft English/Thai/Khmer from the same facts rather than translating clauses literally.
- [x] Preserve permission to leave good copy unchanged, while permitting quiet-day edits for error, stale emphasis, jargon, repetition, or poor language.
- [x] Keep dynamic context free of previous synthesis/reasoning. Label recent anchors as orientation, not importance or scope.
- [x] Normalize displayed context dates to border-local time where appropriate and remove/rename counts that imply more than they measure.

Acceptance: one brief remains the production contract, stays compact, and contains no previous synthesis or hidden editorial quota.

## 5. Build a small real-data editorial evaluation loop

- [x] Repair and extend the optional reader-copy benchmark with representative real BorderClash material covering synthesis selection, timeline prose, attribution, and EN/TH/KH parity.
- [x] Add an explicit A/B evaluation mode for candidate guide/prompt variants without changing production data.
- [x] Use the production-qualified model for candidate generation when available; keep judge output advisory and inspect the actual prose.
- [x] Compare at least the current guide against the proposed guide on the same real inputs.
- [x] Record concise evaluation results under `.work/`, not canonical data.

Acceptance: chosen guidance wins on real examples for clarity/selection/naturalness while preserving material facts, attribution, and uncertainty.

## 6. Repair the current public picture once the system is improved

- [x] Re-open supporting evidence for the current synthesis, country summaries, and recent visible timeline records before editing them.
- [x] Remove duplicated roles, low-value precision, institutional alphabet soup, verification-memo tails, and unattributed loaded framing.
- [x] Correct material Thai/Khmer semantic drift in the current public copy.
- [x] Let key-update count be dynamic, including zero.
- [x] Keep lower-value supported facts in timeline/evidence rather than forcing them into the current overview.
- [x] Inspect the real dashboard at 1440x900 in English, Thai, and Khmer, plus a mobile viewport. No UI change is part of this work. The military activity label is a looping banner, so transient edge clipping during motion is expected and should not trigger UI or content changes by itself.

Acceptance: all three languages fit/read materially better, with no loss of important attribution or uncertainty; validation and tests remain green.

## 7. Retire completed historical-audit orchestration separately

- [x] Preserve useful capabilities first: `show`, `captured`, capture/archive/reconstruct, reference checks, targeted chronology/time/humanitarian diagnostics, and generic correction verification.
- [x] Remove or archive full-audit queue progression, worktree claims, risk queues, batch triage/review orchestration, stale packet refresh, and other machinery that exists only to continue the completed sweep.
- [x] Preserve final audit artifacts as operator history outside routine production inputs.
- [x] Keep old records editable and targeted diagnostics available without recreating a perpetual audit backlog.

Acceptance: routine research CLI/runtime no longer carries bulk-audit workflow complexity, while targeted correction/evidence work remains straightforward.

## Finish

- [x] Run all normal and automation verification (`pnpm test`, `pnpm validate`, `pnpm test:automation`, and `pnpm build` passed).
- [x] Run the repaired editorial benchmark/evaluation suite and inspect its outputs manually.
- [x] Confirm production runner still has one canonical brief and safe publication/recovery behavior.
- [x] Confirm no full-cycle production publication was required merely to test editorial behavior.
- [x] Update this plan so completed items reflect observed results, then leave only concrete follow-up work that genuinely remains.

## Verification ledger (2026-11-21)

- `pnpm test`: 126 passed. `pnpm validate`: 582 timeline events, 3,337 articles, zero warnings. `pnpm build`: succeeded.
- `pnpm test:automation`: passed all run-cycle sections, including structured completion, restart/recovery, operator review, and publication reconciliation.
- Current-copy A/B reports in `.work/benchmarks/current-copy/` support the field-role guidance in both candidate orderings. The live guide keeps that role split without fixed word or update counts.
- Reader-copy qualification is advisory. A one-pass production-model sample reached 8.5/10 fidelity but exposed one cross-script error and a few translation-category mistakes. A same-model repair pass removed hard issues and raised fidelity to 9.5/10, but took about 186 seconds / 47.8k candidate tokens and reduced Thai/Khmer naturalness to 6.5/10. That tradeoff does not justify a second production model stage.
- Current summaries and five recent timeline entries were shortened after evidence review. At 1440x900 the full page and center card have 0 px overflow in English, Thai, and Khmer; the Khmer whole-page check also shows no country-card overflow. The 390x844 mobile view has 0 horizontal overflow and no hidden center-card content.
- Bulk historical-audit queue/orchestration removed from working tree; `show`, `captured`, archive/restore/reconstruct, targeted diagnostics, and correction verification remain. New record/capture helpers are test-covered.
- No full production research cycle or historical bulk rescore was run for these editorial tests.
- The optional reader-copy benchmark remains advisory; use its failures to find general fidelity problems, not as a publication gate or a reason to encode fixture-specific prose rules.

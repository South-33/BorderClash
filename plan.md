# BorderClash research-harness refinement

## Goal

Build a model-agnostic research harness that gives the research agent a clear objective, strong evidence/editorial criteria, useful live orientation, and a small set of intuitive deterministic tools while preserving broad freedom over how to investigate and revise the record.

Quality comes first. Efficiency matters when it removes mechanical work, duplicated context, needless tool discovery, or repeated failure recovery without narrowing research judgment.

The target is not a workflow engine. The model should choose what to research, how deeply to pursue it, which evidence matters, what the evidence means, how the canonical record should change, and when further work has low expected value. Deterministic code should make objective operations reliable and explain objective failures precisely.

## Design principles

- Optimize the whole agent input surface: bootstrap prompt, stable guide, live context, tool descriptions, tool results, validation errors, and the canonical data the model opens on demand.
- Prefer progressive disclosure. Put durable research judgment in the guide, live orientation in cycle context, tool syntax in tool help, mechanical contracts in code/validation, and provider/runtime quirks in the runner.
- Give each concept one authoritative owner. Remove duplicated instructions unless repetition protects a real safety boundary.
- Express success criteria and information-value tradeoffs rather than fixed search counts, source quotas, rewrite counts, or prescribed tool sequences.
- Keep editorial and evidentiary judgment with the model. Hard checks protect objective invariants; heuristics remain advisory.
- Prefer a few capability-oriented tools with obvious verbs over many implementation-oriented commands.
- Make exploration read-only by default and mutation explicit.
- A normal tool should explain what it did, why, what remains model judgment, and the useful next action. Normal misuse should not require reading implementation source.
- Do not accumulate prompt scars for one model's behavior. Fix the narrowest general layer: tool UX, context, adapter/runtime, validator diagnostics, or stable guidance.
- Judge changes with real traces and real BorderClash material. Benchmarks inform decisions; they do not become publication gates.

## 1. Refine the agent input surface

- [x] Preserve `research/CYCLE_GUIDE.md` as the durable research contract; benchmark candidate rewrites before removing editorial/evidence detail, and keep detail that demonstrably improves fidelity or judgment.
- [x] Add an information-value principle: pursue work while it can materially improve accuracy, confidence, attribution, context, or reader understanding; stop when remaining uncertainty is understood and further available work has low expected value.
- [x] Remove routine CLI syntax and provider/sandbox implementation details from the stable guide without deleting domain guidance that still improves model fidelity.
- [x] Reduce the runner bootstrap prompt to locating the stable guide, live context, and discoverable research tools. Do not name individual routine tools there.
- [x] Keep provider-specific quirks in runner/adapters rather than the research contract.

Acceptance: a capable model can explain the research goal, judgment boundary, and finish condition after reading the guide without learning a prescribed research sequence.

## 2. Improve live cycle orientation

- [x] Keep `.work/CYCLE_CONTEXT.md` compact and explicitly label it orientation rather than scope or authority.
- [x] Include the previous cycle's cadence reason so the new cycle can test the last researcher's expectation.
- [x] Include the current English synthesis and compact key updates as revisable working memory, avoiding unnecessary multilingual duplication.
- [x] Preserve recent timeline/evidence anchors without implying source quotas or importance rankings.
- [x] Keep enough canonical path guidance to prevent predictable filename guessing.

Acceptance: the agent can orient to the current situation and previous intent without immediately opening predictable files, while remaining free to investigate older or broader material.

## 3. Simplify the routine tool surface

- [x] Introduce capability-oriented routine verbs around four intents: `source`, `record`, `review`, and `finish`.
- [x] `source`: inspect a URL read-only by default; resolve identity/metadata/capture/existing matches; make retention an explicit mutation and leave semantic fields to model judgment.
- [x] `record`: inspect a canonical record with resolved evidence/backlinks and optionally retained publisher text; absorb normal `show`/`captured` discovery.
- [x] `review`: inspect changed work or one record, run relevant objective/advisory diagnostics, clearly separate blockers from review signals, and avoid imposing editorial answers.
- [x] `finish`: remain the explicit research completion/cadence decision and local objective validation boundary.
- [x] Keep archive/recovery and narrow diagnostic primitives available under advanced help rather than the routine mental model.
- [x] Preserve compatible internal primitives where they are useful; do not rewrite working internals merely to rename them.

Acceptance: routine `--help` fits on one screen and describes researcher intent, while advanced maintenance remains discoverable.

## 4. Make tools self-describing

- [x] Add command-specific help for routine tools, including mutation/read-only behavior, required model judgments, examples, and result semantics.
- [x] Standardize routine outputs around outcome, reason, remaining judgment, and next action where they materially help the next model decision.
- [x] Improve ambiguous/review outcomes so no canonical mutation occurs and the output explains how to resolve the ambiguity.
- [x] Improve objective validation errors with precise locations and actionable details; in particular, report unexpected script characters/code points instead of only `wrong-script`.
- [x] Keep auto-fix limited to lossless mechanical facts; never auto-translate or resolve semantic/editorial uncertainty.

Acceptance: normal use and normal recovery do not require opening CLI/library source code.

## 5. Remove redundant deterministic paths

- [x] Audit routine and correction verification for duplicated objective reference checks and give each invariant one canonical validator owner.
- [x] Keep repeated validation at distinct trust boundaries (agent finish, trusted runner, publication candidate) where the state or trust assumption changes.
- [x] Keep runner-only primitives such as the hidden generic `check` command out of routine help while retaining them where the trusted runner still needs them.
- [x] Keep advisory chronology/time/humanitarian signals advisory; do not convert them into publication gates.

Acceptance: fewer ways to ask the same deterministic question, with no reduction in publication safety.

## 6. Evaluate before and after

- [x] Run small same-input A/B model evaluations of the current and proposed research guide on real BorderClash data.
- [x] Prefer consistent gains or neutral quality with clearer/shorter input over one-off judge wins.
- [x] Inspect actual candidate text and traces, not only aggregate scores.
- [ ] After the routine interface is coherent, run one isolated full research cycle without publication and inspect its trace for tool discovery, source handling, unnecessary source-code inspection, validation recovery, research depth, and finish judgment.
- [ ] Ask the model for concise harness feedback at cycle end, but treat that feedback as evidence rather than instructions.
- [ ] Make only generalizable follow-up fixes; do not chase every model mistake.

Acceptance: the new surface preserves or improves research quality while reducing avoidable harness navigation and implementation leakage in a real shadow cycle.

## Boundaries

- No UI redesign.
- No bulk historical audit or archive rescore.
- No production publication merely to evaluate the harness.
- No deterministic source-count/search-count/tool-order/editorial gates.
- No model-specific prompt rule unless the behavior is a true domain requirement shared by future models.
- Stop the hill climb when remaining issues are predominantly editorial/model variance rather than harness friction with a general solution.

## Verification

- [x] `pnpm test` — 136/136 pass.
- [x] `pnpm validate` — 585 timeline events / 3,345 articles / 0 warnings.
- [x] `pnpm test:automation` — all runner/recovery/publication sections pass on a frozen tree.
- [x] Advisory model benchmark reports retained under `.work/`.
- [ ] One non-publishing shadow-cycle report reviewed before declaring the new harness surface complete.

## Evaluation notes

- Three same-input guide candidates were compared with the existing production guide using the production model on real BorderClash current-state material. Every more aggressive rewrite lost meaningful quality; some samples introduced fatal attribution or factual errors. The production change therefore preserves the strong editorial/evidence contract and only removes measured operational duplication while adding the general information-value stopping principle.
- Routine help is now one-screen and intent-oriented. Compatibility commands, narrow diagnostics, and archive recovery remain available under advanced help rather than disappearing from the system.
- Live context now carries the previous cadence reason and current English working picture, explicitly labeled revisable orientation rather than scope or authority.
- Objective validation now reports exact cross-script characters/code points and owns canonical current-source URL membership. Correction verification no longer repeats a separate reference-check subprocess.
- One non-publishing supervised model cycle remains. Its trace, not more speculative design, will decide whether any further harness change is justified.

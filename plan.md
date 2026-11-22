# Project plan

This file is reusable working memory for substantial repository changes. It should describe the current plan, not preserve completed task history.

Use it when the work has several dependent steps, meaningful design choices, risky migrations, or acceptance criteria that are easy to lose across turns. Small fixes do not need a plan.

## How to use this file

- Start with the user-visible goal. Describe the outcome, not the implementation.
- State the quality order when tradeoffs matter, for example correctness before efficiency or compatibility before cleanup.
- Record only constraints that materially affect decisions. Do not duplicate `AGENTS.md`, stable product contracts, or command help.
- Break the work into a small number of coherent workstreams. Each workstream should have checkboxes and one explicit acceptance statement.
- Keep checkboxes truthful. Rewrite or remove obsolete steps when the plan changes; do not preserve abandoned work for history.
- Put non-goals and scope limits under **Boundaries** so they do not get confused with unfinished work.
- Put objective commands and observable checks under **Verification**. Do not use vague entries such as "test everything."
- Use **Evaluation notes** only for evidence that changed a decision, exposed a real risk, or explains why an apparently obvious alternative was rejected.
- Prefer measured evidence over intuition for consequential choices. Use traces, tests, benchmarks, real data, or direct product behavior when available.
- Do not turn model behavior, editorial judgment, or heuristic quality into deterministic pass/fail gates unless the requirement is objectively testable.
- Stop adding complexity when the remaining problems are mostly judgment variance or low-value edge cases without a clear general solution.
- Commit only coherent checkpoints. The plan can span several commits, but it should always describe the current intended end state.

When the plan is complete, verify the acceptance criteria, remove task-specific history, and return this file to a reusable template rather than leaving a finished checklist behind.

---

## Active plan

### Goal

> Replace this block with the concrete user-visible outcome.

Explain:

- what should be true when the work is finished;
- the important quality or priority order;
- what judgment remains flexible;
- what the plan deliberately does not try to optimize.

### Principles and constraints

- Replace with the few design rules that materially shape this task.
- Prefer one authoritative owner for each concept or invariant.
- Prefer the simplest complete solution; add machinery only for a measurable gain.
- Preserve existing product behavior unless the goal explicitly changes it.

## 1. First workstream

- [ ] Describe a concrete action or decision.
- [ ] Keep related work together instead of splitting by file or implementation detail.
- [ ] Add investigation steps only when they answer a real decision.

Acceptance: state the observable condition that proves this workstream is good enough.

## 2. Second workstream

- [ ] Replace with the next coherent part of the work.
- [ ] Include migration, compatibility, or cleanup work here when it is part of the same decision.

Acceptance: state what must be true before moving on.

## 3. Final integration

- [ ] Reconcile interactions between earlier workstreams.
- [ ] Remove obsolete code, data, prompts, docs, or compatibility paths that no longer have an owner.
- [ ] Re-read the result from the user, operator, and agent perspectives where relevant.

Acceptance: the repository reaches the intended end state without hidden parallel paths or unresolved ownership.

## Boundaries

- Replace with explicit non-goals and scope limits for the current task.
- Keep these narrow. A boundary should prevent real scope drift, not forbid useful judgment.

## Verification

- [ ] Run the smallest objective checks that cover the changed behavior.
- [ ] Run broader repository validation when the change crosses shared contracts or publication boundaries.
- [ ] Inspect important outputs or traces directly when tests cannot prove quality.
- [ ] Confirm the working tree and remote state are what the task expects before declaring completion.

## Evaluation notes

Keep this section short and current.

- Record evidence that changed the plan or justified keeping/rejecting an alternative.
- Record important residual uncertainty that affects future decisions.
- Delete notes once they are obvious from the final code, docs, or tests.

# Project plan

This file is reusable working memory for substantial repository changes. A plan is a current hypothesis about the best path to the goal, not a contract to follow after evidence says the shape is wrong.

Use it when the work has several dependent steps, meaningful design choices, risky migrations, or acceptance criteria that are easy to lose across turns. Small fixes do not need a plan.

## How to use this file

- Start with the user-visible goal. Describe what should become true, not the implementation you currently expect.
- State the quality order when tradeoffs matter, for example correctness before efficiency or compatibility before cleanup.
- Treat each workstream as an exploration with a preferred current shape. Investigate enough to confirm, refine, replace, split, merge, or delete that shape.
- Do not execute a checkbox merely because it was written earlier. If evidence points to a better route, update the plan first and take the better route.
- Keep reasoning concise and decision-oriented: what we currently believe, why, what could invalidate it, and what evidence changed the decision.
- Record only constraints that materially affect decisions. Do not duplicate `AGENTS.md`, stable product contracts, or command help.
- Give each workstream one observable acceptance condition. A workstream is complete when its goal is satisfied, even if the implementation differs from the original idea.
- Keep checkboxes truthful. Rewrite or remove obsolete steps instead of preserving abandoned work for history.
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

Explain briefly:

- what should be true when the work is finished;
- the important quality or priority order;
- what judgment remains flexible;
- what the work deliberately does not optimize.

### Principles and constraints

- Replace with the few rules that materially shape this task.
- Prefer one authoritative owner for each concept or invariant.
- Prefer the simplest complete solution; add machinery only for a measurable gain.
- Preserve existing product behavior unless the goal explicitly changes it.

## 1. First workstream

**Outcome:** What this section must achieve for the larger goal.

**Current hypothesis:** The best shape we see before deeper implementation or investigation.

**Reasoning and unknowns:** Why this shape looks promising, what assumptions it depends on, and what alternatives or risks should be checked before committing to it.

- [ ] Investigate the questions that can change the shape.
- [ ] Implement the simplest shape supported by the evidence.
- [ ] Update this section if implementation reveals a better route.
- [ ] Remove obsolete paths introduced by an earlier hypothesis.

**Acceptance:** State the observable condition that proves this workstream achieves its outcome.

## 2. Second workstream

**Outcome:** Define the result this section contributes to the overall goal.

**Current hypothesis:** Describe the expected approach without treating it as fixed.

**Reasoning and unknowns:** Record the important tradeoffs, dependencies, and evidence still needed.

- [ ] Explore the consequential uncertainties.
- [ ] Choose or revise the shape based on what is learned.
- [ ] Implement and integrate the chosen shape.
- [ ] Reconcile any assumptions inherited from earlier workstreams.

**Acceptance:** State what must be true before this workstream is considered complete.

## 3. Final integration

**Outcome:** Make the repository behave as one coherent system after the earlier work.

**Current hypothesis:** Describe the expected integration/cleanup shape.

**Reasoning and unknowns:** Identify cross-workstream interactions that could invalidate local decisions or leave duplicate ownership.

- [ ] Reconcile interactions between earlier workstreams.
- [ ] Re-evaluate earlier decisions that no longer fit the whole system.
- [ ] Remove obsolete code, data, prompts, docs, or compatibility paths that no longer have an owner.
- [ ] Re-read the result from the user, operator, and agent perspectives where relevant.

**Acceptance:** The repository reaches the intended end state without hidden parallel paths, stale assumptions, or unresolved ownership.

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

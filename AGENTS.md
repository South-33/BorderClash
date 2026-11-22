This is the project's AGENTS.md

# BorderClash

BorderClash maintains the canonical `data/` behind the public Thailand-Cambodia border dashboard.

The production research-agent contract lives in `research/CYCLE_GUIDE.md`. `node research/cli.mjs context` generates the live `.work/CYCLE_CONTEXT.md` snapshot for a cycle. The runner tells the agent to read both files, so stable policy does not compete with live context for one file-read budget. Keep research goals and editorial rules in the guide instead of duplicating them across runner prompts, tests, or this file.

Canonical inputs live in `data/`; `public/data/` is generated. The existing UI is the product contract unless the task explicitly changes it.

The user explicitly approved trailing-plus formatting for qualified impact-card totals (`20,000+`, `150+`). Keep canonical `MORE_THAN` / `AT_LEAST` semantics in data, but preserve the compact `N+` presentation unless the user requests another format.

South host maintenance, networking, drivers, power policy, and recovery belong in the sibling `SouthServer` repository. Real production research cycles run through the owned runner on South Server; development and fake-agent tests can run elsewhere.

Prefer the simplest reliable implementation. Tests and validators should protect objective behavior and data contracts, not freeze prose or prior research judgments. Remove obsolete machinery instead of preserving it for history.

For substantial multi-step repository work, use `plan.md` as living working memory. Treat its workstreams as hypotheses to test and reshape around the goal, not instructions to follow after evidence points to a better design. Keep reasoning, acceptance criteria, boundaries, verification, and decision-changing evidence current, then reset it to the reusable template when the work is complete.

Do not encode model search depth, tool sequence, rewrite count, source count, prompt wording, translation naturalness, or editorial judgment as deterministic pass/fail tests. Evaluate those with real-cycle traces and advisory benchmarks; deterministic checks are for objective invariants only.

For repository development or harness changes, verify with `pnpm test` and `pnpm validate` as appropriate. A live research cycle should not run development verification commands merely for reassurance: `finish` validates the working canonical data and the trusted runner performs the later verification boundaries. For research CLI behavior, use `node research/cli.mjs --help`.

When developing or debugging the research harness, inspect `.work/runner/history/INDEX.md` and the selected cycle's `report.md`/`report.json` before raw logs. Isolated live-cycle workspaces do not carry runner history, and routine research should not seek it unless a concrete harness problem requires diagnosis.

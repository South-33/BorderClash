This is the project's AGENTS.md

# BorderClash

BorderClash maintains the canonical `data/` behind the public Thailand-Cambodia border dashboard.

The production research-agent contract lives in `research/CYCLE_GUIDE.md`. `node research/cli.mjs context` embeds that guide with live cycle state into `.work/CYCLE_CONTEXT.md`, which is the single runtime brief for a research cycle. Keep research goals and editorial rules there instead of duplicating them across runner prompts, tests, or this file.

Canonical inputs live in `data/`; `public/data/` is generated. The existing UI is the product contract unless the task explicitly changes it.

The user explicitly approved trailing-plus formatting for qualified impact-card totals (`20,000+`, `150+`). Keep canonical `MORE_THAN` / `AT_LEAST` semantics in data, but preserve the compact `N+` presentation unless the user requests another format.

South host maintenance, networking, drivers, power policy, and recovery belong in the sibling `SouthServer` repository. Real production research cycles run through the owned runner on South Server; development and fake-agent tests can run elsewhere.

Prefer the simplest reliable implementation. Tests and validators should protect objective behavior and data contracts, not freeze prose or prior research judgments. Remove obsolete machinery instead of preserving it for history.

Do not encode model search depth, tool sequence, rewrite count, source count, prompt wording, translation naturalness, or editorial judgment as deterministic pass/fail tests. Evaluate those with real-cycle traces and advisory benchmarks; deterministic checks are for objective invariants only.

Use `pnpm test` and `pnpm validate` for repository verification. For research CLI behavior, use `node research/cli.mjs --help`.

When diagnosing past research behavior, inspect `.work/runner/history/INDEX.md` and the selected cycle's `report.md`/`report.json` before raw logs; those reports link conversation attempts, harness feedback, changed data, and publication state.

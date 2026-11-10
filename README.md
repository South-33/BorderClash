# BorderClash

BorderClash is an automated public monitor of the Thailand-Cambodia border situation. It compares Cambodian, Thai, and international reporting, keeps a sourced timeline, and maintains a concise current picture for ordinary readers.

The research is AI-assisted. It can be incomplete or wrong, so the site keeps source links and distinguishes reported claims from established facts.

## How it works

1. A scheduled research cycle checks what changed in Cambodian, Thai, and international/regional reporting.
2. Material findings are verified and written to the tracked research data in `data/`.
3. Deterministic validation checks data format, source links, localization, and other mechanical rules.
4. Validated changes are committed to `main`. The static site is generated from that record and deployed automatically.

A cycle can also conclude that nothing material changed. The record is meant to stay accurate and useful, not grow for its own sake.

## Repository map

- `src/`: the Next.js website.
- `data/`: the research record tracked in Git.
  - `current/`: current impact numbers, Thailand and Cambodia perspectives, and the neutral summary.
  - `news/`: retained source reporting, grouped by month and source group (`thailand`, `cambodia`, `international`).
  - `timeline/`: the durable event history, grouped by month.
  - `research-state.json`: research cadence and cycle state.
- `research/`: the research CLI, validation, quality evaluation, shared helpers, and production automation.
- `scripts/`: small site/build helpers.
- `tests/`: deterministic tests, including the fake-agent production harness.
- `public/`: static assets. `public/data/` is generated and is not a source of truth.

## Local development

```powershell
pnpm install
pnpm dev
```

Useful checks:

```powershell
pnpm test
pnpm validate
pnpm test:automation
pnpm build
```

`pnpm test:automation` uses a fake research agent and does not consume a model.

To inspect the compact context a research cycle receives:

```powershell
pnpm research context
```

The model-based reader-copy benchmark is intentionally separate from deterministic validation:

```powershell
pnpm quality:reader
```

This is the project's AGENTS.md

# BorderClash

## Goal

Maintain the canonical `data/` behind the existing BorderClash UI as the best available public record of the Thailand-Cambodia border situation.

An ordinary reader should be able to understand what is happening now, how the situation got here, what each side is reporting, and what remains uncertain. Accuracy, freshness, useful context, and clear attribution matter more than producing a change. A well-researched no-change cycle is a good result.

The UI is the product contract. The agent may inspect the whole repository and web, but its output is the canonical `data/`; the outer runner validates, generates public data, commits, and publishes afterward.

## Work

Start with `.work/CYCLE_CONTEXT.md`. It is orientation, not a boundary. Read any repository history or data and use web research whenever it can improve the record. There is no required search count, source count, search order, or fixed research path.

Use effort in proportion to uncertainty and likely impact. Finish when further work is unlikely to materially improve the accuracy, freshness, or usefulness of the record.

Treat the repository as a maintained knowledge base, not an append-only feed. Add, correct, merge, archive, or remove records when justified. Preserve stable IDs when the underlying record is still the same thing. Work from evidence toward synthesis: source reporting and timeline first, then `data/current/`.

When the record is in the best state the evidence supports, run `pnpm research finish` once. It keeps the current cadence unless you deliberately provide a better interval and reason.

## Information environments

News is organized by the audience and media environment, not by which country the story is about.

- `cambodia-domestic`: reporting people living in Cambodia actually read, watch, or encounter as Cambodian news. Use Khmer-language reporting where useful. A story being about Cambodia does not make it Cambodian domestic media.
- `thailand-domestic`: reporting people living in Thailand actually read, watch, or encounter as Thai news. Use Thai-language reporting where useful. A story being about Thailand does not make it Thai domestic media.
- `international`: reporting outside those two domestic media environments, including strong regional/international journalism and relevant primary institutions.

Seek enough source breadth to understand materially different reporting and framing, but do not rotate outlets for novelty. Keep news materially relevant to the border situation. A story's environment never makes its claims true; judge claims on evidence.

## Data

- `data/current/`: the best supported current picture.
- `data/timeline/`: the durable story of material events; prefer one strong event over duplicate coverage.
- `data/news/`: attributable reporting in monthly JSONL files. `active` and `unverified` can surface publicly; `archived` remains evidence/history without staying in the live feed.
- `data/research-state.json`: cycle timing and scheduler state.

`public/data/` is generated, not canonical. Use the validator and `research/lib/` as the source of truth for schema values, scoring rubrics, localization mechanics, and other structured conventions.

## Evidence and copy

Apply the same evidence standard regardless of which side benefits. Keep allegations attributed and preserve meaningful uncertainty or disagreement. For consequential claims such as fighting, casualties, territorial control, incursions, or major diplomatic changes, corroborate when practical. A primary source is authoritative about what that actor said or did, not automatically about disputed facts.

Store direct publisher URLs when URLs are part of the evidence. Never invent a URL, quote, number, date, translation, source, or certainty. `credibility` describes the evidence supporting that record, not a permanent reputation score for an outlet or viewpoint.

Write for ordinary civilians. English, Thai, and Khmer should each read like natural local general-news writing while preserving names, dates, numbers, actors, actions, negation, attribution, uncertainty, and claim strength. Keep the claimant in the same sentence as a disputed claim.

## Completion

End every completed cycle with `<!-- GOAL_COMPLETE -->` and a `HARNESS_FEEDBACK:` line. Review the harness honestly. Mention material friction such as confusing or over-constraining instructions, missing context, unnecessary work, tool failures, weak tooling, or awkward repository structure. Keep it concise and actionable. Use `HARNESS_FEEDBACK: none` only when nothing material got in the way.

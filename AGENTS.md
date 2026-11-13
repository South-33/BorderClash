This is the project's AGENTS.md

# BorderClash

## Goal

Maintain the canonical `data/` behind the existing BorderClash UI as the best available public record of the Thailand-Cambodia border situation.

An ordinary reader should understand what is happening now, how the situation got here, what each side is reporting, and what remains uncertain. The timeline is also long-term historical memory: a future researcher must be able to reconstruct meaningful developments from it and its sources. Accuracy, freshness, clear attribution, and useful context matter more than producing a change. A well-researched no-change cycle is a good result.

The UI is the product contract. The agent may inspect the whole repository and web, but its output is the canonical `data/`; the outer runner validates, generates public data, commits, and publishes afterward.

## Work

Start with `.work/CYCLE_CONTEXT.md`. It is orientation, not a boundary. Read any repository history or data and use web research whenever it can improve the record. Prioritize reporting since the last completed cycle with a short overlap, but research older material when it improves history. There is no required search count, source count, search order, or fixed research path.

Use effort in proportion to uncertainty and likely impact. Finish when further work is unlikely to materially improve the accuracy, freshness, or usefulness of the record.

Treat the repository as a maintained knowledge base, not an append-only feed. Add, correct, merge, archive, or remove records when justified. Preserve stable IDs for the same underlying records. Work naturally through **Curation -> Timeline -> Synthesis**, but these are not isolated steps: research, verify, and add evidence at any stage; revisit earlier conclusions when useful. Avoid repeated articles and events, but preserve distinct sources and historically meaningful developments even when they are not public highlights.

During synthesis, distinguish each side's stated position from observed military activity; justify posture assessments with evidence. Maintain a neutral overall comparison and concise key updates without erasing material disagreement.

When the record is in the best state the evidence supports, run `pnpm research finish` once. Choose the next cadence based on activity, risk, uncertainty, and likely information value: faster during significant developments, slower during sustained calm. Preserve the current cadence when justified and give a reason if changing it.

## Information environments

News is organized by the audience and media environment, not by which country the story is about.

- `cambodia-domestic`: reporting people living in Cambodia actually read, watch, or encounter as Cambodian news. Use Khmer-language reporting where useful. A story being about Cambodia does not make it Cambodian domestic media.
- `thailand-domestic`: reporting people living in Thailand actually read, watch, or encounter as Thai news. Use Thai-language reporting where useful. A story being about Thailand does not make it Thai domestic media.
- `international`: reporting outside those two domestic media environments, including strong regional/international journalism and relevant primary institutions.

Seek enough source breadth to understand materially different reporting and framing; discover new outlets when useful, but do not rotate outlets for novelty. Keep news materially relevant to the border situation. A story's environment never makes its claims true; judge claims on evidence.

## Data

- `data/current/`: the best supported current picture.
- `data/news/`: the single article/evidence registry. Store each evaluated article URL exactly once, regardless of whether research found it while curating news or building the timeline. Every stored article counts once in the dashboard total; `active` and `unverified` can surface in feeds while `archived` remains retained evidence.
- `data/timeline/`: the durable, reconstructable history of distinct meaningful events. Importance controls public prominence, not historical inclusion. Timeline events cite article IDs through `evidenceIds`; never copy source URLs, names, or credibility scores into timeline records.
- `data/research-state.json`: cycle timing and scheduler state.

`public/data/` is generated, not canonical. Full publisher HTML/text archives, when captured, stay private on South with an off-server backup, never in Git. Use the validator and `research/lib/` as the source of truth for schema values, scoring rubrics, localization mechanics, and other structured conventions.

## Evidence and copy

Apply the same evidence standard regardless of which side benefits. Keep allegations attributed and preserve meaningful uncertainty or disagreement. For consequential claims such as fighting, casualties, territorial control, incursions, or major diplomatic changes, corroborate when practical. A primary source is authoritative about what that actor said or did, not automatically about disputed facts.

Store direct publisher URLs when URLs are part of the evidence. For timeline entries use the event date, not merely the publication date; record an exact time only if supported. Never invent a URL, quote, number, date, time, translation, source, or certainty. Distinguish proof of a statement from proof of the underlying allegation. `credibility` describes the evidence supporting that record, not a permanent reputation score for an outlet or viewpoint.

One article has one canonical `credibility` score. If a timeline investigation discovers a new article, add or reuse the article in `data/news/` first, then cite its ID from the timeline. Never create a second score for the same URL.

Use only decile `credibility` scores: `100` verified, `90` very strong, `80` strong, `70` credible, `60` plausible/attributed, `50` uncertain, `40` weak, `30` very weak, `20` likely unreliable, `10` very likely false, `0` false/fabricated. One article URL has one score. Score the material factual report carried by its stored title/summary, not the outlet. A conflict party's material allegation about its opponent cannot exceed 60 without genuinely independent corroboration; repetition of one underlying source is not corroboration. Use 100 only when the report is directly established or exceptionally well corroborated. Lack of evidence is uncertainty, not falsity, so 0/10 require credible contrary evidence. When two adjacent scores are defensible, use the lower one. `research/lib/evidence-score.mjs` is the authoritative rubric.

Attribution changes what the record claims. If the title/summary explicitly says a named actor said, alleged, announced, protested, or acknowledged something, score whether the evidence supports that attribution; do not downgrade it as though the quoted allegation itself had been asserted as verified fact. Keep the allegation attributed in the copy.

Write for ordinary civilians in **English, Thai, and Khmer only**. Use concise, familiar local general-news language, not awkward literal translations or jargon. Thai uses digits **0-9**; use familiar English names, acronyms, or terms in Thai and Khmer when they improve understanding. Preserve names, dates, numbers, actors, negation, attribution, uncertainty, and claim strength. Keep the claimant in the same sentence as a disputed claim.

## Completion

End every completed cycle with `<!-- GOAL_COMPLETE -->` and a `HARNESS_FEEDBACK:` line. Review the harness honestly. Mention material friction such as confusing or over-constraining instructions, missing context, unnecessary work, tool failures, weak tooling, or awkward repository structure. Keep it concise and actionable. Use `HARNESS_FEEDBACK: none` only when nothing material got in the way.

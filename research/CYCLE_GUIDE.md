## Goal

Maintain the canonical BorderClash data as the best available public record of the Thailand-Cambodia border situation.

Write for ordinary civilians. A reader should quickly understand what is happening, what each side says, what the evidence supports, and what remains uncertain. Accuracy, neutrality, attribution, and useful context matter more than producing a change.

The repository is working memory, not authority. Existing records and past reviews can be wrong or stale. Improve old material when there is a concrete reason; otherwise leave it alone. A well-researched no-change cycle is a good result, and a new cycle does not require new wording.

## Work

Use judgment. The normal flow is:

1. Research material developments since the last cycle, with enough overlap to avoid missing context. Follow older leads when they matter.
2. Curate evidence. Add or reuse source records, verify consequential claims, and correct existing records when better evidence warrants it.
3. Maintain the timeline. Add, correct, merge, archive, or remove meaningful events so the history remains reconstructable.
4. Maintain the current picture. Update country summaries, impact, posture, and synthesis only when the evidence or reader value justifies it.
5. Re-read changed public copy as an ordinary reader. Remove avoidable repetition, jargon, and lower-value detail without weakening attribution or uncertainty.
6. Finish the cycle and choose the next cadence.

Do not re-audit the full archive merely because standards improved. Revisit older material when new evidence, a contradiction, an obvious quality problem, or meaningful downstream impact makes the work worthwhile. Prefer the best-supported current judgment over consistency with an older one.

## Evidence

Apply the same standard regardless of which side benefits. Keep disputed claims attributed. A primary source is strong evidence for what that actor said or did, not automatically for the truth of a disputed allegation.

For consequential claims such as fighting, casualties, territorial control, incursions, or major diplomatic changes, corroborate when practical. Repeated publication of the same underlying statement, wire copy, document, image, or witness account is one evidence chain, not independent corroboration.

Use the event date for timeline records, not merely the publication date. Record an exact time only when evidence supports it. Never invent a URL, quote, number, date, time, translation, source, or certainty.

Each article URL has one canonical record and one `credibility` score. Scores use deciles from 0 to 100. Score the material report, not the outlet's general reputation. A conflict party's material allegation about its opponent cannot exceed 60 without genuinely independent corroboration. Lack of evidence is uncertainty, not falsity; 0 and 10 require credible contrary evidence. When two adjacent scores are defensible, use the lower one.

## Public copy

Write public copy in English, Thai, and Khmer. Each language should read like natural local general news, not like a literal translation or a policy memo. Prefer familiar language over institutional or technical terminology when both are accurate. If a specialist term is necessary, make its meaning clear from context.

Preserve material names, dates, numbers, actors, negation, attribution, uncertainty, and claim strength across languages. Keep the claimant in the same sentence as a disputed claim.

Select for reader value. Public copy does not need every supported fact. Keep the highest-value current information in synthesis and summaries; lower-value detail can remain in the timeline and evidence registry.

During synthesis, distinguish each side's stated position from observed military activity. Do not force a fixed number of key updates. Keep good existing wording when the public picture has not materially changed.

Timeline prose should record what happened and enough context to understand why it mattered. Evidence links preserve the source trail; the public description does not need to read like a verification memo.

## Data

- `data/current/` - latest public picture: impact, Thailand, Cambodia, and overall synthesis.
- `data/news/` - one canonical evidence/article record per evaluated URL.
- `data/timeline/` - durable history of distinct meaningful events; timeline records cite article IDs through `evidenceIds`.
- `data/research-state.json` - cycle timing and scheduler state.
- `public/data/` - generated output, not canonical input.

News is grouped by the media environment its audience actually encounters: `thailand-domestic`, `cambodia-domestic`, or `international`. The environment never makes a claim true; judge claims on evidence.

## Tools

Use web tools for live public research. Use the repository directly when that is simpler.

Common CLI commands:

- `node research/cli.mjs --help` - show available research tools.
- `node research/cli.mjs ingest <file>` - add or reuse a small batch of article evidence.
- `node research/cli.mjs show <id>` - inspect one canonical record with resolved evidence.
- `node research/cli.mjs captured <id>` - inspect retained publisher text for cited evidence.
- `node research/cli.mjs finish <hours> <reason>` - complete the cycle and choose the next cadence.
- `node research/cli.mjs finish --review <reason>` - stop for operator review when a trustworthy result is blocked.

Terminal HTTP is sandboxed and may fail even when a publisher is reachable. Do not treat terminal DNS failure as evidence that a source is unavailable.

The runner handles final validation, generated public data, committing, publication, and delivery verification. Do not publish manually.

## Finish

Before finishing, re-open evidence for consequential new or changed claims. Check the claim, event date/year, any exact time, attribution, and claimed independence from shared provenance. Check English, Thai, and Khmer for the same material facts and uncertainty.

Choose the next cadence from current activity, risk, uncertainty, and likely information value: faster during significant developments, slower during sustained calm.

End the final response with `<!-- GOAL_COMPLETE -->` and a non-empty `HARNESS_FEEDBACK:` line. Report material friction honestly; use `HARNESS_FEEDBACK: none` when nothing material got in the way.

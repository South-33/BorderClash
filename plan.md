# BorderClash research system

## Goal and operating rules

Maintain the best supported public record of the Thailand–Cambodia border situation. Readers need a clear current picture, attributed positions, justified military assessments, humanitarian context, and a reconstructable history. Accuracy and useful evidence take priority over volume. A researched no-change cycle is valid.

One Antigravity CLI agent runs real cycles on Ubuntu South with `gemini-3.8-flash-medium`. Development and fake-agent tests can run elsewhere. Keep one permanent checkout on `main` per machine. Recoverable temporary clones isolate running cycles. Keep the existing UI and public data contract compatible. UI changes require the operator's approval.

The agent maintains canonical `data/`. The runner owns timing, recovery, source-capture mechanics, validation, Git integration, and public-delivery checks. Curation, timeline work, and synthesis remain open to further research at any point. Use `AGENTS.md` for editorial rules.

Implementation agents can simplify the schema, code, commands, and layout where this improves correctness or maintenance. Keep stable IDs and evidence references. Preserve useful work before retiring it. A failed acceptance check stays open with a concrete next action.

## 1. Keep a small, coherent system

- [x] Port the existing runner to Ubuntu using the installed PowerShell host and native machine and state paths.
- [x] Use one shared platform helper and one systemd service/timer installer. Retire Windows task installation.
- [x] Remove the parallel audit coordinator, its four prompts, and completed evidence-migration tooling. Retain the small JSONL merge routine still used by serial audit packet refresh. This removes about 2,900 lines.
- [x] Keep routine CLI help concise and expose historical audit commands through `audit-help`. Keep the launch prompt focused on canonical data and the review path.
- [x] Consolidate the recent development history while retaining the earlier history through `48b1475` and exact trees for the later impact, November 14, and November 19 synthesis snapshots. Original commits and all workspace heads are retained in verified recovery bundles outside Git.
- [ ] Finish retiring backed-up audit worktrees and their branch refs. Verify one local branch and one registered checkout, then sync laptop, GitHub, and South to the same `main`.

## 2. Preserve and recover each cycle

- [x] Keep an atomic run checkpoint, workspace, conversation, completion intent, logs, and pending-publication state. Resume completed turns at validation and interrupted turns in the same conversation where supported.
- [x] Reconcile data against current `main`, rerun trusted validation, hold overlapping changes for review, use fast-forward publication, and verify ambiguous push results before retrying.
- [x] Provide status, pause, stop, resume, run-now, restart-fresh, and cleanup through `research/automation/control.ps1`. Stop preserves work. Cleanup previews owned completed or explicitly retired scratch directories and preserves evidence.
- [x] Keep a durable review hold when the agent requests help or safe continuation needs an operator. Retry ordinary transient outages with bounded backoff.
- [x] Keep publication authentication in the runner environment. The agent environment strips it, and the terminal sandbox bounds filesystem access.
- [x] Pass the full Windows fake-agent recovery and publication suite in an isolated verification clone.
- [ ] Verify a fresh CLI session after the current authentication issue is resolved, then verify recovery after a real reboot without a manual desktop login.

## 3. Make timing and publication reliable

- [x] Keep `nextRunAt` as a UTC target calculated from validated completion and chosen cadence. Start early from measured duration plus a buffer. Keep the existing overdue counter.
- [x] Confirm delivery through the production `/data/dashboard.json`, including the expected research state and commit or a compatible descendant. A Git push alone leaves delivery pending.
- [x] Keep publication retries separate from research retries and preserve a pending candidate through outages.
- [x] Install `borderclash-research.service` and `borderclash-research.timer` on South. The timer checks every five minutes and the user manager has lingering enabled.
- [ ] Verify the installed timer with a working fresh CLI login, delayed network recovery, and a reboot. Enable unattended production only when these checks pass.

## 4. Preserve evidence

- [x] Keep one article registry across media environments and archived records. Ingest reuses article identity, flags ambiguous matches, and distinguishes shared provenance from independent corroboration.
- [x] Capture accessible public HTML/text and documents with bounded requests, safe destinations, checksums, explicit failure states, and a separate local backup. Capture failures stay visible and do not invalidate an otherwise supported article.
- [x] Move the laptop evidence archive and backup to South. At transfer there were 1,235 article directories, including 711 captured HTML sources and 7 captured documents. The remaining directories record extraction, access, or request failures.
- [x] Verify and restore a captured source on South by ID with matching checksums.
- [x] Consolidate old evidence pilots under South's local state directory, move the user desktop application out of Downloads, and remove its downloaded installer and the obsolete CLI binary.
- [ ] Verify terminal HTTP access and archive writes using the final per-cycle sandbox settings. The initial supervised cycle exposed blocked DNS in sandboxed source-probe commands. Public URL access and the two archive roots are now explicitly configured, with a real check pending fresh CLI authentication.

Keep bulk publisher content private and outside Git. The accepted initial backup remains on South and shares its failure domain. Broader off-server recovery and bulk historical capture remain later work.

## 5. Prove the research behavior

- [x] Run all four fixed editorial cases with Flash Medium on South. Correctly date a retrospective, attribute a disputed claim with one evidence chain, preserve a humanitarian claimant and scope across languages, and request review when required evidence is unavailable.
- [x] Run one full CLI research cycle under systemd on South with publication disabled. Session `20261120T114617573Z` passed validation and a production build. It made no canonical content change and retained the 24-hour cadence.
- [x] Apply its feedback. Scheduling tests now select the platform shell, absent audit state returns an actionable status, and completion output explicitly directs the model to return its final response and feedback.
- [x] Preserve a concise generated brief and short task prompt. Keep the current three media environments, decile article evidence scores, four timeline importance levels, and English/Thai/Khmer copy with matching facts.
- [x] Preserve monthly JSONL evidence and timeline files and small current JSON snapshots. Current claims use canonical evidence links, metric scope is explicit, and generated output retains the existing UI fields.
- [ ] Rerun the necessary live checks on the final simplified code after fresh CLI authentication works. Verify source access and the completion/review outcome.

Local proof after retiring the parallel coordinator includes 1,385 passing Node tests and a passing production build. The frozen Windows automation suite passed. Ubuntu passed all 1,408 tests before retirement and the focused CLI, scheduling, and production checks after the feedback fixes. Broaden verification when a new change warrants it.

## 6. Account for the historical record

- [x] Retain the audited corrections, merges, stable IDs, source archives, and local ledger from the laptop work.
- [x] Verify current reference integrity on South. The current tree has 3,335 articles, 581 timeline events, and no missing current/timeline evidence references.
- [ ] Finish the 10 records reopened by synchronizing the ledger to the latest data. Use original or captured evidence and Flash Medium on South. Resolve supported corrections and give every remaining uncertainty an explicit reason.
- [ ] Review the unresolved source gaps with the operator. The synchronized ledger accounts for 4,056 historical/current records, including merged records. It contains 3,142 unresolved records and 10 pending records. These counts describe audit dispositions and source limitations.

Do not infer factual support from a stored summary or from a passing schema check. Preserve attribution and uncertainty when sources remain inaccessible. Add earlier history when needed to repair chronology or explain a meaningful sequence. A comprehensive new pre-project history remains separate work.

## 7. Finish and roll out

- [ ] Resolve the fresh CLI authentication failure. Earlier sessions and the completed supervised run worked, but subsequent fresh invocations returned `authentication required`. Interactive CLI sign-in on South is pending.
- [ ] Finish the remaining acceptance checks above, publish the consolidated `main` with a checked force-with-lease for the authorized history rewrite, and verify the production snapshot.
- [ ] Verify both checkouts are clean and on the same revision. Enable the timer after unattended acceptance passes and confirm the first scheduled outcome.
- [ ] Record the final verified result and any unresolved evidence limitations here. Remove stale or superseded notes.

Continue from the first unfinished prerequisite. Keep independent work moving while authentication or another external dependency is pending. Ask for the specific missing action when it is required. Mark completion from observed results.

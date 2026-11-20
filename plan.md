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
- [x] Retire all 281 backed-up audit worktrees and their branch refs. Laptop and South each have one registered checkout on `main`. Both match GitHub and the verified public deployment. The earlier research history and distinct synthesis snapshots remain directly readable in Git. Retired runtime files are outside the active checkout.
- [x] Share the South owner's tool paths and credential bus across SSH, terminals, and user services. Keep host setup in `../SouthServer`, including shared tmux, a compact health check, and on-demand desktop screenshots/input. Retire the unused Antigravity remote-control daemon. Archive migration scratch and the stale laptop audit ledger outside this checkout; South holds the working audit ledger.

## 2. Preserve and recover each cycle

- [x] Keep an atomic run checkpoint, workspace, conversation, completion intent, logs, and pending-publication state. Resume completed turns at validation and interrupted turns in the same conversation where supported.
- [x] Reconcile data against current `main`, rerun trusted validation, hold overlapping changes for review, use fast-forward publication, and verify ambiguous push results before retrying.
- [x] Provide status, pause, stop, resume, run-now, restart-fresh, and cleanup through `research/automation/control.ps1`. Stop preserves work. Cleanup previews owned completed or explicitly retired scratch directories and preserves evidence.
- [x] Keep a durable review hold when the agent requests help or safe continuation needs an operator. Retry ordinary transient outages with bounded backoff.
- [x] Keep publication authentication in the runner environment. The agent environment strips it, and the terminal sandbox bounds filesystem access.
- [x] Pass the full Windows and Ubuntu fake-agent recovery and publication suites in isolated verification clones.
- [x] Verify a fresh Flash Medium CLI session after the owner's sign-in. A sandboxed terminal request returned HTTP 200; CLI research works independently of the retired remote-control daemon.
- [ ] Verify recovery after a real reboot without a manual desktop login. The host repository includes a native encrypted keyring startup setup and its credential mechanism passed a real round-trip test. The owner must enter the Login keyring password locally once before reboot acceptance can proceed.

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
- [x] Verify terminal HTTP access with a fresh CLI session and explicit public URL permission after sign-in.
- [x] Verify archive writes from the model's terminal using the final per-cycle sandbox settings. Flash Medium captured public HTML into the private archive and backup, then verified all four files with no checksum mismatch. Acceptance conversation: `4aab8a4e-cd0e-4706-b955-4244676e0ec7`.

Keep bulk publisher content private and outside Git. The accepted initial backup remains on South and shares its failure domain. Broader off-server recovery and bulk historical capture remain later work.

## 5. Prove the research behavior

- [x] Run all four fixed editorial cases with Flash Medium on South. Correctly date a retrospective, attribute a disputed claim with one evidence chain, preserve a humanitarian claimant and scope across languages, and request review when required evidence is unavailable.
- [x] Run one full CLI research cycle under systemd on South with publication disabled. Session `20261120T114617573Z` passed validation and a production build. It made no canonical content change and retained the 24-hour cadence.
- [x] Apply its feedback. Scheduling tests now select the platform shell, absent audit state returns an actionable status, and completion output explicitly directs the model to return its final response and feedback.
- [x] Preserve a concise generated brief and short task prompt. Keep the current three media environments, decile article evidence scores, four timeline importance levels, and English/Thai/Khmer copy with matching facts.
- [x] Add canonical file paths and timestamp units to the compact brief after observing guessed filenames and string/numeric date comparisons in a real cycle. Keep the existing size limit.
- [x] Make Node and PowerShell use the same lowercase Linux review directory and honor `XDG_STATE_HOME`. Consolidate the first batch results into that directory and verify that `audit-resume` finds the current saved review. A cross-runtime regression passes on Windows and South.
- [x] Fix current-snapshot audit marking: it saved the ledger and then failed by trying to release a timeline-only claim for a `current/...` ID. Only timeline records now use that cleanup. The CLI regression passes on Windows and South.
- [x] Preserve monthly JSONL evidence and timeline files and small current JSON snapshots. Current claims use canonical evidence links, metric scope is explicit, and generated output retains the existing UI fields.
- [ ] Finish a live acceptance cycle on the revised instructions. The fresh run `20261120T185222894Z` was stopped after repeated searches for the same inaccessible leads; its conversation and workspace remain resumable. The instructions now direct the model to use retained publisher text and leave exhausted leads uncertain. Use South's retained archive for the next acceptance run.

After retirement and feedback fixes, Ubuntu passed all 1,385 Node tests and the full fake-agent suite. The Windows suite also passed in a frozen clone, and the production build passed. After the shared-state and brief fixes, Windows passed all 1,386 Node tests; the focused cross-runtime, context, and reviewer checks passed on South.

## 6. Account for the historical record

- [x] Retain the audited corrections, merges, stable IDs, source archives, and local ledger from the laptop work.
- [x] Verify current reference integrity on South. The current tree has 3,335 articles, 581 timeline events, and no missing current/timeline evidence references.
- [ ] Finish the remaining 8 reopened records with captured evidence and Flash Medium on South. Two other reopened articles were retried and given explicit unresolved dispositions: Bangkok Post returned a transient failure; Fresh News blocked access. Stored summaries are not source verification.
- [ ] Review the unresolved source gaps with the operator. The synchronized ledger accounts for 4,056 historical/current records, including merged records. It contains 3,144 unresolved records and 8 pending records. These counts describe audit dispositions and source limitations.

Do not infer factual support from a stored summary or from a passing schema check. Preserve attribution and uncertainty when sources remain inaccessible. Add earlier history when needed to repair chronology or explain a meaningful sequence. A comprehensive new pre-project history remains separate work.

## 7. Finish and roll out

- [x] Resolve the fresh research CLI authentication failure through the owner's CLI sign-in and verify a new session. Encrypted keyring startup remains the separate prerequisite for unattended reboot recovery.
- [x] Publish the authorized history rewrite with checked force-with-lease. Verify the production snapshot and successful Vercel deployment on the consolidated `main`.
- [ ] Verify both checkouts are clean and on the same revision. Enable the timer after unattended acceptance passes and confirm the first scheduled outcome.
- [ ] Record the final verified result and any unresolved evidence limitations here. Remove stale or superseded notes.

Continue from the first unfinished prerequisite. Keep independent work moving while authentication or another external dependency is pending. Ask for the specific missing action when it is required. Mark completion from observed results.

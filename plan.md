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
- [ ] Verify recovery after a real reboot without manual intervention. South is now configured as a trusted single-user agent workstation: GDM auto-login is enabled, idle locking is disabled, and normal `agy` deliberately hides SSH markers so fresh SSH and a transient user-systemd service both reused the existing GNOME/keyring login successfully. Critical research does not depend on that desktop path: SouthServer installs a separate `/usr/local/bin/agy-unattended` launcher that selects Antigravity's SSH/file-backed OAuth store, and BorderClash explicitly prefers it on Linux instead of relying on PATH order. The unattended store still needs one owner Google authorization, and the existing Login/Default keyrings remain password-protected until their one-time passwordless conversion. Complete those two owner-only interactions, then verify fresh-process reuse, user-systemd use, keyring availability after auto-login, and reboot recovery.

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
- [ ] Finish autonomous live acceptance. Runs `20261120T185222894Z` and `20261120T192011049Z` repeated searches for unavailable old leads and were stopped with work preserved. The second used the retained archive. An operator-guided continuation of conversation `7d2e9a92-f658-4ff5-ba55-aee3dd6ae5d7` then called `finish --review` correctly; this proves the review intent, not autonomous stopping. Its result is `logs/source-hold.result.json` under the second session; its outer checkpoint remains resumable. Investigation found 86 web searches in that live turn, terminal `probe-source` DNS failures caused by Antigravity's network sandbox rather than South networking, and an accidental 359-package bootstrap from invoking the pnpm script in a dependency-free cycle clone. The cycle context now exposes current key-update evidence IDs up front, tells the model that sandbox DNS failure does not prove publisher unavailability, and directs research commands through `node research/cli.mjs` so simple data operations do not install application dependencies. Re-run supervised acceptance after authentication; do not resume the old research blindly.

After retirement and feedback fixes, Ubuntu passed all 1,385 Node tests and the full fake-agent suite. The Windows suite also passed in a frozen clone, and the production build passed. After the shared-state and brief fixes, Windows passed all 1,386 Node tests; the focused cross-runtime, context, and reviewer checks passed on South.

The PCA correction subsequently passed all 1,388 Node tests in a frozen South snapshot, a fresh Flash Medium review, and verification of the committed delta `85f660c`. Live feedback still reports publisher-specific sandbox DNS failures and an unnecessary dependency rebuild when invoking `pnpm research`; investigate these before rollout.

## 6. Account for the historical record

- [x] Retain the audited corrections, merges, stable IDs, source archives, and local ledger from the laptop work.
- [x] Verify current reference integrity on South. The current tree has 3,335 articles, 581 timeline events, and no missing current/timeline evidence references.
- [x] Give all 10 reopened records a disposition using captured evidence and Flash Medium on South where evidence was available. Six were reviewed, the PCA headline was narrowed to its own announcement, and three remain unresolved: two inaccessible articles and the current summary's unsupported fourth key update. A model warning about Thai script in `summaryKh` was rejected after checking the actual Unicode codepoints; do not edit valid Khmer based on that warning.
- [ ] Review the remaining source gaps. The synchronized ledger accounts for 4,056 historical/current records, including merged records: 169 reviewed, 611 corrected, 131 merged, 3,145 unresolved, and zero pending. An accounted-for ledger is not a fully verified historical record. The current summary hold concerns uncaptured Khaosod article `1b74fc2f24abb855829e964f656dd8b2`; no supplied capture corroborated key update 4's army calm statement.

Do not infer factual support from a stored summary or from a passing schema check. Preserve attribution and uncertainty when sources remain inaccessible. Add earlier history when needed to repair chronology or explain a meaningful sequence. A comprehensive new pre-project history remains separate work.

## 7. Finish and roll out

- [ ] Complete trusted-workstation authentication and reboot acceptance. Normal interactive `agy` now shares the owner's GNOME credential session across GNOME Terminal, SSH, and user-systemd; a fresh SSH request returned `OK` and a transient user-systemd probe exited successfully. BorderClash commit `d5f0a0f` independently selects `agy-unattended`, whose file-backed OAuth remains unauthenticated until one owner sign-in. SouthServer commits `f2ee128` and `65fdf8c` configure auto-login/no-lock, separate the two Antigravity launchers, and provide an idempotent keyring-password removal helper that preserves stored items. Complete the passwordless-keyring conversion and `agy-unattended acp --login`, then reboot and verify both shared desktop credentials and unattended research without human input.
- [x] Publish the authorized history rewrite with checked force-with-lease. Verify the production snapshot and successful Vercel deployment on the consolidated `main`.
- [ ] Verify both checkouts are clean and on the same revision. Enable the timer after unattended acceptance passes and confirm the first scheduled outcome.
- [ ] Record the final verified result and any unresolved evidence limitations here. Remove stale or superseded notes.

Continue from the first unfinished prerequisite. Keep independent work moving while authentication or another external dependency is pending. Ask for the specific missing action when it is required. Mark completion from observed results.

Scheduler decision: retain **systemd -> existing BorderClash runner -> Antigravity CLI**. Antigravity `/schedule` is conversation-scoped; persistent App automations are a separate sidecar feature with fresh conversations. T3 can run scheduled prompts through a boot-enabled Linux user service, but it manages a separate Antigravity provider profile/sign-in and would not replace BorderClash's recovery, validation, review-hold, adaptive-cadence, publication, or delivery checks. For this single production job it adds a credential/runtime layer without removing a required layer. Reconsider only if those responsibilities materially change. Sources: [Antigravity schedule](https://antigravity.google/docs/commands/schedule/), [T3 background service](https://github.com/pingdotgg/t3code/blob/main/docs/user/background-service.md), [T3 Antigravity provider](https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-antigravity.md).

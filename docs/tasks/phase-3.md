# Phase 3: Structured delivery (21 pts)
Exit check: plan, review, reopen, change scope and switch modes without counting a parent twice or rewriting earlier progress.

## 3.1 Build the breakdown and assign work (3 pts)
Requires: 0.3, 2.1. Enables: 3.2, 3.3, 3.4, 4.3, 4.4, 5.4. Trace: FR-012, FR-019, FR-020, FR-026(skip, SHOULD).
**Build:** Optional milestones, deliverables, tasks, subtasks. Active leaves: one assignee, optional reviewer/collaborators, stable keys. Work list and board basics.
**Pass when:**
- T12: create direct task, milestone+task, deliverable+subtasks. Reject invalid nesting and cross-project parents.
- T19: create/read/edit/retire work types. Removed planned leaf needs an approved scope change and leaves history.
- T20: one primary assignee, reviewer if required, optional collaborators. Reassign without erasing previous assignment.
- Reject cycles and depth > 5 levels. Splitting an accepted leaf proposes a scope change.

## 3.2 Approve scope and keep its versions (3 pts)
Requires: 1.4, 3.1. Enables: 3.5, 3.6. Trace: FR-025, D03.
**Build:** Draft and active scope with leaf IDs, weights, unit, reason. Add/remove/cancel/split/reweight via version-checked approval.
**Pass when:**
- T25: approve addition or removal. Record reason, author, approver, prior/current baselines. Earlier snapshots unchanged.
- AS-08: 50 accepted of 100, approve +25 -> new snapshot 40% (50/125); prior 50% remains at old scope version with date + reason.
- Concurrent approvals cannot activate two baselines. Cancelling an item alone does not secretly raise the percentage.

## 3.3 Implement review and rework (4 pts)
Requires: 1.3, 3.1. Enables: 3.5, 3.6, 4.3, 5.2. Trace: FR-022, D04.
**Build:** Criteria, submitted revision, required checks, reviewer, decision. Submit, approve, request changes, direct Done when policy permits, authorized reopening.
**Pass when:**
- T22: required review blocks Done until the submitted revision is approved and criteria/checks pass. Changes requested -> In Progress.
- Reject approval on stale revision (409 `STALE_REVIEW`) or missing check.
- Reopening invalidates previous credit but keeps history.

## 3.4 Link dependencies and manage blockers (3 pts)
Requires: 1.4, 3.1. Enables: 3.6, 5.1, 5.4. Trace: FR-021, FR-024, M07.
**Build:** Finish-to-Start links inside a project, cycle detection, affected successors, blocker with reason/owner/severity/timestamps. Guard changes and removals.
**Pass when:**
- T21: flag In Progress item blocked with reason + owner; clear blocker without changing task state.
- T24: reject self-links and cycles, including two simultaneous reverse links. Surface affected work when A changes.
- AS-05 (dependency part): block a critical predecessor, pass due date, run reminder job twice -> specific health reason + affected item.
- Removing a predecessor requires explicit treatment of its links.

## 3.5 Calculate accepted work and snapshot it (4 pts)
Requires: 2.2, 3.2, 3.3. Enables: 3.6, 5.1, 5.3, 5.5. Trace: FR-027, FR-029.
**Build:** Numerator/denominator from active baseline's qualifying leaves, one unit. Snapshot value, totals, method, baseline, time, cause on material change.
**Pass when:**
- T27: weights 20, 30, 50, first two accepted -> 50%, no parent credit, empty eligible denominator -> Not measurable.
- T29: change scope and mode; old snapshots keep value, timestamp, method and original scope version; chart shows the break.
- AS-03: leaves 20 and 30 accepted + In Review leaf 50; approve last revision -> 50% then 100%. A merged PR cannot replace required review.
- Check 50%, 40%, 16%, empty scope, open work at 0%, no double counting.

## 3.6 Switch modes and accept structured delivery (4 pts)
Requires: 2.4, 3.2, 3.3, 3.4, 3.5. Enables: 5.5, 6.1. Trace: FR-013, FR-015, FR-029.
**Build:** Authorized transitions with preview, reason, atomic commit. Freeze old series. Start new method against approved scope or fresh check-in. Extend delivery checks to team work.
**Pass when:**
- T13: switch both directions. Inject failed write -> either whole transition commits or previous mode and history stay intact.
- T15 (team): delivery pending until authorized decision + checklist.
- AS-04: Individual 60% -> Structured with approved remaining-work baseline; 60% stays on its date; new labelled series from accepted leaves; record who changed method.
- Notify manager and owner once after success.

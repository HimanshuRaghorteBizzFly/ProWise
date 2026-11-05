# Phase 2: Projects and Individual Ownership (14 pts)
Exit check: manager creates a project quickly, one developer reports without tasks, deadlines use the agreed calendar, delivery requires an authorized decision.

## 2.1 Create, find and edit project records (4 pts)
Requires: 0.2, 1.3, 1.4. Enables: 2.2, 2.3, 2.4, 3.1, 4.1. Trace: FR-009, FR-011, FR-016(skip, SHOULD).
**Build:** Project setup, stable key, description, owner, PM, members, dates, timezone, priority, state, mode. Permitted list. (Skip template branch.)
**Pass when:**
- T09: required fields + unique key. Reject duplicate key in same org and an invalid date range.
- T11: project with one accountable developer and ZERO tasks; owner can report progress immediately.
- A new solo project has zero tasks and no invented percentage. Reject foreign owners.

## 2.2 Record Individual progress and corrections (4 pts)
Requires: 0.3, 2.1. Enables: 2.4, 3.5, 5.3. Trace: FR-017, FR-018, FR-028.
**Build:** Accountable developer's percentage, accomplishments, next work, blockers, projected finish, optional evidence. Append-only corrections and configured verification.
**Pass when:**
- T17: submit 45% + accomplishments, next steps, blockers, projected finish. Validate range; return dated entry; create no tasks.
- T18: downward correction needs a reason; original, correction, authors, verification state all visible.
- T28: portfolio, detail and report show "Developer reported" + time. Verification keeps that label.
- AS-01: Individual project with one developer and repos, no tasks; submit 40% -> overview shows 40% Developer reported with date/source; repo events have own timestamps.
- 100% cannot close delivery.

## 2.3 Build the working calendar and cadence (3 pts)
Requires: 0.3, 1.4, 2.1. Enables: 2.4, 5.1, 5.2, 5.4. Trace: FR-037, NFR-12.
**Build:** Due dates + local cutoff timezone, org workdays/holidays, check-in frequency and grace. Version date/recurrence changes and future occurrences.
**Pass when:** Test Friday + 1 working day with a Monday holiday; a DST change; a project on hold; a rescheduled date. Never two live occurrences for one due window.

## 2.4 Deliver, close, archive and restore (3 pts)
Requires: 2.1, 2.2, 2.3. Enables: 3.6, 5.1. Trace: FR-014, FR-015, D01, D04.
**Build:** Lifecycle + archive flag. Acceptance request/checklist, rejection, named waiver, authorized delivery/closure, restoration. Start with Individual mode.
**Pass when:**
- T14: archive -> edits stop. Restore keeps lifecycle, scope, history. Reconcile reminders once.
- T15: reach 100% -> delivery pending until authorized decision + checklist. Record accepted scope and evidence.
- AS-02: owner submits 100% -> "Awaiting acceptance". Only authorized acceptance makes it Delivered. Closing is a recorded later action.
- Critical unwaived blockers prevent acceptance. Stale approval cannot close a newer version.

---
**After 2.4: MVP checkpoint.** Tag `v0.1-individual`.

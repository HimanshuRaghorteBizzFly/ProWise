# Phase 2: Projects and Individual Ownership (14 pts)

Goal: a manager creates a project quickly, one developer reports without tasks, deadlines follow the agreed calendar, delivery needs an authorized decision.

Build order: **2.1, 2.2, 2.3, 2.4.** After 2.4 you have the MVP (tag `v0.1-individual`).

---

## 2.1 Create, find and edit project records (4 pts)

**Prompt**
```
Do task 2.1. Follow the workflow in CLAUDE.md. Skip the template branch (T16 deferred).
Read: docs/tasks/phase-2.md card 2.1, docs/api-contract.md (projects), docs/domain-rules.md (lifecycle),
docs/screen-map.md (All Projects, Individual project).
Tests: T09, T11, foreign owner rejected.

DATABASE
projects(id, org_id, key unique per org, name, scope_description, project_manager_id, accountable_developer_id, mode
INDIVIDUAL|STRUCTURED, lifecycle PLANNED|ACTIVE|ON_HOLD|AWAITING_ACCEPTANCE|DELIVERED|CLOSED|CANCELLED, archived bool,
previous_lifecycle, start_date, target_date, timezone IANA, calendar_ref, priority, active_baseline_id nullable, version),
project_members(project_id, membership_id, role), project_date_history(old/new target, reason, actor), ownership_history.
Composite keys/checks so members and owners belong to the same org.

BACKEND (package com.prowise.project)
- POST /v1/organizations/{org}/projects (project.create), GET list with cursor pagination (deterministic order, id tiebreaker),
  search, filters (owner, team, health, status, mode, date range), returning ONLY projects the user may read.
- PATCH /v1/projects/{id} with expectedVersion; changing the target date requires previous/new date + reason (history row).
- Validate unique key, date range, members and owners from the same org. A new Individual project has ZERO tasks and NO invented percentage.
- Everything through PermissionService + ChangeRecorder.

FRONTEND
Reuse the existing portfolio/project screens. All Projects (list/cards toggle, saved filters, search, sort), Create project form
(name, key, scope, PM, accountable developer, dates, timezone, priority, mode), Project shell with tabs
(Individual: Overview, Updates, Repositories, Activity, Settings). Overview shows target date, last report, "Not reported" when none.
Empty state: "No projects match your filters". Wire to the real API; remove mock projects.
```

**Expected outcome**
- Create, list, filter and edit projects for real, stored in PostgreSQL, permission-scoped.
- A solo project exists with no tasks and no fake percentage.

**Verify yourself**
- Create a project with a duplicate key: rejected. Use a member from another org: rejected.
- Log in as a user without read access: the project is absent from the list and its URL gives 404.

---

## 2.2 Record Individual progress and corrections (4 pts)

**Prompt**
```
Do task 2.2. Follow the workflow in CLAUDE.md. Use com.prowise.domain.progress.IndividualProgress for the current value.
Read: docs/tasks/phase-2.md card 2.2, docs/domain-rules.md (progress methods, Individual value).
Tests: T17, T18, T28, AS-01 (repo events come later in 4.3; test the 40% + date/source part now), replay key.

DATABASE
checkins(id, org_id, project_id, author_id, revision_of nullable, revision_seq, percent 0..100, accomplished, next_steps,
blockers jsonb, projected_finish, evidence jsonb, status ACCEPTED|PENDING_VERIFICATION|REJECTED, method default 'developer_reported',
captured_at, version) append-only (no update/delete), projects.require_verification bool.

BACKEND
- POST /v1/projects/{id}/checkins (project.progress.report; only the accountable developer; Individual mode only).
  Validate range; return 201 with checkin_id, method, percent, version, captured_at. Replaying the same Idempotency-Key adds no second entry.
- Corrections append a new entry with revision_of; a DOWNWARD correction requires a reason. Nothing is ever edited or deleted.
- If require_verification: new entries start PENDING_VERIFICATION; a user with project.progress.override accepts or rejects;
  the UI shows last accepted value and the pending value separately. Verification never changes the "developer_reported" label.
- GET /v1/projects/{id}/progress-history (cursor, as-of) returning snapshots with method and missing-value reason.
- 100% does NOT close delivery.

FRONTEND
Updates tab: check-in form (percent slider/number, accomplished, next steps, blockers, projected finish, optional evidence link),
history list with author/time/"Developer reported" label, correction dialog (reason required for decreases), progress chart over time.
Portfolio, project detail and reports show the label + time next to the percentage (T28). "No check-in yet" when empty.
```

**Expected outcome**
- A developer submits and corrects progress; history is permanent and clearly labelled.

**Verify yourself**
- Submit 45%, then correct to 30% without a reason: refused. With a reason: both entries remain visible.
- Log in as someone who is not the accountable developer: submit is 403.

---

## 2.3 Working calendar and cadence (3 pts)

**Prompt**
```
Do task 2.3. Follow the workflow in CLAUDE.md. Use com.prowise.domain.calendar.WorkingCalendar from task 0.3.
Read: docs/tasks/phase-2.md card 2.3, docs/domain-rules.md (calendar and cadence).
Tests: Friday + 1 working day grace with Monday holiday; DST change; project on hold; rescheduled date; no duplicate occurrences (FR-037 foundation, NFR-12).

DATABASE
org_calendar(org_id, workdays, holidays jsonb, version), project_cadence(project_id, frequency DAILY|WEEKLY|FORTNIGHTLY default WEEKLY,
grace_working_days default 1, reminder_offsets default [3,1], policy_version), due_occurrences(id, org_id, project_id, kind CHECKIN|TARGET,
due_local_date, zone, cutoff_instant, policy_version, status OPEN|MET|MISSED|EXCUSED|SUPERSEDED, unique(project_id, kind, due_local_date, policy_version)).

BACKEND
- Endpoints to read/update the org work calendar and project cadence (expectedVersion, audit + outbox).
- OccurrenceGenerator (scheduled, idempotent): materializes the next occurrences. Changing a due date or cadence supersedes future
  occurrences and keeps old/new dates + reason. Never two live occurrences for one due window.
- ON_HOLD pauses missing-check-in occurrences; restore recomputes once, no stale backlog.
- A date-only target stays on time through that local date in the project zone; overdue starts at the first instant of the next local date.
- Check-in compliance helper (met / eligible, show pending/grace/excused separately; no rate for zero eligible).
(Reminder DELIVERY is task 5.2; here only the occurrences exist.)

FRONTEND
Org settings: work calendar (workdays, holidays). Project settings: cadence, grace, target date with required reason on change.
Project overview: "Next check-in due <date>" and "Target <date> (<zone>)"; show overdue/grace state.
```

**Expected outcome**
- One shared calendar calculation feeds deadlines, grace, pace and future reminders.

**Verify yourself**
- Set a Monday holiday, cadence Friday, grace 1 day: the due window ends Tuesday.
- Change the target date twice: only one open occurrence per window; old ones show SUPERSEDED.

---

## 2.4 Deliver, close, archive and restore (3 pts)

**Prompt**
```
Do task 2.4 (Individual mode first). Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-2.md card 2.4, docs/domain-rules.md (lifecycle gates, corrections after acceptance).
Tests: T14, T15 (individual), AS-02, critical unwaived blocker prevents acceptance, stale approval cannot close a newer version.

DATABASE
acceptance_requests(id, org_id, project_id, bound_checkin_id/baseline_id, checklist jsonb, status, version),
acceptance_decisions(id, request_id, decision ACCEPTED|REJECTED|CHANGES_REQUESTED, actor_id, reason, decided_at),
waivers(id, project_id, blocker_ref, actor_id, reason), project_closures(project_id, actor_id, reason/reference, closed_at).

BACKEND
- Lifecycle state machine with the gates in docs/domain-rules.md. ReadinessChecker interface: Individual implementation now
  (latest applicable report = 100%); Structured implementation comes in 3.6.
- POST /v1/projects/{id}/acceptance-requests (bind to the exact check-in version), POST /v1/acceptance-requests/{id}/decisions
  (authorized approver; critical blockers resolved or explicitly waived with actor + reason; outdated version rejected 409).
- POST /v1/projects/{id}/close (separate permission; Delivered -> Closed; handover note, date, reason).
- POST /v1/projects/{id}/archive and /restore: archive stops edits and reminders, keeps history; restore returns the previous
  lifecycle and recomputes future occurrences once.
- After acceptance, a material change needs an explicit authorized reopening + audit before edits.
- Every transition goes through PermissionService + ChangeRecorder.

FRONTEND
Lifecycle controls on the project (start, hold, resume, request acceptance, accept/reject/request changes, close, archive, restore),
acceptance checklist dialog, "Awaiting acceptance" and "Delivered" badges, read-only banner for archived projects.
Reaching 100% shows "Awaiting acceptance", not "Delivered".
```

**Expected outcome**
- The complete solo-project journey works end to end.

**Verify yourself**
- Report 100%: lifecycle shows Awaiting acceptance. Only an authorized user can accept. Closing is a separate action.
- Archive: edits are blocked. Restore: same lifecycle, scope and history.

**MILESTONE:** run the full journey in the browser (sign up, workspace, project, check-ins, accept, close, archive). Tick 2.1 to 2.4, tag `v0.1-individual`. You now have a demoable product.

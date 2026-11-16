# Phase 3: Structured delivery (21 pts)

Goal: plan, review, reopen, change scope and switch modes without counting a parent twice or rewriting earlier progress.

Build order: **3.1, 3.2, 3.3, 3.4, 3.5, 3.6.** (3.2 and 3.3 can be swapped; 3.5 needs both.) T26 (board/timeline drag views) is deferred: build lists and tree views only.

---

## 3.1 Build the breakdown and assign work (3 pts)

**Prompt**
```
Do task 3.1. Follow the workflow in CLAUDE.md. Skip drag-and-drop boards (T26 deferred); build a work list and tree view.
Read: docs/tasks/phase-3.md card 3.1, docs/domain-rules.md (hierarchy, task workflow), docs/api-contract.md (work items).
Tests: T12, T19, T20, cycles and depth > 5 rejected, splitting an accepted leaf proposes a scope change.

DATABASE
work_items(id, org_id, project_id, parent_id, type MILESTONE|DELIVERABLE|TASK|SUBTASK, key (project key + sequence, e.g. CRM-101),
title, description, state TO_DO|IN_PROGRESS|IN_REVIEW|DONE|CANCELLED, primary_assignee_id, reviewer_id, criteria jsonb,
criteria_version, weight nullable, due_date, criticality, revision, version), work_item_collaborators, assignment_history(old/new, actor, time).
Composite FK so parent is in the same project.

BACKEND (package com.prowise.work)
- POST /v1/projects/{id}/work-items (task.create), PATCH /v1/work-items/{id} (task.update, expectedVersion).
- Hierarchy: project -> optional milestone -> optional deliverable -> task -> subtask. Max 5 levels including project.
  Reject cross-project parents, loops, invalid levels. Draft rows may be incomplete; ACTIVE measurable leaves need one primary
  assignee, approved weight (set in 3.2) and criteria.
- Reassign keeps old/new assignee, actor, time. Retire (soft) only through an approved scope change; show dependent links first.
- Stable keys, unique per project.

FRONTEND
Breakdown tab (collapsible tree), work list with filters, work item drawer (title, description, criteria, assignee, reviewer, collaborators,
due date), create/edit forms, reassign dialog. Reuse any existing task UI. Skip drag-and-drop board.
```

**Expected outcome**
- A project can run with direct tasks or a milestone/deliverable hierarchy up to five levels.

**Verify yourself**
- Try to nest 6 levels, a task under another project's milestone, and a loop: all rejected.
- Reassign a task: history shows both people.

---

## 3.2 Approve scope and keep its versions (3 pts)

**Prompt**
```
Do task 3.2. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-3.md card 3.2, docs/domain-rules.md (scope versions, units).
Tests: T25, AS-08 (the scope part), concurrent approvals activate only one baseline, cancelling alone does not raise the percentage.

DATABASE
scope_versions(id, org_id, project_id, version_no, unit EFFORT|POINTS|EQUAL, status DRAFT|ACTIVE|SUPERSEDED, effective_at, reason,
author_id, approver_id, expected_base_version), scope_leaves(scope_version_id, work_item_id, weight). Immutable once approved.
Partial unique index: one ACTIVE baseline per project.

BACKEND
- POST /v1/projects/{id}/scope-versions (draft diff: add/remove/cancel/split/reweight, one unit, reason, expected base),
  POST /v1/scope-versions/{id}/approve (project.scope.change). Approval atomically: activates the new baseline, supersedes the old,
  triggers the progress snapshot hook (implemented in 3.5), writes audit + outbox. Stale base = 409 STALE_VERSION.
- Reject mixed units, zero or negative weights. A cancelled item stays in the denominator until an authorized removal.
- Prior baselines remain readable.

FRONTEND
Scope tab: current baseline, draft editor with a diff view (added, removed, reweighted), unit selector, reason, approve dialog showing the
effect ("50/100 = 50% becomes 50/125 = 40%"), version history list.
```

**Expected outcome**
- Every scope change is versioned, explained and attributable.

**Verify yourself**
- Approve two drafts at once from two browsers: one wins, one gets 409.
- Old baselines are still viewable; nothing was overwritten.

---

## 3.3 Implement review and rework (4 pts)

**Prompt**
```
Do task 3.3. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-3.md card 3.3, docs/domain-rules.md (review rules), docs/api-contract.md (stale review fixture).
Tests: T22, stale revision 409 STALE_REVIEW, missing check rejected, reopen invalidates credit but keeps history,
submitter and reviewer are different people where review is required.

DATABASE
submissions(id, org_id, work_item_id, revision, criteria_version, evidence jsonb, submitted_by, submitted_at, status),
reviews(id, submission_id, reviewer_id, decision APPROVED|CHANGES_REQUESTED, reason, decided_at, work_item_revision),
required_checks(work_item_id, check_key, satisfied), reopen_events(work_item_id, actor, reason, at, superseded_credit).

BACKEND
- POST /v1/work-items/{id}/submissions (assignee submits the CURRENT revision).
- POST /v1/work-items/{id}/reviews (task.review + assigned/eligible reviewer): submittedRevision, decision, evidence ref,
  reason mandatory for changes requested. If the revision is stale or the reviewer lost access: 409 STALE_REVIEW and NOTHING changes
  (no Done, no percentage change, no approval alert).
- Done requires criteria + required checks + (if configured) an approved review of the exact revision. Changes requested returns the
  item to IN_PROGRESS. Without required review, Done only when criteria/checks pass.
- POST /v1/work-items/{id}/reopen (reason): supersedes prior credit, keeps history; state, approval, snapshot (hook for 3.5) and outbox in one transaction.
- Race test: remove the reviewer between opening and submitting the review: write denied.

FRONTEND
Submit-for-review button, reviewer decision panel (approve / request changes with reason), review inbox (My Work, built fully in 5.3),
reopen dialog, status chips that distinguish In Review from Done. A merged PR never shows as Done.
```

**Expected outcome**
- Acceptance always refers to the exact version of the work inspected.

**Verify yourself**
- Submit revision 5 after the reviewer opened revision 4: the review fails with STALE_REVIEW.
- Reopen an accepted item: credit disappears, history stays.

---

## 3.4 Link dependencies and manage blockers (3 pts)

**Prompt**
```
Do task 3.4. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-3.md card 3.4, docs/domain-rules.md (dependencies and blockers).
Tests: T21, T24, AS-05 (dependency part), simultaneous reverse links cannot form a cycle, predecessor removal needs explicit link treatment.

DATABASE
dependencies(id, org_id, project_id, predecessor_id, successor_id, unique(predecessor_id, successor_id), check predecessor <> successor),
blockers(id, org_id, work_item_id, reason, severity NORMAL|CRITICAL, owner_id, opened_at, resolved_at, resolution, waived_by, waived_reason).

BACKEND
- Finish-to-Start only, inside one project. Reject self-links, duplicates, cycles. Serialize graph changes per project
  (SELECT ... FOR UPDATE on the project row or a Postgres advisory lock) so two concurrent reverse links cannot create a loop.
- Default: block starting a successor while its prerequisite is unfinished. If an accepted prerequisite is reopened, FLAG active
  successors for review; do not auto-reverse and never silently move dates.
- POST /v1/work-items/{id}/dependencies and /blockers; explicit resolve/remove actions. Blocked is a SEPARATE flag: clearing it never
  changes task state. Removing a predecessor requires explicit treatment of its links.
- Return "affected successors" for any change.

FRONTEND
Dependency picker on the work item drawer, blockers panel (reason, owner, severity, age), "Blocked by" and "Blocks" lists, warnings that show
affected work, critical blocker badge. Blocker age visible (feeds 5.1).
```

**Expected outcome**
- Upstream delays are visible and separate from workflow state.

**Verify yourself**
- Fire A->B and B->A simultaneously (the test does this): exactly one succeeds.
- Clear a blocker: the task keeps its state.

---

## 3.5 Calculate accepted work and snapshot it (4 pts)

**Prompt**
```
Do task 3.5. Follow the workflow in CLAUDE.md. Reuse com.prowise.domain.progress.StructuredProgress; do not reimplement the math.
Read: docs/tasks/phase-3.md card 3.5, docs/domain-rules.md (Structured numerator/denominator, snapshots, fixtures).
Tests: T27, T29, AS-03, AS-08, plus 50%, 40%, 16%, empty scope, open work at 0%, no double counting.

DATABASE
progress_snapshots(id, org_id, project_id, at, method INDIVIDUAL|STRUCTURED, numerator, denominator, value_exact, display_value,
missing_reason NOT_REPORTED|NOT_MEASURABLE nullable, baseline_id, cause, transition_marker) append-only.

BACKEND
- SnapshotService listens inside the SAME transaction as: leaf accepted, reopened, cancelled, scope approved, mode transition.
  It writes a new snapshot with value, totals, method, baseline and cause. Old snapshots are never rewritten.
- GET /v1/projects/{id}/progress-history already exists from 2.2: extend with Structured snapshots and transition markers.
- Project and parent screens show an explanation: "3 of 5 leaves accepted, 50/125 points, baseline v2".
- A merged PR or green CI never changes progress (rule 9; test it).
- Do not blend solo estimates and accepted team work into one "verified" percentage.

FRONTEND
Progress chart that draws the measurement break between methods and baseline changes, a "How is this calculated?" popover,
history table. Show Not reported / Not measurable explicitly.
```

**Expected outcome**
- Each percentage on screen is explainable, dated and tied to a baseline.

**Verify yourself**
- Reproduce AS-03 and AS-08 by hand in the UI: 50% then 100% for AS-03; 50% becomes 40% for AS-08 while the old 50% stays in history.

---

## 3.6 Switch modes and accept structured delivery (4 pts)

**Prompt**
```
Do task 3.6. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-3.md card 3.6, docs/domain-rules.md (mode changes, lifecycle gates), docs/api-contract.md (mode transitions).
Tests: T13 (both directions + injected failure), T15 (team), AS-04.

DATABASE
mode_transitions(id, org_id, project_id, from_mode, to_mode, actor_id, reason, effective_at, baseline_id, accountable_developer_id, previous_series_frozen_at).

BACKEND
- POST /v1/projects/{id}/mode-transitions (project.mode.change): preview endpoint first (remaining-scope baseline + unit), then commit.
- Individual -> Structured: ONE transaction freezes the manual series, activates the approved baseline, starts the calculated series, writes the
  transition + audit + outbox. The old 60% stays on its date; the new series is "of remaining scope"; chart shows a break.
- Structured -> Individual: reason, explicit reference baseline, ONE accountable developer; legacy items read-only; starts "Not reported" until a fresh
  check-in. Inject a failure mid-transition: method, scope and event all roll back together.
- Implement the Structured ReadinessChecker for acceptance (scope non-empty, all eligible leaves Done and accepted, critical blockers resolved or waived).
- Emit one event so manager and owner are notified once after commit (delivery is 5.2).

FRONTEND
"Change tracking method" wizard: preview, reason, confirm; transition marker on charts; team acceptance checklist and decision UI.
```

**Expected outcome**
- A project can move between modes with no data loss and with a clear record.

**Verify yourself**
- AS-04: from Individual 60%, switch with a remaining-work baseline; 60% stays on its date, a new labelled series starts.
- Kill the database connection mid-transition (the test does): the old mode and history stay intact.

**MILESTONE:** tick 3.1 to 3.6, tag `v0.2-structured`.

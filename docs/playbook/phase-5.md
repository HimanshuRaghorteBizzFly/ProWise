# Phase 5: Delivery monitoring (19 pts)

Goal: a risk can be traced through the calendar, notification, personal queue, portfolio and export. Dates, owners, evidence and permissions agree.

Build order: **5.1, 5.2, 5.3, 5.4, 5.5, 5.6.** T45 (escalation/digests) and T46 (health override) are deferred.

---

## 5.1 Explain schedule health and its causes (4 pts)

**Prompt**
```
Do task 5.1. Follow the workflow in CLAUDE.md. Pure rule logic goes in com.prowise.domain.health.HealthEvaluator (no Spring).
Read: docs/tasks/phase-5.md card 5.1, docs/domain-rules.md (Health). Skip T46 (override).
Tests: T30, AS-05 (health reason + affected item), insufficient evidence = Unknown, Git inactivity alone creates NO risk.

RULES (first match wins; KEEP ALL applicable reasons)
1 unfinished delivery past approved target = Delayed
2 overdue critical item, OR critical blocker older than 2 working days, OR comparable pace gap >= 15 points = At Risk
3 insufficient or currently stale evidence = Unknown
4 otherwise On Track
Stale is an independent flag. Accepted/cancelled/closed projects report the final outcome and do not age active risk.
Suppress pace variance when bases are incomparable (use remaining-scope dates after a mode change).

DATABASE
project_health(project_id, label, reasons jsonb [{rule, item_ref, source_time, responsible_member}], stale bool, computed_at, inputs_hash).

BACKEND
- HealthEvaluator(inputs) -> label + ALL reasons with supporting item, date, responsible person.
- HealthService recalculates on events (check-in, blocker, scope, date change) and on a scheduled sweep; one transition event per change
  (ProjectHealthChanged) via ChangeRecorder.
- GET health with reasons inside the project and portfolio read models.

FRONTEND
Health badge everywhere a project appears, reasons popover (item, due date, owner, "what to do next"), stale chip, "Unknown: no recent evidence" state.
```

**Expected outcome**
- A manager can see why a project is at risk and who can fix it.

**Verify yourself**
- Reproduce the named examples: a 70% pace vs 55% completion is a 15-point gap (At Risk).
- Add Git activity only: health does not change.

---

## 5.2 Deliver reminders, approvals and escalations (4 pts)

**Prompt**
```
Do task 5.2. Follow the workflow in CLAUDE.md. Skip configurable escalation/digests (T45 deferred).
Read: docs/tasks/phase-5.md card 5.2, docs/domain-rules.md (Notifications), blueprint section 6.10 only (search it).
Tests: T37, T38, T39, T40, reschedule a date + repeat a job + revoke access = no old duplicate or unauthorized email.

DATABASE
notifications(id, org_id, recipient_id, category, entity_type, entity_id, actor_id, reason, occurrence_key, read_at, created_at,
unique(org_id, recipient_id, channel, occurrence_key, policy_version)), delivery_attempts(id, notification_id, channel EMAIL|IN_APP,
status QUEUED|SENT|FAILED|SUPPRESSED|RETRY, provider_id, attempts, last_error), notification_preferences(user_id, category, channel enabled,
quiet_hours, timezone).

BACKEND
- Event consumers (outbox) create notifications for: assignment, mention, review requested/overdue, due, overdue, missed check-in
  (from due_occurrences in 2.3), blocker, health transition, scope/mode/target/closure. Deduplicate if one person holds several roles.
- Before dispatch re-check: work still open, date unchanged, recipient still permitted. Changing a due date invalidates pending reminders
  for the old date (occurrence_key includes the effective version).
- Preferences: user disables non-critical email, the in-app alert remains; quiet hours in the recipient's zone; urgent policy may override.
- EmailSender via Mailpit in dev. Ambiguous provider acceptance: do not blindly resend; reconcile or show uncertainty.
- GET /v1/me/notifications (cursor, unread/category), PATCH to mark read (recipient only). Every deep link reauthorizes when opened.

FRONTEND
Notification bell and inbox (read/unread, filters), deep links to the exact item (access rechecked), preferences page (categories, channels, quiet hours).
```

**Expected outcome**
- Each condition reaches each eligible person once per channel, with a working link.

**Verify yourself**
- Run the reminder job twice: one notification. Change the due date: the old reminder never fires.
- Remove a member, then trigger an event: no email is created for them.

---

## 5.3 Build portfolio, search and My Work (3 pts)

**Prompt**
```
Do task 5.3. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-5.md card 5.3, docs/screen-map.md, docs/domain-rules.md (Portfolio / read models), blueprint 6.11 (search it).
Tests: T10, T39 (links), T41, T42, usability trial (owner, state, deadline, last update, health within two interactions), empty and access-lost states.

BACKEND
- Portfolio read model: one row per PERMITTED project with lifecycle, health + causes, owner, latest task/check-in, target, method-labelled progress.
  Counts are distinct projects per category (a project can have several reasons). Filters apply BEFORE counts so every row and count come from the
  same authorized set.
- Search: PostgreSQL full-text (tsvector + GIN) over permitted projects, work items and people, always joined to the permission scope.
- My Work: my assignments, my check-ins due, my reviews (for reviewers). Removed access removes entries.
- Overview endpoint: portfolio counts, active risks, Need Attention list with who can resolve it and last-updated time.
- Every metric carries scope, time basis and unit.

FRONTEND
Overview with Need Attention (risk row opens project with owner, reason and next action), All Projects, global search, My Work, review/check-in inbox.
Specific empty messages ("No projects match your filters", "No check-in yet", "No approved work to measure"). Access-lost state returns the user to
permitted work without naming the hidden item.
```

**Expected outcome**
- A manager finds ownership and the next action in two interactions.

**Verify yourself**
- Apply a filter and compare the visible rows to the counts: they match.
- Search for a term that exists only in a project you cannot read: zero results, no hint it exists.

---

## 5.4 Show timelines and planned workload (3 pts)

**Prompt**
```
Do task 5.4. Follow the workflow in CLAUDE.md. Read-only timeline (no drag-and-drop; T26 is deferred).
Read: docs/tasks/phase-5.md card 5.4, docs/domain-rules.md (Workload), blueprint 6.11 workload row (search it).
Tests: 36 planned vs 30 available = "6 hours over"; unknown estimate shows "unestimated"; no points-to-hours conversion; moving a
predecessor never silently moves its successor; hidden projects make the total "partial".

DATABASE
work_item_estimates(work_item_id, planned_hours nullable, planned_week/date range), member_capacity(membership_id, weekly_hours, absences jsonb).

BACKEND
- Per member and week: planned hours (each assignment counted once) vs configured available hours after org calendar and absences.
  Missing capacity or estimate = unknown, never zero. When some projects are hidden from the viewer, label the visible total "partial"
  without revealing them.
- Timeline endpoint: approved project/milestone/task dates + dependency edges; warnings for affected successors.
- Authorized managers can reassign work from the workload view (uses the 3.1 reassign endpoint).

FRONTEND
Timeline view (bars by approved dates, dependency lines, warnings), People/Teams page with weekly planned vs available hours, overload highlighting,
reassign action.
```

**Expected outcome**
- Overload and delayed predecessors are visible before a deadline.

**Verify yourself**
- Enter 36 planned and 30 available hours: the screen says 6 hours over.
- Delay a predecessor: successors show a warning but keep their dates.

---

## 5.5 Produce consistent reports and CSV exports (3 pts)

**Prompt**
```
Do task 5.5. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-5.md card 5.5, blueprint 6.11 export row (search it).
Tests: T43, as-of report before and after a baseline change, report scope after access removal, formula-like data exported safely, download access rechecked.

DATABASE
export_requests(id, org_id, requester_id, report_type, filters jsonb, as_of, timezone, status, file_ref, created_at, expires_at).

BACKEND
- Portfolio, overdue, workload and acceptance reports share the SAME permission-aware queries as the screens. Parameters: period/as-of, filters,
  timezone. As-of uses the snapshot at or before the time, with its recorded method and scope; today's access rules still decide who may read it.
- CSV export is an async job (worker profile) with PINNED parameters; a re-run reuses the pinned query. CSV needs report.export, checked at
  request time AND at download time. Audit the action (scope, row count, actor).
- Spreadsheet injection protection: any cell beginning with = + - @ (and tab/CR) is prefixed safely; standard CSV quoting; test with hostile data.
- Do not mix solo estimates and accepted team progress into one verified number; label methods.

FRONTEND
Reports page (choose report, period/as-of, filters, timezone), preview table matching the export, export button with status and download.
```

**Expected outcome**
- Report screens and CSV files agree on rows, counts, timezone and filters.

**Verify yourself**
- Export, then open the CSV in a spreadsheet with a project named `=HYPERLINK(...)`: it shows as text.
- Remove report.export between request and download: download denied.

---

## 5.6 Add privacy operations and support audit (2 pts)

**Prompt**
```
Do task 5.6. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-5.md card 5.6, docs/permissions.md (operator support access).
Tests: T44, AS-07 (restricted security evidence), support grant revoked, test subject deleted, restore an old backup then replay deletions, logs contain no secrets.

DATABASE
support_grants(id, operator_id, org_id, purpose, scope, starts_at, expires_at, revoked_at), data_requests(id, org_id, subject_id, kind EXPORT|DELETE,
status, proof_ref, created_at), retention_policies(data_class, duration TBD, method) and a deletion_ledger (what was deleted, when) for replay after restore.

BACKEND
- Audit viewer API (audit.read): reconstruct a deadline change and a delivery decision (who, when, old/new, reason). A user without audit.read sees nothing.
- Time-limited support access: needs purpose, actor, tenant, expiry; auto-revoked at expiry; every use audited; no private code or file contents exposed.
- Org/account data export and deletion with status and proof; scoped file/job retention jobs; deletion replay after a restore.
- Verify routine logs contain no secrets or private code (test).

FRONTEND
Audit page (filters, detail drawer), support access requests and active grants (admin), privacy requests (export/delete) with status.
```

**Expected outcome**
- You can investigate an incident and honor data requests with proof.

**Verify yourself**
- As a viewer without audit.read: the audit page is 403/hidden and the API returns nothing.
- Let a support grant expire: access ends and the attempt is audited.

**MILESTONE:** tick 5.1 to 5.6, tag `v0.4-monitoring`.

# Phase 5: Delivery monitoring (19 pts)
Exit check: a risk can be traced through calendar, notification, personal queue, portfolio and export. Dates, owners, evidence and permissions agree.

## 5.1 Explain schedule health and its causes (4 pts)
Requires: 2.3, 2.4, 3.4, 3.5. Enables: 5.2, 5.3, 5.5. Trace: FR-030, FR-046(skip), D06.
**Build:** Workday pace, critical overdue items/blocker age, staleness, approved-date delay. Keep raw reasons, source times.
**Pass when:**
- T30: simulate missed check-in, overdue project, overdue critical task -> applicable label, reasons, supporting item, responsible person.
- AS-05: specific health reason + affected item; one alert per occurrence/channel.
- Insufficient evidence shows Unknown. Git inactivity alone never creates risk. Rule order is in `docs/domain-rules.md`.

## 5.2 Deliver reminders, approvals and escalations (4 pts)
Requires: 1.4, 2.3, 3.3, 5.1. Enables: 5.3, 6.1. Trace: FR-037..040, FR-045(skip).
**Build:** In-app + email with preference, quiet-hour and urgency rules, idempotent scheduling, current access checks, failed-delivery handling.
**Pass when:**
- T37: trigger upcoming/overdue/missed-check-in rules; changing a due date invalidates pending reminders for the old date.
- T38: assign work, raise blocker, request review, change critical status -> each eligible recipient gets each event once per channel.
- T39: read/unread persists; link opens exact item and rechecks access after role change.
- T40: user disables noncritical email, in-app alert remains; quiet hours, urgent policy, retry history honored.
- Reschedule a date, repeat a job, revoke access: no old duplicate or unauthorized email.

## 5.3 Build portfolio, search and My Work (3 pts)
Requires: 1.3, 2.2, 3.5, 4.3, 5.1, 5.2. Enables: 5.5, 6.1, 6.2. Trace: FR-010, FR-039, FR-041, FR-042.
**Build:** Overview + Need Attention, filtered All Projects (cards/list), permission-scoped search, My Work, review/check-in inbox. Show each metric's definition and update time.
**Pass when:**
- T10: combine owner/team/health/target/lifecycle/mode filters; every row and count matches the same authorized set.
- T41: Overview -> risk row shows owner, reason, corrective next action in context.
- T42: developer sees own assignments + check-ins; authorized reviewer also sees pending reviews; removed access removes entries.
- Usability: owner, state, deadline, last update, health found within two interactions. Test empty and access-lost states.

## 5.4 Show timelines and planned workload (3 pts)
Requires: 1.2, 2.3, 3.1, 3.4. Enables: 5.5, 6.1. Trace: FR-024, FR-026(skip), M07, M09.
**Build:** Approved project/milestone/task dates + dependencies; weekly planned vs available hours per member/team for permitted projects. Missing effort explicit.
**Pass when:** 36 planned vs 30 available -> "6 hours over". Unknown estimates show as unestimated; no points-to-hours conversion. Moving a predecessor never silently moves its successor.

## 5.5 Produce consistent reports and CSV exports (3 pts)
Requires: 1.3, 3.5, 3.6, 5.1, 5.3, 5.4. Enables: 5.6, 6.1, 6.2. Trace: FR-029, FR-041, FR-043, M10.
**Build:** Period/as-of reports, separate measurement methods, shared filters, authorized portfolio/overdue CSV and audit exports. Protect spreadsheet cells.
**Pass when:**
- T43: export filtered portfolio + overdue work; match visible records; protect cells starting with `= + - @`; recheck download access; audit the action (scope, row count, actor).
- As-of report before/after a baseline change is correct. Report scope after access removal is correct. Formula-like user data exports safely.

## 5.6 Add privacy operations and support audit (2 pts)
Requires: 1.3, 1.4, 4.4, 5.5. Enables: 6.1, 6.2, 6.3. Trace: FR-007, FR-044, NFR-06, NFR-10.
**Build:** Restricted audit views, temporary support access, org/account data export and deletion, job/file retention, deletion replay after restore.
**Pass when:**
- T44: permitted auditor reconstructs a deadline change and delivery decision; viewer without audit permission cannot see restricted entries.
- Revoke a support grant, delete a test subject, restore an old backup. Check approved policy before reopening data. Routine logs contain no secret or private code.

## Matching blueprint test rows

| Test | Name | Expected result |
|---|---|---|
| T10 | Filter the portfolio | Combined filters and counts match the same authorized set. |
| T28 | Label the reported figure | Reported method and capture time remain visible in portfolio/detail/report. |
| T30 | Explain health and staleness | Applicable label, reasons, supporting item and responsible person are shown. |
| T37 | Scheduled reminders | Due-date changes invalidate old reminders and scheduled rules fire once. |
| T38 | Actionable event notifications | Eligible recipients receive each applicable event once per channel. |
| T39 | Inbox and deep links | Read state persists and links reauthorize after access changes. |
| T40 | Email and in-app preferences | Noncritical email can be disabled while permitted in-app alerts remain. |
| T41 | Overview and Need Attention | Risk row shows owner, reason and corrective next action in context. |
| T42 | My Work and review inbox | Assignment/review visibility follows current permission and revocation. |
| T43 | Export authorized CSV | Export matches visible rows, protects formula-like cells, rechecks access and audits action. |
| T44 | Organization and project audit | Authorized auditor can reconstruct changes; viewer cannot see restricted audit rows. |
| T45 | Configurable escalation and digests | Deferred by D12. |
| T46 | Temporary health override | Deferred by D12. |
| AS-05 | Upstream work is late | One specific health reason and one alert per occurrence/channel. |
| NFR-01 | Availability | Agreed monitored availability and failed-health reporting are evidenced. |
| NFR-02 | Read latency | Standard reads are benchmarked against agreed p95 target. |
| NFR-03 | Capacity | Production-like seed and agreed concurrency are benchmarked. |
| NFR-05 | Disaster recovery | Restore demonstrates agreed RPO/RTO. |
| NFR-10 | Retention | Data-class retention, deletion and restored-data treatment are evidenced. |

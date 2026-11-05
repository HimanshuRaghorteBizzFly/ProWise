# Domain rules (progress, lifecycle, calendar, health)

Server owns calculations. Implement as pure Java classes in `com.<org>.delivery.domain` with no Spring dependencies.

## Lifecycle (canonical categories)
`Planned -> Active <-> On Hold -> (Awaiting acceptance) -> Delivered -> Closed`, plus `Cancelled`. `Archived` is a separate read-only flag (restore returns previous lifecycle).

| Transition | Gate |
|---|---|
| Planned/Active/On Hold | Permitted PM; audit record with local effective time + reason. While On Hold pause missing-check-in reminders. |
| Active -> Awaiting acceptance | Individual: latest applicable report = 100%. Structured: scope non-empty and all eligible work meets Done rules. Request is bound to an exact check-in/baseline version. Zero scope cannot satisfy acceptance. |
| Awaiting -> Delivered | Authorized approver accepts evidence + checklist. Critical blockers resolved or explicitly waived (actor + reason). Reject outdated baseline/report. Changes requested does not change lifecycle. |
| Delivered -> Closed | Handover, authorized actor, date, reason/reference. One UI action may do both only if both gates + permissions pass and both events are recorded. |
| Cancel / Archive | Cancel = reasoned decision. Archive stops edits, suppresses reminders, keeps history. Restore recomputes future occurrences once, no stale email backlog. |
| Correction after acceptance | Needs explicit authorized reopening + audit before edits. Accepted revision and closure retained. New delivery needs fresh approval. |

## Task workflow
`To Do -> In Progress -> In Review -> Done` (when review required). Changes requested -> back to In Progress. No required review: Done only when criteria/checks pass. `Blocked` is a SEPARATE flag with owner, reason, severity, timestamps (clearing it never changes task state). Cancelled work keeps its scope treatment until an approved baseline change.

## Hierarchy
Project -> (optional milestone) -> (optional deliverable) -> task -> subtask. Max 5 levels including project. Reject cross-project parents, loops, invalid levels. Draft rows may be incomplete; active measurable leaves need primary assignee, approved weight, criteria.

## Progress methods (never mix into one "verified" number)
**Individual value:** latest accepted eligible check-in by revision sequence. Default submission accepted immediately; optional verification holds proposed figure pending (show last accepted + separate pending). Missing = "Not reported". Downward revision needs a reason. Label always `Developer reported` + time, even if verified. 100% does NOT close delivery.

**Structured numerator:** sum of weights of eligible LEAF work that is Done and satisfies all criteria + required review/checks. Parent never earns credit. Reopened or cancelled leaf earns 0.
**Structured denominator:** sum of positive weights in the ACTIVE approved baseline (cancelled item stays until authorized removal). One unit only. Reject mixed, zero, negative weights.
**Rounding/display:** compute from exact totals, round only for display. 100% only when non-empty numerator == denominator. Zero denominator = `Not measurable`. Non-empty with zero accepted = 0%.
**Snapshots:** on material change store value, numerator/denominator, method, baseline id, time, cause. Never rewrite old snapshots.

### Executable fixtures (write these as tests first)
1. Leaves 20, 30, 50; first two accepted -> 50/100 = 50%.
2. Approve +25 point leaf -> 50/125 = 40%. Earlier 50% snapshot unchanged (old baseline).
3. Reopen the 30 leaf -> 20/125 = 16%.
4. Empty eligible set -> Not measurable.
5. Open eligible work, none accepted -> 0%.
6. Cancelled leaf stays in denominator until authorized removal.
7. Parent with accepted children does not add its own credit.
8. Mode transition: Individual 60% -> Structured with approved remaining-work baseline: 60% stays on its date; new series starts from accepted leaves; chart shows a break; label "of remaining scope".

## Mode changes
**Individual -> Structured:** preview remaining-scope baseline + unit; authorized PM approves reason + effective time. ONE transaction: freeze manual series, activate baseline, start calculated series, write transition + outbox. Notify PM and owner after commit.
**Structured -> Individual:** authorized reason, explicit reference baseline, one developer. Freeze legacy items read-only, keep links/snapshots. Start "Not reported" until a fresh check-in. Failure rolls back method, scope and event together.

## Scope versions
Immutable approved baselines: unit, effective time, reason, author, approver, leaf ids + weights. One active baseline (concurrent approvals cannot activate two). Scope approval changes the denominator; reopening removes credit immediately. Splitting an accepted leaf proposes a scope change.

## Dependencies and blockers
Finish-to-Start only, inside a project. Reject self-links, duplicates, cycles (also under concurrent requests: serialize graph changes per project). Default: block starting a successor while prerequisite is unfinished. If accepted prerequisite reopens, FLAG active successors for review (do not auto-reverse). Never silently move dates. Removing a predecessor requires explicit treatment of its links.

## Review rules
Bind submission to work revision + criteria/evidence version. Reviewer approves or requests changes (reason mandatory). Stale or unauthorized decision changes nothing (409 `STALE_REVIEW`). State, approval, snapshot, outbox in one transaction when credit changes. Reopen needs reason; invalidates credit, keeps history.

## Calendar and cadence
- Instants in UTC. Date-only target stays on time through that LOCAL project date; overdue starts at first instant of next local date. Derive boundaries from local dates at DST, not +24h.
- Org calendar: workdays and holidays.
- One cadence per project: daily, weekly (default), fortnightly. Grace = 1 working day.
- Example: Friday check-in + 1 working day grace, Monday holiday -> Tuesday is the grace day; send missed reminder only after cutoff.
- Rough pace = elapsed completed planned working days / total planned working days x 100, clamped 0-100. Exclude days off. No comparable baseline -> "pace unavailable".
- New deadline supersedes future alert occurrences; keep old/new date + reason. Never two live occurrences for one due window.

## Health (first match wins; keep ALL applicable reasons)
1. Unfinished delivery past approved target -> **Delayed**
2. Overdue critical item, OR critical blocker > 2 working days, OR pace gap >= 15 points -> **At Risk**
3. Insufficient/stale evidence -> **Unknown**
4. Else **On Track**
Stale flag is independent. Git inactivity alone creates NO risk. Accepted/cancelled/closed: report final outcome, do not age active risk. Example: 70% pace vs 55% comparable completion = 15-point gap. Suppress pace variance when bases are incomparable.

## Workload
Per member per week: planned hours (assigned once) vs configured available hours (after calendar/absence). Example: 36 planned vs 30 available = 6 over. Unknown estimate = "unestimated". No points-to-hours conversion. Hidden projects -> label total "partial" without revealing them.

## Notifications
Unique key = org + recipient + channel + condition/occurrence + effective version. Confirm work still open and date unchanged before dispatch. Permission re-check before creating private content. Old inbox link reauthorizes when opened. Removed member gets no new private content.

## Files
Request upload for permitted entity -> enforce type/size -> verify bytes -> quarantine -> scan -> Clean/Rejected. Scan error fails closed. Only Clean files get a short-lived private download after access check. Mention never grants access.

# Project Delivery Management SaaS: Software Requirements and Development Blueprint

**Version 1.1 / Final document / 2 November 2026**
Project Delivery / Engineering, Product Handbook 02: Development and QA

## What engineers are building

A secure web workspace for software delivery. It supports one accountable developer with no compulsory tasks, or a structured team with weighted, approved work. Evidence from GitHub is displayed separately from completion.

## Where to start

Begin with tasks 0.1 to 0.4. Agree the release decisions, roles, measurement examples and test setup. Then implement organization boundaries before any project, repository, file or report can be shared.

## Contents (original page references)

| Page | Contents |
|---|---|
| 02 | Update build progress: 32 numbered implementation tasks, seven phases and one 100 point tracker |
| 07 | Read system and API contracts: implementation rules, worked requests, permissions, events, failure handling and data structures |
| 41 | Find the test for a requirement: 46 functional checks, 12 quality requirements, eight end-to-end scenarios and the release gate |
| 04 | Roles and access: eight user types with project and organization boundaries |
| 19 | Project and integration endpoints: inputs, permission checks, conflicts, examples and replay behavior |

---

# 1. Build progress tracker (page 2)

*Delivery planning: update this page through the task cards.*

This tracker measures delivery of this SaaS. Starting values reflect the absence of implementation evidence in the supplied documents. Weights are planning estimates of work to build and verify.

**Summary (all start at zero):**

| Overall complete | Work remaining | Blocked tasks | Past target date |
|---|---|---|---|
| 0% | 100% | 0 | 0 |

| Phase | Name | Tasks | Weight | Earned | Phase % |
|---|---|---|---|---|---|
| 0 | Policy and design | 4 | 8 pts | 0 | 0% |
| 1 | Workspace foundation | 4 | 14 pts | 0 | 0% |
| 2 | Projects and Individual Ownership | 4 | 14 pts | 0 | 0% |
| 3 | Structured delivery | 6 | 21 pts | 0 | 0% |
| 4 | Repositories and evidence | 4 | 13 pts | 0 | 0% |
| 5 | Delivery monitoring | 6 | 19 pts | 0 | 0% |
| 6 | Validation and rollout | 4 | 11 pts | 0 | 0% |
| | **Total** | **32** | **100 pts** | | |

**One example.** Task 0.1 earns 2 points. If that task alone is accepted, phase 0 is 2/8 = 25%, the project is 2% complete and 98% remains. Phase % = earned points ÷ phase weight × 100. Overall % = sum of earned points.

**When to award credit.** Only Completed tasks with accepted prerequisites, evidence in the notes and a valid actual completion date earn their weight. A reopened prerequisite also suspends dependent credit. Not Started, In Progress and Blocked earn zero. For an optional feature, record its authorized disposition and test all selected behavior.

**Editing the tracker.** Enter assignee, optional target, completion date (YYYY-MM-DD), status and evidence on the task cards. Supported PDF readers recalculate after leaving a field. Other readers can use the same fields and update the summary manually. An unfinished task past an agreed target is overdue.

---

# 2. Navigation and traceability (page 3)

## Twelve modules in one project

Module IDs are shared by both documents. The stakeholder guide explains the user journey. The SRS keeps the original FR and NFR identifiers and adds numbered development tasks.

| Module | Name | Main user | Key build tasks |
|---|---|---|---|
| M01 | Workspace, people and access | Owner and Admin | 1.1–1.4 |
| M02 | Portfolio and project setup | Project Manager | 2.1, 5.3 |
| M03 | Individual Ownership | Accountable developer | 2.2–2.4 |
| M04 | Structured work and scope | Project Manager and Team Lead | 3.1–3.2, 3.5 |
| M05 | Review, evidence and collaboration | Developer and QA | 3.3, 4.4 |
| M06 | Progress history and mode changes | Project Manager | 2.2, 3.5–3.6 |
| M07 | Deadlines, dependencies and health | Project Manager and Team Lead | 2.3, 3.4, 5.1 |
| M08 | Repositories and engineering activity | Admin and project team | 4.1–4.3 |
| M09 | My Work, workload and notifications | Every member within their scope | 5.2–5.4 |
| M10 | Reports and exports | Authorized manager or viewer | 5.3, 5.5 |
| M11 | Delivery acceptance and closure | Authorized delivery approver | 2.4, 3.6, 6.4 |
| M12 | Audit, support and release operations | Admin, security and restricted operator | 1.4, 5.6, 6.1–6.4 |

---

# 3. Role and permissions (page 4)

## Who can do what

Role names are starting templates. A person must also hold an active membership, an applicable permission and access to the specific organization or project.

| Role | Typical responsibility | Boundary to verify |
|---|---|---|
| Organization Owner | Create the workspace, name admins, set organization policy and approve integrations. | Transfer ownership only to an eligible active member after confirmation; preserve one organization owner. |
| Organization Admin | Invite/disable members, manage teams, permitted roles and workspace integrations. | Cannot transfer ownership or grant powers outside their own authority. |
| Project Manager | Create projects within scope, appoint an accountable owner, plan dates, approve scope or mode changes and coordinate delivery. | Needs the relevant project permission to waive, accept or close. Role names alone grant nothing. |
| Team Lead | Manage assigned team work, dependencies, reviews and allocation. | Cannot browse another team or organization solely because they are a lead. |
| Developer | Edit assigned work, flag blockers, link evidence and submit check-ins when accountable for an Individual project. | Cannot approve another person's work without review permission. Cannot change approved scope by editing a task. |
| QA / Reviewer | Inspect assigned submissions, approve the exact revision or request corrections with a reason. | A role on one project does not grant access to another project's evidence. |
| Viewer / Stakeholder | Read permitted summaries, timelines and reports. | No edits. Export requires a separate permission even when on-screen reading is allowed. |
| Platform Operator | Monitor queues, backups and service incidents. | Tenant support access needs a time limit, reason, restricted scope and audit record. |

---

# 4. Navigation: screens and entry points (page 5)

## Where each person starts

The organization picker sets the company for search, counts, projects and notifications. Every link opens within the user's current access.

| Screen | What the user sees and does |
|---|---|
| Overview | Portfolio counts, active risks and Need Attention. Select a reason to open the affected project or work item. Show who can resolve it and when the data was last updated. |
| All Projects | Switch between list and cards, save filters, search, sort, create, archive or restore as permitted. Filter by owner, team, lifecycle, health, deadline and mode. |
| Individual project | Overview, Updates, Repositories, Activity and Settings. Show target date, last report, reported percentage and blockers. Tasks are optional; avoid presenting an empty board as required work. |
| Structured project | Overview, Breakdown, Board, Timeline, Repositories, Activity and Settings. From a leaf item open criteria, responsible people, dependencies, review, discussion and files. |
| My Work and Notifications | View assignments, deadlines, requested reviews, check-ins due, read/unread alerts and links to act. Only show work the user may still access. |
| Timeline, Teams and People | Explore planned dates and blocked successors. View roster, availability and known planned hours for a selected week; authorized managers can reassign work. |
| Repositories and Reports | Admins link and verify GitHub installations. Members see permitted activity. Managers open portfolio, overdue, workload or acceptance reports and export within their permissions. |
| Settings and Activity | Set policies, work calendars, roles, integrations and preferences. Project activity tells the working story. Restricted audit records identify material decisions and who made them. |

**Empty or restricted screens.** Use a specific message: *No projects match your filters*, *No check-in yet*, *No approved work to measure*, or *GitHub disconnected*. If access was withdrawn, offer a return to permitted work without revealing the hidden item.

---

# 5. Document control: gaps resolved in version 1.1 (page 6)

These gaps affect how the software behaves. Proposed defaults need owner signoff. The original documents supply no implementation or pilot evidence.

| What the originals left open | V1.1 rule or proposed decision | Verification |
|---|---|---|
| Paused, Closed and Archived were used differently across the two documents. | Use On Hold for paused work; the authorized decision marks Delivered, administrative closure marks Closed, and archiving independently makes a record read-only. Product confirms D01. | T14–15 / AS-02 |
| Who can correct a solo estimate, and which number appears while a review is pending? | The accountable developer appends a correction. Show last accepted value and a separate pending value when verification is enabled. A manager verification preserves the reported method. D02. | T17–18 / T28 |
| Adding, splitting or cancelling leaves could distort completion. | Version the eligible leaf list and its one unit. Scope approval changes the denominator; reopening removes credit immediately. A scope change or mode transition never rewrites an older snapshot. D03/D07. | T13 / T25 / T27–29 |
| A repository or user identity may match more than one project or person. | Require an authorized installation, selected repo, explicit member identity and a unique task match. Leave ambiguous activity unassigned. Missing upstream deliveries need deliberate recovery. D08. | T31–35 / AS-06 |
| Different calendar cutoffs could change risk or send duplicate reminders. | Define project-local date boundaries, workday grace, health rule precedence and a new occurrence version after rescheduling. Invalidate obsolete pending sends. Confirm thresholds in D05/D06. | T30 / T37–40 |
| A saved role or link can outlive the access it originally represented. | Reauthorize searches, jobs, downloads and alerts. Separate normal handover from immediate emergency disable. Private attachments remain quarantined until scanned. D09/D10. | T05–07 / T23 / AS-07 |
| Reporting could mix incomparable figures or hide missing capacity. | Label method, baseline, time and coverage. Workload uses planned and available hours only; flag unknown inputs and visible-only totals. Reapply export permission at download. D09. | T28–29 / T41–43 |
| The original roadmap did not let the team record evidence for each build step. | Use one numbered build tracker, source-linked tests, separate stakeholder decisions and a versioned change record. Weight measures accepted work, never elapsed time or a target date. | Tasks 0.1–6.4 |

---

# 6. Implementation contracts

## 6.1 How the application fits together (page 7)

Build a modular web application with a Spring Boot worker profile for delayed or repeatable jobs. The browser presents information; the server owns permissions, state changes and calculations.

| Component | Responsibility and proposed stack |
|---|---|
| Web client | Next.js, React and TypeScript; Tailwind and accessible component primitives. Responsive desktop-first layout with keyboard alternatives for board interactions. Share labels and validation messages with the contract. |
| Authenticated API | Spring Boot 3 (Java 21), Spring Web REST controllers and Spring Security method security for Identity, Organizations, Authorization, Projects, Work, Progress, Integrations, Notifications, Reporting and Audit. Resolve membership on every request. Keep core progress/health rules in pure Java domain classes. |
| Transactional store | PostgreSQL 16. Spring Data JPA (Hibernate) with Flyway migrations in `apps/api/src/main/resources/db/migration`; Flyway SQL is the data-model source of truth. Use stable IDs, tenant-bound references and JPA `@Version`. Commit business state, history and outbox together. |
| Background worker | PostgreSQL-only durable event receipt/outbox; Spring `@Scheduled` pollers with ShedLock (JDBC) handle webhooks, reconciliation, reminders, exports and email retries. Consumers handle duplicates independently of polling. |
| External services | Managed OIDC with session controls, approved transactional email provider, scoped GitHub App and private S3-compatible storage. Require short-lived signed uploads/downloads and a scanner. Keep secrets in a managed vault. |
| Deployment | Managed containers, PostgreSQL 16; independent web/API and worker-profile instances of the Spring Boot app. GitHub Actions has a Java 21/Maven build-test job with PostgreSQL service and a separate web lint/typecheck/build job. OpenTelemetry traces plus centralized safe logs and error monitoring. |

**Request example.** A reviewer clicks Approve. The API verifies workspace, reviewer, item and JPA version; a Spring `@Transactional` service commits the decision, progress snapshot and outbox event; a scheduled poller creates the permitted alert. A retry reuses the event identity.

Use Jakarta Bean Validation (`@Valid`) on DTO records and springdoc-openapi for the API specification; generate web client types from that specification. Add a servlet request-ID filter with SLF4J MDC, echo `X-Request-Id` in every response and error body, and use a Logback masking converter for tokens, passwords, cookies and authorization headers. Idempotency is implemented by a `OncePerRequestFilter` or interceptor storing the request hash and response in PostgreSQL.

## 6.2 Authorization and workspace boundaries (page 8)

**Permission = authenticated identity + active membership + scoped permission + allowed relationship to this object + allowed action in its current state.** Run the check at the server on every access path.

| Permission group | Examples and enforcement |
|---|---|
| Organization and people | `org.manage`, `member.invite`, `member.disable`, `role.manage`, `team.manage`. Owner transfer is separately restricted. Resending rotates the invite; store a protected single-use token, expiry and target org/email. Revoke immediately. |
| Project and scope | `project.create/read/edit/archive`, `project.mode.change`, `project.scope.change`, `project.deadline.edit`. Check membership and project binding, not trusted `org_id` in the request body. Enforce one accountable owner reference. |
| Work and progress | `project.progress.report` only for accountable developer in Individual mode. `project.progress.override` requires a separate correction/decision entry. `task.create/assign/update/review` are scoped to project, assignment and review policy. |
| Private resources | `repo.connect/read`, `report.export`, `audit.read` and separate closure/waiver rights as agreed. Authorize per file, export, notification and repo. Recheck privilege at job execution, link issuance and download. |
| Operator boundary | Time-limited support elevation needs purpose, actor, tenant and expiry. Keep private code, tokens, file contents and unrelated tenant data out of routine logs. Revoke access at expiry. |

**Revocation and handover.** On normal departure, transfer owned projects and work to eligible replacements atomically where possible. Emergency disable/role revocation must take effect immediately, including cached sessions and background work. Preserve ownership history; an unresolved assignment is flagged *Owner unavailable* for the PM. Block new owner-only actions until replacement.

**Race test.** Remove a reviewer between opening and submitting a review, and remove `report.export` between requesting and downloading a CSV. Both writes/downloads are denied; history remains visible to authorized colleagues.

## 6.3 Data model: delivery and people (page 9)

All tenant-owned records carry `org_id`, indexed with the object key. Use UUID/ULID internal IDs and an organization-unique human project key. Use foreign keys or equivalent composite validation for same-tenant and same-project relationships.

| Entity group | Keys, fields and invariants |
|---|---|
| organizations / users / memberships | Organization slug, timezone, work calendar, state. Identity-linked users. Membership unique by organization and user; active/disabled status. Last owner cannot disappear through self-demotion. |
| roles / grants / teams / invites | Role scope org/project, grantable permission keys and membership bindings. Team members and lead must belong to org. Invite target, hashed token, expiry, accepted/revoked timestamps. |
| projects / project_members | Key, scope description, PM, accountable developer/owner, mode, lifecycle, start/target dates, IANA timezone, calendar reference, priority, version, active baseline, archive flag and prior lifecycle. Maintain ownership and deadline change history. |
| work_items / dependencies | Project, parent, type, title, primary assignee, reviewer, collaborators, state, criteria version, criticality and due date. Edges are unique within project, predecessor → successor, no cycle. Store separate blockers with reason, owner, severity, open/resolved times. |
| scope_versions / scope_leaves | Immutable approved baseline with unit, effective time, reason, author/approver. Membership rows contain leaf ID and weight as approved. One active baseline; retain superseded baselines and past snapshots. |
| checkins / snapshots / transitions | Check-in: author, revision_of, submitted/verified status, percent, summary, next steps, blockers, projected finish and evidence. Snapshot: org/project, instant, method, numerator/denominator if calculated, value or missing reason, baseline and cause. Transition stores old/new modes and actor. |
| reviews / acceptance / waivers | Item review references exact revision and criteria. Project acceptance references scope/check-in version, checklist, decision, actor, evidence and waivers. Store closure separately. Material edits must invalidate stale pending submissions. |

## 6.4 Data model: events and reporting (page 10)

Keep delivery evidence, service diagnostics and user-visible activity separate. Each record needs a stable identity and an authorized route back to its project.

| Entity group | Required relationship and behavior |
|---|---|
| installations / repos / links | Installation bound to organization and provider account, selected permissions, revoked flag, sync cursor/time. Immutable provider repo ID and name; project-repo is many-to-many within authorized scope. Contributor identities require an explicit org membership link. |
| webhook_receipts / git_events | Unique delivery ID under provider/integration identity; event, action and limited payload reference. Track process state and attempts. Normalize upstream object/version separately from receipt, so replay cannot duplicate an effect. Link work by verified key or explicit association. |
| comments / attachments | Scoped project or task, actor, timestamps, safe text and mentions. Attachment ID, object key, owner entity, byte size, detected type, scan/retention state and expiry. Upload references never grant cross-tenant access. |
| calendar / commitments | Workdays, holidays, IANA zone, project due date and history. Cadence/grace/reminder policy version. Planned hours by person/week and scoped work, capacity reference, absence/adjustments when supplied. No automatic equivalence between points and hours. |
| notifications / delivery_attempts | Notification recipient, tenant, category, entity, actor, reason, event/occurrence and read timestamp. Unique per occurrence, recipient, channel and policy/date version. Delivery attempt and result history use provider IDs where available. |
| audit / activity / outbox | Immutable safe audit facts: actor, reason, timestamps, previous/new value and target. Materially different audience from the activity feed. Outbox carries stable event and aggregate version; consumer checkpoints and retry records track effects. |
| exports / read models | Export request, workspace, author, filters/timezone/as-of, policy, status and private file reference. Project summaries carry method, value, dated scope and last successful refresh. Rebuild projections from business history; do not overwrite historical snapshots. |

**Practical indexing.** Index org/project/status, org/member/week, project/snapshot time, org/due cutoff, installation/delivery ID and pending outbox/next attempt. Use deterministic cursor ordering with a unique ID tie breaker.

## 6.5 Lifecycle, settings and delivery decisions (page 11)

Proposed reconciliation **D01**: use a canonical lifecycle category behind any configurable display label. Archive is a separate read-only flag; Awaiting acceptance is a review condition.

| Transition | Gate and recorded change |
|---|---|
| Planned / Active / On Hold | A permitted PM starts, pauses or resumes work with an audit record. While On Hold, pause configured missing-check-in reminders; retain date warnings according to policy. Save local effective time and reason. |
| Active → awaiting review | For Individual, latest applicable report reaches 100%. For Structured, agreed scope is nonempty and all eligible work meets its Done rules. Request against an exact check-in/baseline version. Zero scope cannot satisfy acceptance on its own. |
| Request → Delivered | Authorized approver accepts evidence and checklist. Resolve or explicitly waive critical blockers with actor and reason. Reject an outdated baseline or report; record changes requested without changing lifecycle. Scope reduction needs its own approval. |
| Delivered → Closed | Record handover, authorized actor, date and reason/reference. A single UI action may request both decisions only if both gates and permissions pass and both events are recorded. |
| Cancel or archive | Cancellation is a reasoned lifecycle decision. Archive prevents edits and suppresses operational reminders without invalidating history. Restore the previous lifecycle, recompute future occurrences once and avoid a backlog of stale emails. |
| Corrections after acceptance | Proposed rule: a material change requires an explicitly authorized reopening and audit entry before work edits. Retain accepted revision and closure. A new delivery needs fresh approval; do not rewrite the original release record. |

**Task workflow.** To Do → In Progress → In Review → Done when review is required. Changes requested returns to In Progress. Without required review, allow Done only when criteria/checks pass. Blocked is a separate flag with owner and reason. Cancelled work retains its scope treatment until an approved baseline change.

## 6.6 Progress, scope and mode changes (page 12)

Keep the product's two measurement methods and the engineering workbook's progress distinct. Never use Git activity, percent of elapsed time or counts of opened tasks to set a delivered-work percentage.

| Question | Implementation rule |
|---|---|
| Individual value | Use the latest accepted eligible check-in by recorded revision sequence. Default submission is immediately accepted; optional verification holds a proposed figure pending. Missing = Not reported. A downward revision requires explanation. Keep method, author and time, even if verified. |
| Structured numerator | Sum weights of eligible leaf work that is Done and satisfies all configured criteria and required review/checks. If a deliverable is itself the lowest measurable work, it counts once; when split the parent becomes an aggregate. A reopened or cancelled leaf earns zero. |
| Structured denominator | Sum positive weights in the active approved baseline including accepted leaves. A cancelled item stays planned until an authorized removal. Use one comparable unit: effort, explicit points, or equal weight 1 throughout. Reject mixed, zero or negative leaf weights. |
| Snapshots and rounding | Calculate using original totals; round only for display. Display 100% only on an actually complete nonempty numerator/denominator; retain true totals and exact value. A zero denominator is Not measurable. Nonempty with zero accepted work is 0%. |
| Individual → Structured | Preview a remaining-scope baseline and its unit. Authorized PM approves reason and effective time. In one transaction freeze the manual series, activate the baseline and start the calculated series. Show "of remaining scope" and a chart break. Notify PM and owner after commit. |
| Structured → Individual | Require authorized reason, explicit reference baseline and one developer. Freeze legacy items read-only and preserve their links/snapshots. Start Not reported until the fresh applicable check-in. A failure rolls back method, scope and event together. |

**Reference fixture.** Design 20 and API 30 accepted; Release 50 in review: 50/100 = 50%. Approve 25 extra points: 50/125 = 40%. Reopen API: 20/125 = 16%. Earlier snapshots retain their original values and baselines.

## 6.7 Work, reviews, dependencies and files (page 13)

A work item has one identity across its list, board, timeline, review, comments and evidence. Every view calls the same state and scope rules.

**Allowed hierarchy.** Project contains direct tasks, or optional milestones and deliverables. A milestone can contain deliverables or direct tasks, a deliverable can contain tasks, and a task can contain subtasks. Maximum five levels including project. Reject cross-project parents, loops and invalid levels. Draft rows may be incomplete; active measurable leaves need a primary assignee, approved weight and criteria.

**Review races.** Bind submission to a work revision plus criteria/evidence version. A required reviewer approves or requests changes. Proposed default separates submitter and reviewer for gated items; configure roles and any permitted exceptions at D04. A stale or unauthorized decision changes nothing. Update state, approval, snapshot and outbox in one transaction when credit changes.

**Dependency and blocker controls.** Finish-to-Start only inside the project. Reject self-links, repeats and cycles even across concurrent requests; serialize graph changes per project or provide equivalent isolation. Proposed default blocks starting a new successor while its declared prerequisite is unfinished. If prior accepted work reopens, flag affected active successors for review without reversing their state automatically. Never silently move dates.

**Safe removal and reassignment.** Use authorized soft retirement and an explicit scope decision for planned work. Surface dependent links before retirement; require removal or reassignment of affected edges. Reassigning a primary owner keeps old/new assignee, actor, time and relevant notification.

**File lifecycle.** Request upload for a permitted entity; enforce approved type/size, verify actual bytes, quarantine, scan and mark Clean/Rejected. Fail closed on scan error. Only clean evidence can be issued a short-lived private download after access checks. Deny new links immediately after revocation. If policy needs immediate invalidation of existing links, use a revocable/proxied download route.

**Comments and mentions.** Encode user content for display, keep history under approved retention and reauthorize every read. Mentioning someone does not expose an inaccessible parent or file. Use only the project-allowed recipients even in email previews.

## 6.8 Working calendars and health rules (page 14)

Proposed deterministic rules for D05/D06. Store instants in UTC and retain the local date and IANA zone for date-only commitments. User display time never changes the project's cutoff.

| Rule | Calculation or behavior |
|---|---|
| Date boundaries | A date-only target remains on time through that local project date; overdue begins at the first instant of the next local date. Count workdays and holidays under the org calendar. Derive new boundaries from local dates at DST changes, not by adding 24 hours. |
| Cadence and pace | One active reporting cadence per project: daily, weekly (default) or fortnightly. Proposed grace is one working day. Rough pace = elapsed completed planned working days / total planned working days × 100, clamped 0–100. Exclude days off; if no valid/comparable baseline show pace unavailable. |
| Ranking of signals | First, unfinished delivery past approved target = **Delayed**. Next, overdue critical item, critical blocker >2 working days or comparable pace gap ≥15 percentage points = **At Risk**. Otherwise insufficient/currently stale evidence = **Unknown**. Else **On Track**. A stale flag is independent; retain all applicable reasons even when a stronger label wins. |
| Exceptions and overrides | For delivery accepted/cancelled/closed, report final outcome or historical health; do not keep aging active risk. Pause missing-update reminders on hold when configured. A manager override, if enabled, needs reason, author and expiry. Show computed result and underlying late facts together; do not suppress substantive alerts. |
| Named examples | Friday check-in plus one working day of grace, Monday a holiday: Tuesday is the grace day; send a missed reminder only after its cutoff. A 70% rough pace versus 55% comparable completion is a 15-point gap. Git inactivity alone creates no risk. |
| Scope/mode changes | Preserve past schedule and progress versions. For remaining-work scope use its agreed start/end, not elapsed time of the original entire project. Suppress pace variance when bases are incomparable. A new deadline supersedes future alert occurrences and retains old/new dates and reason. |

## 6.9 GitHub App and reliable event ingestion (page 15)

Use the official installation mechanism, minimal read permissions and explicit repo selection. The installation identifies an integration; each project link still requires workspace permission.

**Installation and identity.** Bind installation callback state to initiating organization and admin. Verify the actual installation and granted repository list before linking. Use provider repository IDs and explicit GitHub-user/member mapping. A login, display name or email match alone must not identify a developer.

**Receive and acknowledge.** Over HTTPS, verify `X-Hub-Signature-256` against the raw request bytes with HMAC-SHA256 and a constant-time comparison. Validate event/action, installation, repo entitlement and size. Persist accepted receipt plus outbox before a fast 2xx response, targeting within 10 seconds. On storage failure return an error instead of acknowledging undurable data.

**Processing and ordering.** Deduplicate `X-GitHub-Delivery` within the integration context; the same redelivery ID must not create another effect. A request with the same key and conflicting content is quarantined. Scheduled pollers use bounded retry/backoff recorded in PostgreSQL outbox state, then operator-visible recovery. Preserve event time, received time, upstream ID and state version; older events never overwrite newer confirmed state.

**Missing events and outages.** GitHub does not automatically redeliver failed deliveries. Provide authorized redelivery or a periodic reconciliation against accessible upstream records/cursors. Back off on provider limits. Mark history gaps when earlier events cannot be reconstructed. Show last successful sync and failure reason. Revocation stops new sync while manual work continues.

**Link and display.** Ingest allowed push, pull request, review, check/workflow and optional deployment events. Parse exact task keys such as `CRM-101` and validate linked repo, project and tenant. Ambiguous evidence remains repository-level until an authorized choice. Expose separate last code update, last task update, last deployment and last sync. No code event changes accepted-work credit.

**Evidence for release.** Replay one signed PR twice, send a forgery, deliver an older update late, revoke a repository and simulate an outage. Verify the stored effects, visible status, recovery path and absence of new task completions. Official references are on the final source page.

## 6.10 Notification and reminder delivery (page 16)

Use an outbox for domain changes and a scheduler for dated occurrences. The inbox and email can represent the same condition while keeping different delivery states.

| Trigger family | Default recipient, action and key distinction |
|---|---|
| Assignment, mention, review | Assignee, eligible mentioned user or assigned reviewer. Open exact entity/revision. For an overdue review alert responsible reviewer and escalation owner per policy; suppress once no longer pending. |
| Due, overdue, missed check-in | Assignee/accountable owner; unresolved escalations go to responsible manager per policy. Scope occurrence to entity/date or scheduled check-in window and policy version. Confirm work is still open and date unchanged before dispatch. |
| Blocker, health, critical CI | Notify affected owner/PM or authorized subscribers. Include reason, time and affected work; critical CI alert opens authorized engineering evidence. A health transition is a separate condition. |
| Scope, mode, target, closure | Notify PM, accountable owner and eligible affected participants. Include actor, prior/new state and a link; deduplicate when the same person holds multiple roles. |
| Preferences and retry | In-app and email support user/category preference and quiet hours; urgent security policy may override ordinary suppression. Reschedule relative to recipient zone. Digest and configurable escalation windows depend on D12; direct critical actions remain traceable. |
| Reliable effects | Unique key = org, recipient, channel, condition/occurrence and effective version. Store queued, sent, failed/suppressed or retry status and attempts. Avoid blind duplicate email after ambiguous provider acceptance; reconcile if possible and expose uncertainty. Fresh permission check before creating private delivery. |

**Revoked target.** An old inbox link reauthorizes when opened. A removed member receives no new private content and cannot use a previously copied link to reopen a project. No details about an inaccessible project appear in the error.

## 6.11 Portfolio, workload, search and CSV (page 17)

Use the same permission-aware query definitions for the screen, calculated summary and export. Every metric carries its scope, time basis and unit.

| Read model | Definition and edge cases |
|---|---|
| Portfolio / Need Attention | One row per permitted project. Show lifecycle, computed health + causes, accountable owner, latest task/check-in, target and method-labeled progress. Count distinct projects per category; one project can have several reasons. Filter owner/team/health/mode/date/status, then calculate counts. |
| Progress / history | Use a snapshot at or before as-of time, retaining recorded method and scope. Include Not reported/Not measurable counts explicitly. Do not blend solo estimates and accepted team work into one apparent verified delivery percentage. |
| Dates / compliance | Milestones due use scheduled dates in the selected period. Overdue uses approved cutoff and unresolved state at as-of. Check-in compliance = met required occurrences / eligible expected occurrences; show pending/grace/excused separately and no rate for zero eligible occurrences. |
| Workload / availability | Per member and week, add planned hours assigned once. Compare with configured available hours after agreed calendar/absence adjustments. If no capacity or estimate, mark unknown; do not convert points. When some projects are hidden, label the visible total partial without revealing private projects. |
| Activity / release | Activity shows safe actor, event, time and entity. Release acceptance shows accepted revision, decision, reviewer, waiver and closure. Last code, task, check-in and deployment derive from their own confirmed sources. |
| Export safety | CSV for authorized portfolio and overdue results. Pin as-of/filter/timezone, generate from protected query and reauthorize on download. Treat text beginning with spreadsheet formula indicators as untrusted; use tested safe text export handling plus standard CSV quoting. Audit scope, row count and actor. Avoid duplicating private payloads. |

## 6.12 Security, privacy and operations (page 18)

Protect both organization boundaries and the narrower boundaries between projects inside an organization. Public references inform the checks; the owner chooses the policy that applies to actual customer data.

**Authentication and sensitive actions.** Use Spring Security OAuth2 resource server with JWT access tokens, sign-out and revocation. Use BCrypt or Argon2 password encoding for local development users. Require MFA for privileged roles where the chosen provider supports it; document any exception before release. Enforce least privilege on endpoints, scheduled pollers, search, exports and files. Rate-limit authentication, invitations, exports and webhook intake. Select and test applicable ASVS 5.0.0 controls.

**Privacy and commercial launch.** Classify identity, project records, private repository metadata, files, logs/audit, delivery attempts and backups. Record purpose, roles, region, retention duration, legal/contractual exceptions and deletion method before commercial use. No retention duration is supplied. Minimize event storage and redact secrets/private code. Implement scoped account/org export and deletion with status and proof.

**Incident and restore.** A named operator owns monitoring and incident response. Revoke affected credentials, pause affected scheduled pollers, restrict support access, restore to a safe environment, replay outbox/deletion records and reconcile upstream before reopening. Preserve privacy bounds when replaying jobs; never resend everything as a side effect of restore.

**Operational monitoring.** Trace request → DB/outbox → scheduled poller → inbox/email or read model. Monitor errors, latency, stale Git sync, failed poller attempts, outbox age, email failures and scan delays. Thresholds need a named owner and monitoring window approved at pilot; avoid assuming a guaranteed service level.

**Release rehearsal.** Use repeatable seed data for a fresh install and an upgrade. Test migrations on production-like data, stage one candidate, check both modes and rollback a failed rollout. Daily backups plus PITR where available; measure real loss and restore time. A daily backup alone cannot establish the one-hour loss objective.

**Go-live evidence.** Zero unresolved high/critical security defects, tenancy negative tests, supported browser/accessibility checks, measured NFR results, operator runbook, signed pilot outcomes and documented restore/rollback. Record deviations through a versioned change.

---

# 7. API reference

## 7.1 Workspace and projects (page 19)

Paths below preserve the original `/v1` contract. Request fields and response conditions complete the proposed V1 contract for review in ticket 0.4. The authenticated account determines eligible organization scope.

| Method and path | Body, authorization and result |
|---|---|
| `POST /v1/organizations` | Authenticated user supplies name, slug, timezone and calendar. Create organization and owner membership atomically; return 201 + ID/version. |
| `POST /v1/organizations/{org}/invites` | `member.invite`; target email, scoped role/team and expiry policy. Return safe invite status. Resend/revoke invalidate the old secret; never return stored tokens in list views. |
| `GET /v1/organizations/{org}/projects` | `project.read`; cursor, search, owner, team, health, status, mode and date range. Return only permitted rows plus method/time and cursor. |
| `POST /v1/organizations/{org}/projects` | `project.create`; name, key, scope, PM/owner, start/target dates, zone, mode, priority and status. Validate members and unique key. Return 201 + ID/version. |
| `PATCH /v1/projects/{id}` | `project.edit` plus operation-specific rights. Require expected version. Changing approved deadline needs previous/new date and reason. Return updated version; stale write returns 409. |
| `POST /v1/projects/{id}/mode-transitions` | `project.mode.change`; target mode, reason, expected version, approved baseline reference and accountable developer where needed. One transaction creates transition, history and outbox. |
| `POST /v1/projects/{id}/checkins` | `project.progress.report`; percent, accomplished, next steps, blockers, projected finish, optional evidence or `revision_of`. Permit in Individual mode only; return entry and verification state. |
| `GET /v1/projects/{id}/progress-history` | `project.read`; period/as-of, cursor. Return ordered snapshots with method, missing-value reason, baseline and visible transition markers. |

## 7.2 Work and integrations (page 20)

Separate project credentials and application sessions from the GitHub webhook endpoint. Replayed requests must not create duplicate reviews, scope changes or notifications.

| Method and path | Body, authorization and result |
|---|---|
| `POST /v1/projects/{id}/work-items` | `task.create`; type, parent, title, owner, reviewer, criteria, weight/unit as proposed and due date. Validate hierarchy. An unapproved scope proposal cannot change the denominator. |
| `PATCH /v1/work-items/{id}` | `task.update` plus field-specific permission; current JPA `@Version` and allowed changes. Require a reason for reopening. Route changes to approved weight or membership into scope approval. |
| `POST /v1/work-items/{id}/reviews` | `task.review` plus assigned/eligible reviewer. Pass `submittedRevision`, decision, evidence reference and mandatory reason for changes requested. Validate current revision and criteria. |
| `POST /v1/organizations/{org}/github/install` | `repo.connect`; bind org, authorized initiator, return location and nonce to installation start. Verify completed provider installation before granting selected-repo access. |
| `POST /v1/integrations/github/webhook` | Service route: validate raw-body HMAC, installation, event/action, repo and unique delivery receipt. Return 2xx only after durable acceptance or known safe duplicate. |
| `GET /v1/me/notifications` | Current user/current organization; cursor, unread/category filters. Return safe metadata and destination; every destination reauthorizes independently. |
| `GET /v1/organizations/{org}/reports/portfolio` | `project.read`/report access; CSV also needs `report.export`. Accept period/as-of, filters, timezone and output. Deny unauthorized download; pagination never bypasses filter or scope. |

**Write conventions.** Use an `Idempotency-Key` for retriable mutations, scoped to caller, organization and route. Same key and body returns the earlier result; different body conflicts. Require the current JPA `@Version` for conflicting edits. HTTP 400/422 validation, 401 unauthenticated, 403 missing permission, 404 foreign/unknown object, 409 stale/conflict, 429 limited, 503 unavailable. Error shape: `code`, `message`, `request_id` and `field_errors`.

## 7.3 Remaining actions (page 21)

These contract additions give required UI actions a normal server path. They are route proposals for the signed OpenAPI specification; equivalent routes must preserve the same access and transactional behavior.

| Action / proposed route under `/v1` | Required gate and effect |
|---|---|
| `POST /projects/{id}/scope-versions`; `POST /scope-versions/{id}/approve` | `project.scope.change`; submit leaf/weight diff, unit, reason and expected base. Approval atomically activates the new baseline, snapshots progress and notifies permitted members. |
| `POST /work-items/{id}/submissions`; `POST /work-items/{id}/reopen` | Authorized assignee submits current revision; approved person reopens with reason. Supersede prior accepted credit when needed. |
| `POST /work-items/{id}/dependencies`; `POST /work-items/{id}/blockers` | Authorized work manager creates a scoped edge or blocker with severity, cause and owner. Use an explicit resolve/remove action with dependency/cycle validation. |
| `POST /projects/{id}/acceptance-requests`; `POST /acceptance-requests/{id}/decisions` | Bind checklist to current mode/baseline/check-in and expected version. Validate permission, readiness, waivers and current revision before accepting/rejecting. |
| `POST /projects/{id}/close`; `POST /projects/{id}/archive` or `/restore` | Authorize closure or archive separately, audit and return lifecycle plus archive flag. Restore prior lifecycle; historical figures remain unchanged. |
| `POST /work-items/{id}/comments`; `POST /work-items/{id}/attachments` | Check parent permission, sanitize display and limit mentions. Issue upload intent, validate bytes/scan before download. Apply equivalent project-level routes. |
| `PATCH /me/notifications/{id}`; `GET /organizations/{org}/reports/overdue` | Allow only the recipient to change read state. Overdue CSV and export downloads require authorized current scope and pinned report parameters. |

**Other screens.** Provide scoped CRUD for teams/members/roles, invitation resend/revoke, repository link/sync/revoke, review inbox, My Work, calendar, settings, notification preferences, audit and privacy requests. Validate server-side ownership, versions and payloads. AI, billing and additional provider connectors have no release endpoints.

## 7.4 Worked transactions and failure recovery (page 22)

Use these fixtures in contract and end-to-end tests. The field names are implementation proposals; the behavior and relationships are the contract.

1. **Individual check-in.** `POST /v1/projects/p_crm/checkins` with `Idempotency-Key` k1. Body: `{"percent":45,"accomplished":"Lead import works","next_steps":"Test call routing","blockers":[],"projected_finish":"2026-11-20"}`. A valid owner receives 201 with `checkin_id`, `method="developer_reported"`, `percent=45`, version and `captured_at`. Replaying k1 cannot add a second check-in.
2. **Approve scope.** A PM approves scope v2 against expected v1. Change = add one eligible leaf of weight 25 points. Commit scope v2, its 50/125 snapshot and `ScopeChanged` in one transaction. A competing edit expecting v1 receives `409 STALE_VERSION` and refreshes its comparison.
3. **Stale review.** A reviewer submits Approve for revision 4 after the developer submitted revision 5. Return `409 STALE_REVIEW` with `request_id`. Keep the task pending for revision 5; no Done status, percentage change or approval alert is emitted.
4. **Shared repository event.** A signed delivery mentions `CRM-101` in a shared repository. Resolve only an unambiguous task in an authorized project. A later duplicate receipt returns success for that receipt and adds no task link or progress credit. Missing a unique eligible task leaves the event unassigned.
5. **Operational failures.** Email failure retries the pending delivery subject to current access and occurrence validity; preserve failed history. If an export scheduled poller re-runs, reuse its pinned query and request reference. On GitHub outage show last sync, keep manual actions writable, then reconcile deliberately.

**Domain events.** Publish stable `event_id`, `org_id`, entity ID, actor, aggregate version and time. Source event set: ProjectCreated, ProjectModeChanged, CheckInSubmitted, WorkItemCompleted, ScopeChanged, DeadlineChanged, BlockerRaised, ReviewRequested, GitEventProcessed, ProjectHealthChanged and NotificationRequested. Add explicit reopening/acceptance and revocation events for their recorded workflows.

---

# 8. Product decisions (pages 23–24)

Use these proposed defaults for design and fixtures; confirm the affected setting before its dependent release gate. The stakeholder guide holds the editable decision register.

## D01–D06

| Decision | Proposed default | Decision owner |
|---|---|---|
| D01 Lifecycle and delivery | Use On Hold for Paused. Make Delivered the acceptance decision, Closed the subsequent administrative action and Archived a read-only flag with restore. | Product owner / delivery lead |
| D02 Individual check-in authority | Accountable developer reports. Latest submitted entry is current by default; optional manager verification can hold a new figure pending. Corrections append a linked entry. | Product owner / project management |
| D03 Weight units and scope | One weight unit per approved baseline: consistent effort, explicit points or equal weight 1 throughout. Split, cancel, add and resize through a recorded scope change. | Engineering lead / project manager |
| D04 Review and closure authority | Configure review by work type and checklist. Proposed default assigns a separate reviewer where required. Record who may waive a blocker and accept or close delivery. | Engineering, QA and product |
| D05 Cadence and work calendar | Weekly default with one working day of grace; daily or fortnightly per project. Proposed reminder offsets use three and one working days; approve cutoff, quiet hours and escalation recipients. | Project management / operations |
| D06 Health and management overview | Adopt the documented rule order and per-reason evidence. Pilot the 15-point pace gap, blocker older than two working days, and selected KPI order. | Delivery lead / product owner |

## D07–D12

| Decision | Proposed default | Decision owner |
|---|---|---|
| D07 Mode conversion and adoption | Offer Individual when one developer owns delivery; user chooses. Preserve both measurement series. Remaining work starts a new denominator. Reverse mode requires a new manual entry. | Product owner / project manager |
| D08 GitHub access and identity | GitHub first; organization admin selects permitted repos. Use explicit contributor identity and unambiguous task links. Record allowed events and any deployment limitation. | Engineering lead / organization admin |
| D09 People, dates and reports | Set a capacity reference and weekly allocation; missing hours stay unknown. Define continuity on departure, period/as-of display and export boundaries. | Operations / project management |
| D10 Identity, hosting and retention | Select identity provider and ORM after a spike. Record hosting region, deletion/retention windows, backup treatment, support elevation and file policy against customer terms. | Technical lead / security / owner |
| D11 Product, pilot and targets | Use the working product name; defer pricing. Choose pilot users for both modes, load mix, operating budget, owners and success thresholds. | Product owner / operations |
| D12 Recommended options | Record include/defer/condition for the six SHOULD items. Core dates, work views, actionable reminders and secure privileged access remain covered. | Product owner / engineering |

**Changes after approval.** Record the decision ID, reason, affected FR/task IDs and test impact in a new change entry. Rebaseline weights or published scope only under explicit review.

---

# 9. Build sequence: 32 weighted tasks (pages 25–40)

Each task card has fields for Status, Assigned to, Target date, Completion date and developer notes/evidence. All start as **Not Started** with the other fields blank.

## Phase 0: Policy and design (8 pts)

*Phase exit check: the team has agreed journeys, scope, roles, progress examples and a versioned implementation contract. Open commercial and pilot decisions have owners.*

### 0.1 Agree release scope and decision owners (2 pts)
- **Requires:** None. **Enables:** 0.2, 0.3, 0.4
- **Build:** Map the two original documents to M01–M12, FR-001–046, NFR-01–12 and AS-01–08. Assign D01–D12 and record which recommended items enter V1.
- **Why:** The team needs one release boundary before estimating work.
- **Outcome:** An agreed scope, decision register and named stakeholders.
- **Pass when:** Resolve implementation-blocking policy choices or record a bounded interim option and owner. Every mandatory requirement has a test and delivery ticket.
- **Trace:** D01–D12
- **Status:** Not Started

### 0.2 Approve journeys and scoped roles (2 pts)
- **Requires:** 0.1. **Enables:** 0.3, 1.1, 2.1
- **Build:** Walk through organization setup, both modes, approval, reopening and departure. Draw the permitted routes for Owner, Admin, PM, Lead, Developer, Reviewer, Viewer and temporary support.
- **Why:** A screen design cannot substitute for who can perform an action.
- **Outcome:** A permission and screen map with error and empty states.
- **Pass when:** A PM can act only on permitted projects. A viewer's read does not imply export. Product signs off the solo and team journeys.
- **Trace:** M01/M02/M09/M11
- **Status:** Not Started

### 0.3 Fix the progress and calendar examples (2 pts)
- **Requires:** 0.1, 0.2. **Enables:** 2.2, 2.3, 3.1
- **Build:** Define state/status vocabulary, eligible leaves, scope versions, approval settings, role for waivers, calendar, check-in grace and health rules. Save worked examples as executable fixtures.
- **Why:** Even a correct calculation misleads if its scope or date changes silently.
- **Outcome:** One shared model for UI, API, reports and QA.
- **Pass when:** Validate the empty denominator, 50/100 → 50/125, reopened work, a DST boundary and a 60% method transition with product and QA.
- **Trace:** D01–D07 · AS-02–05/08
- **Status:** Not Started

### 0.4 Establish build and test environments (2 pts)
- **Requires:** 0.1. **Enables:** 1.1, 1.4
- **Build:** Create versioned environment configuration, typed contract skeleton, migrations, CI, sandbox identities and synthetic GitHub/email fixtures. Confirm proposed framework, ORM and support owners.
- **Why:** The same tests must run without a customer account or live repository.
- **Outcome:** Reproducible development, test and staging environments.
- **Pass when:** Fresh setup applies Flyway migrations, builds web/API, starts the worker profile and runs a sample request with a request ID. Store credentials outside code and logs.
- **Trace:** D08/D10 · NFR-08/11
- **Status:** Not Started

## Phase 1: Workspace foundation (14 pts)

*Phase exit check: verified users can switch only between their organizations. Scope checks, write conflicts and audit/outbox behavior pass negative and replay tests.*

### 1.1 Create organizations, identity and sessions (3 pts)
- **Requires:** 0.2, 0.4. **Enables:** 1.2, 1.3
- **Build:** Implement sign-in/recovery, workspace creation, owner assignment, IANA timezone, work calendar and session revoke. Apply the agreed MFA and device policy.
- **Why:** A signed-in identity is only the starting point for workspace access.
- **Outcome:** A verified user can create or enter an authorized workspace.
- **Pass when:** Run T01 and T08. Privileged action requires the agreed assurance; a revoked session cannot issue a new authorized request.
- **Trace:** FR-001/008 · NFR-06/12
- **Status:** Not Started

### 1.2 Manage invitations, teams and ownership (3 pts)
- **Requires:** 1.1. **Enables:** 1.3, 5.4
- **Build:** Add expiring single-use invite, resend/revoke, membership and team lead changes. Build planned handover and immediate access revocation on departure.
- **Why:** When someone leaves, work needs an accountable replacement and access must stop.
- **Outcome:** Membership and ownership history survive changes.
- **Pass when:** Run T02–03. Race two invite accepts; one membership results. Transfer an owner normally and test emergency disable with no replacement ready.
- **Trace:** FR-002/003 · D09
- **Status:** Not Started

### 1.3 Enforce permissions on every access path (4 pts)
- **Requires:** 1.1, 1.2. **Enables:** 1.4, 2.1, 3.3, 4.1, 4.4, 5.3, 5.5, 5.6
- **Build:** Enforce tenant, membership, project scope, action and object checks in services and queries. Support custom permission templates, least privilege and isolated tenant switching.
- **Why:** Project IDs and hidden UI buttons are insufficient access controls.
- **Outcome:** UI, APIs, search, jobs and downloads share enforceable rules.
- **Pass when:** T04–06 and AS-07 pass. Try a foreign ID and self-elevation. After switching organizations, old counts, tokens and links cannot disclose the other workspace.
- **Trace:** FR-004–006 · NFR-06
- **Status:** Not Started

### 1.4 Commit changes, history and events together (4 pts)
- **Requires:** 0.4, 1.3. **Enables:** 2.1, 2.3, 3.2, 3.4, 4.1, 4.2, 4.4, 5.2, 5.6
- **Build:** Add Flyway migrations, JPA `@Version` columns, idempotency keys, audit records and a transactional PostgreSQL outbox. Build scheduled poller delivery/deduplication with ShedLock and safe logging.
- **Why:** A saved decision needs a history entry and reliable follow-up even after a crash.
- **Outcome:** Concurrent writes are consistent and consumers can safely replay an event.
- **Pass when:** Race conflicting edits. One valid write wins; the other gets a conflict. Crash after commit and before publish; business state and one audit/event effect survive restart.
- **Trace:** FR-007/044 · NFR-04/08/11
- **Status:** Not Started

## Phase 2: Projects and Individual Ownership (14 pts)

*Phase exit check: a manager creates a project quickly, one developer reports without tasks, deadlines use the agreed calendar, and delivery requires an authorized decision.*

### 2.1 Create, find and edit project records (4 pts)
- **Requires:** 0.2, 1.3, 1.4. **Enables:** 2.2, 2.3, 2.4, 3.1, 4.1
- **Build:** Implement project setup, stable key, description, owner, PM, members, dates, timezone, priority, state and mode. Build the permitted list and add the template branch if selected.
- **Why:** A solo project must be usable before a work breakdown exists.
- **Outcome:** Either project mode can start; the accessible portfolio links to its workspace.
- **Pass when:** Run T09, T11 and applicable T16. A new solo project has zero tasks and no invented percentage. Reject invalid dates, duplicate keys and foreign owners.
- **Trace:** FR-009/011/016
- **Status:** Not Started

### 2.2 Record Individual progress and corrections (4 pts)
- **Requires:** 0.3, 2.1. **Enables:** 2.4, 3.5, 5.3
- **Build:** Save the accountable developer's percentage, accomplishments, next work, blockers, projected finish and optional evidence. Support append-only corrections and configured verification.
- **Why:** Managers need to see both the estimate and who supplied it.
- **Outcome:** Current figure and history have method, author and time; pending verification is visible.
- **Pass when:** Run T17, T18, T28 and AS-01. A downward correction needs a reason. Verify an entry; the label remains Developer reported and 100% cannot close delivery.
- **Trace:** FR-017/018/028
- **Status:** Not Started

### 2.3 Build the working calendar and cadence (3 pts)
- **Requires:** 0.3, 1.4, 2.1. **Enables:** 2.4, 5.1, 5.2, 5.4
- **Build:** Store due dates and local cutoff timezone, organization workdays and holidays, regular check-in frequency and grace. Version date/recurrence changes and future occurrences.
- **Why:** A user in another timezone and a reminder worker must agree on when work is late.
- **Outcome:** The same calculation supplies dates, grace, pace and future alert candidates.
- **Pass when:** Test Friday plus one working day with a Monday holiday, a DST change, a project on hold and a rescheduled date. Never leave two live occurrences for one due window.
- **Trace:** FR-037 · NFR-12
- **Status:** Not Started

### 2.4 Deliver, close, archive and restore (3 pts)
- **Requires:** 2.1, 2.2, 2.3. **Enables:** 3.6, 5.1
- **Build:** Implement lifecycle and archive flag. Build acceptance request/checklist, rejection, named waiver, authorized delivery/closure and restoration; start with Individual mode.
- **Why:** A reported 100% and a formally accepted delivery answer different questions.
- **Outcome:** Management can trace the decision and the precise version it accepted.
- **Pass when:** T14–15 and AS-02 pass. Critical unwaived blockers prevent acceptance. Archive stops edits, restore retains former state. Stale approval cannot close a newer version.
- **Trace:** FR-014/015 · D01/D04
- **Status:** Not Started

## Phase 3: Structured delivery (21 pts)

*Phase exit check: the team can plan, review, reopen, change scope and switch modes without counting a parent twice or rewriting earlier progress.*

### 3.1 Build the breakdown and assign work (3 pts)
- **Requires:** 0.3, 2.1. **Enables:** 3.2, 3.3, 3.4, 4.3, 4.4, 5.4
- **Build:** Model optional milestones, deliverables, tasks and subtasks. Give active leaves one assignee, optional reviewer/collaborators and stable keys. Expose work list and board basics.
- **Why:** Work should be easy to own without forcing empty intermediate levels.
- **Outcome:** A project can run direct tasks or a hierarchy up to five levels including project.
- **Pass when:** T12, T19–20 and applicable T26 pass. Reject cross-project parents, cycles and excessive depth. Splitting an accepted leaf proposes a scope change.
- **Trace:** FR-012/019/020/026
- **Status:** Not Started

### 3.2 Approve scope and keep its versions (3 pts)
- **Requires:** 1.4, 3.1. **Enables:** 3.5, 3.6
- **Build:** Record draft and active scope with eligible leaf IDs, weights, unit and reason. Add, remove, cancel, split or reweight through a version-checked approval.
- **Why:** Scope changes alter the denominator and must be explainable later.
- **Outcome:** One active baseline per structured project, with prior versions readable.
- **Pass when:** Run T25 and AS-08. Concurrent approvals cannot activate two baselines. Cancelling an item alone does not secretly improve the percentage.
- **Trace:** FR-025 · D03
- **Status:** Not Started

### 3.3 Implement review and rework (4 pts)
- **Requires:** 1.3, 3.1. **Enables:** 3.5, 3.6, 4.3, 5.2
- **Build:** Store criteria, submitted revision, required checks, reviewer and decision. Support submit, approve, request changes, direct Done when policy permits, and authorized reopening.
- **Why:** Acceptance must refer to the version of the work actually inspected.
- **Outcome:** Only a qualifying current revision becomes accepted work.
- **Pass when:** Run T22. Reject approval on a stale revision or missing check. Rejection returns work to In Progress. Reopening invalidates previous credit but retains history.
- **Trace:** FR-022 · D04
- **Status:** Not Started

### 3.4 Link dependencies and manage blockers (3 pts)
- **Requires:** 1.4, 3.1. **Enables:** 3.6, 5.1, 5.4
- **Build:** Add Finish-to-Start links within a project, cycle detection, affected successors, and explicit blocker reason, owner, severity and timestamps. Guard changes and removals.
- **Why:** A delay on one item can affect others without changing their approved dates.
- **Outcome:** A manager can see and resolve upstream risk separately from workflow state.
- **Pass when:** Run T21, T24 and AS-05. Concurrent reverse links cannot form a cycle. Removing a predecessor requires explicit treatment of its links.
- **Trace:** FR-021/024 · M07
- **Status:** Not Started

### 3.5 Calculate accepted work and snapshot it (4 pts)
- **Requires:** 2.2, 3.2, 3.3. **Enables:** 3.6, 5.1, 5.3, 5.5
- **Build:** Calculate numerator and denominator from the active baseline's qualifying leaves using one unit. Snapshot value, totals, method, baseline, time and cause on material change.
- **Why:** Counts based on parent items, mixed units or unapproved work overstate delivery.
- **Outcome:** Project, parent and history screens explain each calculated value.
- **Pass when:** Run T27, T29, AS-03 and AS-08. Check 50%, 40%, 16%, empty scope, open eligible work at 0% and no double counting.
- **Trace:** FR-027/029
- **Status:** Not Started

### 3.6 Switch modes and accept structured delivery (4 pts)
- **Requires:** 2.4, 3.2, 3.3, 3.4, 3.5. **Enables:** 5.5, 6.1
- **Build:** Implement authorized transitions with preview, reason and atomic commit. Freeze the old measurement series. Start the new method against the approved scope or a fresh check-in. Extend delivery checks to team work.
- **Why:** A change of method must never turn an earlier estimate into verified completion.
- **Outcome:** Both transition directions and the team delivery decision have a dated record.
- **Pass when:** T13, T15 and AS-04 pass. Induce rollback mid-transition. Keep prior data and active mode consistent; notify manager and owner once after success.
- **Trace:** FR-013/015/029
- **Status:** Not Started

## Phase 4: Repositories and evidence (13 pts)

*Phase exit check: authorized GitHub activity and clean attachments are visible only in scope. Duplicate or missed events are recoverable and cannot finish work.*

### 4.1 Connect selected GitHub repositories (3 pts)
- **Requires:** 1.3, 1.4, 2.1. **Enables:** 4.2
- **Build:** Implement GitHub App installation, tenant-bound callback and repository selection. Support multiple repositories per project, shared repositories, permission changes and explicit disconnection.
- **Why:** A repository may serve several projects or have access withdrawn.
- **Outcome:** Each authorized link has an installation, current grant and visible sync state.
- **Pass when:** Run T07 and T31. Block foreign installation IDs, reject unselected repositories, and stop new sync immediately after observed revocation. Manual project work still works.
- **Trace:** FR-007/031 · D08
- **Status:** Not Started

### 4.2 Receive, replay and reconcile GitHub events (4 pts)
- **Requires:** 1.4, 4.1. **Enables:** 4.3
- **Build:** Validate signature on raw bytes, persist a unique delivery receipt before acknowledgement, then process through the worker profile. Add bounded retries in PostgreSQL outbox state, last successful sync and authorized recovery.
- **Why:** A lost or replayed webhook must not duplicate activity or hide a gap.
- **Outcome:** Operators can distinguish a recorded delivery, applied effect and failed synchronization.
- **Pass when:** Run T32 and AS-06. Test forged, repeated, out-of-order, missed and revoked cases. A scheduled poller restart retries independently from GitHub redelivery.
- **Trace:** FR-032 · NFR-04
- **Status:** Not Started

### 4.3 Attribute activity without claiming completion (3 pts)
- **Requires:** 3.1, 3.3, 4.2. **Enables:** 5.3, 6.1
- **Build:** Normalize commits, pull requests, reviews, checks/workflows and permitted deployments. Map GitHub identities explicitly; auto-link only a unique authorized task key.
- **Why:** The same repository can serve different projects, and a merged change may still fail acceptance.
- **Outcome:** Separate last code, task, deployment and sync values with source and time.
- **Pass when:** Run T33–36. One shared-repo event without a safe key stays unassigned. A green check or merged PR never changes a task to Done.
- **Trace:** FR-033–036 · M08
- **Status:** Not Started

### 4.4 Keep discussion and files with the work (3 pts)
- **Requires:** 1.3, 1.4, 3.1. **Enables:** 5.6, 6.1
- **Build:** Provide project/task comments, scoped mentions, evidence links, private object storage, scan status and authorized signed downloads. Apply approved file and retention policy.
- **Why:** Reviewers need evidence without exposing attachments to other projects.
- **Outcome:** Only permitted users can view context and previously scanned, clean files.
- **Pass when:** Run T23. Upload clean and rejected samples, revoke access and try a foreign file. A mention never grants membership. A scanning error leaves the file unavailable.
- **Trace:** FR-023 · NFR-06/10
- **Status:** Not Started

## Phase 5: Delivery monitoring (19 pts)

*Phase exit check: teams can trace a risk through the calendar, notification, personal queue, portfolio and export. Dates, owners, evidence and permissions agree.*

### 5.1 Explain schedule health and its causes (4 pts)
- **Requires:** 2.3, 2.4, 3.4, 3.5. **Enables:** 5.2, 5.3, 5.5
- **Build:** Compute workday pace, critical overdue items/blocker age, staleness and approved-date delay. Keep raw reasons, source times and any expiring manager override.
- **Why:** Managers need to know who can act and why a project needs attention.
- **Outcome:** A risk label can be traced to its item, date, owner and recommended response.
- **Pass when:** T30, applicable T46 and AS-05 pass. A late project stays visibly delayed despite an override. Insufficient evidence shows Unknown. Git inactivity alone never creates risk.
- **Trace:** FR-030/046 · D06
- **Status:** Not Started

### 5.2 Deliver reminders, approvals and escalations (4 pts)
- **Requires:** 1.4, 2.3, 3.3, 5.1. **Enables:** 5.3, 6.1
- **Build:** Build in-app/email delivery with preference, quiet-hour and urgency rules, idempotent scheduling and current access checks. Add selected digest/escalation options and failed-delivery handling.
- **Why:** Retried scheduled pollers and changed dates otherwise cause duplicate or stale messages.
- **Outcome:** Each due occurrence, review, blocker or material change reaches eligible recipients with a usable link.
- **Pass when:** T37–40 and applicable T45 pass. Reschedule a date, repeat a job and revoke access: no old duplicate or unauthorized email. Opening the link reauthorizes.
- **Trace:** FR-037–040/045
- **Status:** Not Started

### 5.3 Build portfolio, search and My Work (3 pts)
- **Requires:** 1.3, 2.2, 3.5, 4.3, 5.1, 5.2. **Enables:** 5.5, 6.1, 6.2
- **Build:** Deliver Overview and Need Attention, filtered All Projects cards/list, permission-scoped search, My Work and review/check-in inbox. Keep each metric's definition and update time visible.
- **Why:** A manager should find ownership and the next action without reading chat history.
- **Outcome:** A permitted risk row opens its cause; a member sees only their own eligible actions.
- **Pass when:** T10, T39, T41–42 pass. In a usability trial locate owner, state, deadline, last update and health within two interactions; test empty and access-lost states.
- **Trace:** FR-010/039/041/042
- **Status:** Not Started

### 5.4 Show timelines and planned workload (3 pts)
- **Requires:** 1.2, 2.3, 3.1, 3.4. **Enables:** 5.5, 6.1
- **Build:** Display approved project/milestone/task dates and dependencies, weekly planned hours and available hours per member/team for permitted projects. Keep missing effort explicit.
- **Why:** An overloaded person or delayed predecessor may need reassignment before a deadline.
- **Outcome:** The timeline gives date warnings; workload shows the underlying allocation, unit and week.
- **Pass when:** Plan 36 hours against 30 available: show 6 hours over. Unknown estimates are unestimated; no points-to-hours conversion. Moving a predecessor never silently moves its successor.
- **Trace:** FR-024/026 · M07/M09
- **Status:** Not Started

### 5.5 Produce consistent reports and CSV exports (3 pts)
- **Requires:** 1.3, 3.5, 3.6, 5.1, 5.3, 5.4. **Enables:** 5.6, 6.1, 6.2
- **Build:** Build period/as-of reports, separate measurement methods, apply shared filters, provide authorized portfolio/overdue CSV and audit exports. Protect exported spreadsheet cells.
- **Why:** Executives and delivery teams should see the same historical facts and scope explanations.
- **Outcome:** A report and its export agree on rows, counts, timezone and active filters.
- **Pass when:** Run T43. Compare an as-of report before and after a baseline change, test report scope after access removal and verify formula-like user data is exported safely.
- **Trace:** FR-029/041/043 · M10
- **Status:** Not Started

### 5.6 Add privacy operations and support audit (2 pts)
- **Requires:** 1.3, 1.4, 4.4, 5.5. **Enables:** 6.1, 6.2, 6.3
- **Build:** Deliver restricted audit views, temporary support access, organization/account data export and deletion, job/file retention and deletion replay after restore.
- **Why:** Commercial operation needs a way to investigate and honor approved data rules.
- **Outcome:** An authorized operator can fulfill a request and prove how it was handled.
- **Pass when:** Run T44, revoke a support grant, delete a test subject and restore an old backup. Check the approved policy before reopening data; routine logs contain no secret or private code.
- **Trace:** FR-007/044 · NFR-06/10
- **Status:** Not Started

## Phase 6: Validation and rollout (11 pts)

*Phase exit check: both project modes pass pilot acceptance, security and accessibility checks; load, restore and operational rollback have evidence.*

### 6.1 Run the full contract and workflow suite (3 pts)
- **Requires:** 3.6, 4.3, 4.4, 5.2, 5.3, 5.4, 5.5, 5.6. **Enables:** 6.2, 6.3, 6.4
- **Build:** Execute T01–T46 with recorded dispositions for SHOULD, AS-01–08 and cross-module negative fixtures. Link each failure to the task/requirement and rerun the fixed revision.
- **Why:** A passing isolated module may still produce an inconsistent cross-project report.
- **Outcome:** One reproducible evidence pack covers both modes, concurrency, replay and calendar edges.
- **Pass when:** All mandatory cases pass or have a formally approved scope amendment. Verify API contracts, arithmetic, stale revisions, tenant boundaries, DST and notification dedupe.
- **Trace:** FR-001–046 · AS-01–08
- **Status:** Not Started

### 6.2 Verify access, accessibility and browsers (3 pts)
- **Requires:** 5.3, 5.5, 5.6, 6.1. **Enables:** 6.4
- **Build:** Test the threat model and selected ASVS controls, keyboard/screen-reader flows, focus, zoom, date labels and supported browsers/360 px viewport. Document findings with affected route and role.
- **Why:** A successful workflow must also be usable and restricted to its legitimate audience.
- **Outcome:** Security and inclusive-use evidence is attached to the release candidate.
- **Pass when:** Remediate all critical/high security findings. Verify tenant isolation, upload/export controls, accessible review transitions and equivalent mobile-width navigation.
- **Trace:** NFR-06/07/09
- **Status:** Not Started

### 6.3 Benchmark, restore and rehearse rollback (3 pts)
- **Requires:** 5.6, 6.1. **Enables:** 6.4
- **Build:** Load production-like data, measure read latency, validate operational alert routes and run a timed backup/PITR restore with deletion replay. Rehearse migration and application rollback.
- **Why:** The proposed performance and recovery targets need measured proof.
- **Outcome:** Operations has actual benchmark results, tested runbooks, incident owners and rollback criteria.
- **Pass when:** Run NFR-01–05/08/10–12 checks. Compare p95, RPO and RTO to the agreed targets; record any misses and owner resolution before release.
- **Trace:** NFR-01–05/08/10–12
- **Status:** Not Started

### 6.4 Pilot both modes and decide rollout (2 pts)
- **Requires:** 6.1, 6.2, 6.3. **Enables:** Release handover
- **Build:** Pilot real representative workflows in the approved setting. Record stakeholder outcomes and residual issues, stage rollout, verify health, and hand over support and rollback ownership.
- **Why:** A technical pass cannot establish that a solo developer and a manager can both use the product.
- **Outcome:** A named release owner records proceed, hold or rollback with supporting evidence.
- **Pass when:** Pilot owners verify solo setup under 3 minutes, risk discovery within two interactions and successful delivery review in both modes. Accept all must-haves and identify the supported runbook.
- **Trace:** D11/D12 · AS-01–08
- **Status:** Not Started

---

# 10. Functional acceptance register (pages 41–47)

T is the test ID. Use a clean fixture in the stated module, perform the action and verify its outcome. A recommended item (SHOULD) can be deferred only with a recorded D12 decision. Every test has a Result field (all currently **Not Run**) and an Evidence / issue field (blank).

| FR / Test | Name | Priority · Module · Build | Test |
|---|---|---|---|
| FR-001 / T01 | Create organization and calendar | MUST · M01 · 1.1 | Create a workspace with owner, IANA timezone and work calendar. Switch tenant and confirm the settings remain isolated. |
| FR-002 / T02 | Single-use invitations | MUST · M01 · 1.2 | Accept a valid invitation once. A revoked, expired or superseded link grants no access and a replay creates no second membership. |
| FR-003 / T03 | Teams and leads | MUST · M01 · 1.2 | Create a team and assign a lead. Reject member or lead IDs from a different organization. |
| FR-004 / T04 | Custom scoped roles | MUST · M01 · 1.3 | Grant a role on project A. It authorizes its selected actions on A and none on a private project B. |
| FR-005 / T05 | Server-side object access | MUST · M01 · 1.3 | Guess a foreign task, file and export ID. All reads and writes fail without disclosing its existence. |
| FR-006 / T06 | Organization switch | MUST · M01 · 1.3 | A multi-organization member switches workspace; cached search, inbox counts, repo details and links reauthorize under the selected membership. |
| FR-007 / T07 | Access and integration audit | MUST · M12 · 1.4, 4.1 | Change a role, disable a member and remove a repository. A safe actor/time/target record exists for each. |
| FR-008 / T08 | MFA, sessions and devices | SHOULD · M01 · 1.1 | Check privileged MFA where supported, revoke a session and verify subsequent access fails. Record any approved provider limitation. |
| FR-009 / T09 | Create and edit projects | MUST · M02 · 2.1 | Enter required fields and a unique project key. Reject a duplicate key in the same organization and an invalid date range. |
| FR-010 / T10 | Filter the portfolio | MUST · M02 · 5.3 | Combine owner, team, health, target date, lifecycle and mode filters. Every visible row and count matches the same authorized set. |
| FR-011 / T11 | Individual project without tasks | MUST · M03 · 2.1, 2.2 | Create a project with one accountable developer and zero tasks. The owner can report progress immediately. |
| FR-012 / T12 | Flexible work hierarchy | MUST · M04 · 3.1 | Create a direct task, a milestone with a task, and a deliverable with subtasks. Reject invalid nesting and cross-project parents. |
| FR-013 / T13 | Controlled changes of mode | MUST · M06 · 3.6 | Switch in both directions. Inject a failed write; either the complete transition commits or the previous mode and history stay intact. |
| FR-014 / T14 | Archive and restore | MUST · M11 · 2.4 | Archive one project; edits stop. Restore it with the same lifecycle, scope and history. Reconcile reminders once. |
| FR-015 / T15 | Accept delivery | MUST · M11 · 2.4, 3.6 | Reach 100% and verify delivery is pending until the authorized decision and checklist. Record the accepted scope and evidence. |
| FR-016 / T16 | Start from a template | SHOULD · M02 · 2.1 | If selected for release, create from a template with fresh IDs and explicit owner/dates. Never copy secrets, approvals or completed work. |
| FR-017 / T17 | Submit a check-in | MUST · M03 · 2.2 | Submit 45%, accomplishments, next steps, blockers and projected finish. Validate range and return a dated entry without creating tasks. |
| FR-018 / T18 | Immutable check-in revisions | MUST · M03 · 2.2 | Correct the value downwards with a reason. Original, correction, authors and verification state remain visible. |
| FR-019 / T19 | Manage work items | MUST · M04 · 3.1 | Create, read, edit and retire supported work types. A removed planned leaf needs an approved scope change and leaves history. |
| FR-020 / T20 | Assign owners and reviewers | MUST · M04 · 3.1 | Give a leaf one primary assignee, a reviewer if required and optional collaborators. Reassign without erasing the previous assignment. |
| FR-021 / T21 | Workflow and separate blocker | MUST · M07 · 3.4 | Flag an In Progress item as blocked with reason and owner. Clear the blocker without changing its underlying task state. |
| FR-022 / T22 | Definition of Done | MUST · M05 · 3.3 | A required review blocks Done until the submitted revision is approved and its criteria/checks pass. Changes requested returns it to In Progress. |
| FR-023 / T23 | Comments and attachments | MUST · M05 · 4.4 | Add a comment, mention a permitted colleague and attach a clean file. Pending, rejected or foreign files are unavailable. |
| FR-024 / T24 | Finish-to-Start dependencies | MUST · M07 · 3.4 | Add A before B; reject self-links and cycles, including two simultaneous reverse links. Surface affected work when A changes. |
| FR-025 / T25 | Version scope changes | MUST · M04 · 3.2 | Approve a scope addition or removal. Record the reason, author, approver and prior/current baselines; earlier snapshots do not change. |
| FR-026 / T26 | List, board and basic timeline | SHOULD · M04 · 3.1, 5.4 | For selected views, move the same item and verify all views reflect its saved state/date. A warning never reschedules another item silently. |
| FR-027 / T27 | Calculated leaf progress | MUST · M04 · 3.5 | For weights 20, 30 and 50 with the first two accepted, show 50%. No parent credit. Empty eligible denominator shows Not measurable. |
| FR-028 / T28 | Label the reported figure | MUST · M03 · 2.2 | On portfolio, project detail and report, show Developer reported plus time. Verification keeps that method label. |
| FR-029 / T29 | Preserve dated snapshots | MUST · M06 · 3.5, 3.6 | Change scope and mode. Old snapshots retain value, timestamp, method and original scope version; chart shows the measurement break. |
| FR-030 / T30 | Explain health and staleness | MUST · M07 · 5.1 | Simulate a missed check-in, overdue project and overdue critical task. Show the applicable label, reasons, supporting item and responsible person. |
| FR-031 / T31 | Authorized GitHub installation | MUST · M08 · 4.1 | Bind an installation to its workspace and selected repositories. An unselected repository cannot leak events or be linked. |
| FR-032 / T32 | Verified and replay-safe webhook | MUST · M08 · 4.2 | Tampered signatures fail; repeated valid deliveries cause one effect. A failed or missed event is retried or reconciled. |
| FR-033 / T33 | Engineering activity feed | MUST · M08 · 4.3 | Display permitted push, PR, review and check/workflow activity with source and timestamps. Loss of sync is visible. |
| FR-034 / T34 | Link work using a key or user choice | MUST · M08 · 4.3 | Associate CRM-101 only within an eligible linked project. An ambiguous shared-repository event stays unlinked until authorized confirmation. |
| FR-035 / T35 | Protect task completion | MUST · M08 · 4.3 | Merge a PR and pass CI for an item still in review. Work state and delivery percentage do not advance. |
| FR-036 / T36 | Deployment details | SHOULD · M08 · 4.3 | If installation permission/events exist, show the last confirmed deployment. Otherwise show unavailable with its reason. |
| FR-037 / T37 | Scheduled reminders | MUST · M09 · 2.3, 5.2 | Trigger upcoming, overdue and missed-check-in rules. Changing a due date invalidates pending reminders for the old date. |
| FR-038 / T38 | Actionable event notifications | MUST · M09 · 5.2 | Assign work, raise a blocker, request review and change critical status. Eligible recipients receive each applicable event once per channel. |
| FR-039 / T39 | Inbox and deep links | MUST · M09 · 5.2, 5.3 | Read/unread state persists. A link opens the exact item and rechecks access after a role change. |
| FR-040 / T40 | Email and in-app preferences | MUST · M09 · 5.2 | A user disables noncritical email; the permitted in-app alert remains. Quiet hours, urgent policy and retry history are honored. |
| FR-041 / T41 | Overview and Need Attention | MUST · M02 · 5.3 | Open Overview, then a risk row. The responsible owner, risk reason and corrective next action are visible in context. |
| FR-042 / T42 | My Work and review inbox | MUST · M09 · 5.3 | A developer sees their assignments and check-ins; an authorized reviewer also sees pending reviews. Removed access removes entries. |
| FR-043 / T43 | Export authorized CSV | MUST · M10 · 5.5 | Export filtered portfolio and overdue work. Match visible records, protect spreadsheet cells, recheck download access and audit the action. |
| FR-044 / T44 | Organization and project audit | MUST · M12 · 1.4, 5.6 | A permitted auditor reconstructs a deadline change and delivery decision; a viewer without audit permission cannot see restricted audit entries. |
| FR-045 / T45 | Configurable escalation and digests | SHOULD · M09 · 5.2 | If included, set a grace window and digest; an unresolved condition escalates once, while a resolved or rescheduled condition is suppressed. |
| FR-046 / T46 | Temporary health override | SHOULD · M07 · 5.1 | If included, show the manager's reason, author, expiry and computed health. On expiry restore the computed display and keep the history. |

**SHOULD items:** FR-008, FR-016, FR-026, FR-036, FR-045, FR-046. Everything else is MUST.

---

# 11. Quality targets and evidence (pages 48–49)

Proposed service and usability targets need a reproducible test and named owner. Record environment, load, observed result and evidence. Targets are not measured performance claims. All results currently **Not Run**.

| ID | Name | Build | Requirement and test |
|---|---|---|---|
| NFR-01 | Availability | 6.3 | Proposed 99.5% monthly. Define monitored service, denominator and any contractual maintenance exclusion; exercise a failed health check and reporting. |
| NFR-02 | Read latency | 6.3 | For standard list/read endpoints aim for p95 below 500 ms under the agreed workload, excluding external calls. Report slow endpoints and the workload used. |
| NFR-03 | Capacity | 6.3 | Seed 100 organizations, 10,000 active projects and 250,000 work items. Agree concurrent reads, writes, peaks and data distribution before the benchmark. |
| NFR-04 | Reliable processing | 4.2, 6.1 | Replay identical deliveries, reorder updates and interrupt scheduled pollers. Prove one business effect and recovery of missing current state where upstream history allows. |
| NFR-05 | Disaster recovery | 6.3 | Daily backups plus point-in-time recovery where available. Demonstrate ≤1 hour of data loss and service restoration within 4 hours before promising those targets. |
| NFR-06 | Security | 1.3, 6.2 | Test TLS, encryption at rest, scoped access, managed secrets, headers, dependency scans, and selected OWASP ASVS 5.0.0 controls. Remediate high/critical issues before launch. |
| NFR-07 | Accessibility | 6.2 | Target WCAG 2.2 AA on critical flows. Exercise keyboard-only navigation, visible focus, screen-reader labels/status, contrast, non-color cues and zoom. |
| NFR-08 | Observability | 1.4, 6.3 | Trace an API action through outbox, scheduled poller, inbox and email. Trigger alerts for error rate, outbox age, sync failures and latency; record owner and recovery action. |
| NFR-09 | Browser and viewport | 6.2 | On current supported Chrome, Edge, Firefox and Safari, test core flows at desktop and 360 px width. Confirm exact supported versions at release. |
| NFR-10 | Retention | 5.6, 6.3 | Set approved retention by data class, including audit/log/file/backup. Demonstrate deletion and restored-data treatment against the chosen contract. |
| NFR-11 | Maintainability | 0.4, 6.3 | Check typed boundaries, schema migrations, OpenAPI examples, automated CI tests and rollback on production-like fixtures. |
| NFR-12 | Localization | 2.3, 6.1 | English V1 UI; store instants in UTC, use IANA zones and an org work calendar. Test date-only deadlines, DST shifts and a user in another timezone. |

---

# 12. End-to-end acceptance scenarios (pages 50–51)

Record the candidate build, actual result and evidence for each run. The scenarios preserve the intent of the original SRS. Use dummy data for security and failure cases. All results currently **Not Run**.

| ID | Scenario | Build | Set up / act | Expect |
|---|---|---|---|---|
| AS-01 | A solo developer starts | 2.1, 2.2, 4.3 | Create an Individual project with one developer and repositories, no tasks. Submit 40% and a short update. | Overview shows 40% Developer reported, date and source; repository events have their own timestamps. |
| AS-02 | The owner reports 100% | 2.4 | Submit 100%; a reviewer opens the delivery checklist. | Show Awaiting acceptance. Only an authorized acceptance makes it Delivered; closing is a recorded subsequent action. |
| AS-03 | A team completes work | 3.3, 3.5 | Add accepted leaf weights 20 and 30 alongside an In Review leaf of 50. Approve the last revision. | First show 50%, then 100% of scope. A merged PR cannot substitute for the required review. |
| AS-04 | Change the tracking method | 3.6 | Switch Individual at 60% to Structured using an approved remaining-work baseline. | Keep 60% on its date. Start a new labelled series from actual accepted leaves and record who changed the method. |
| AS-05 | Upstream work is late | 3.4, 5.1, 5.2 | Block a critical predecessor and pass the due date. Run the reminder job twice. | Show a specific health reason and affected item. The eligible manager gets one alert per occurrence/channel. |
| AS-06 | GitHub delivers twice | 4.2, 4.3 | Replay an authentic PR delivery and interrupt the scheduled poller after persisting it. | The event and downstream effect are applied once; sync state is updated after successful processing. |
| AS-07 | A foreign project ID is guessed | 1.3, 5.6 | Use an Org A credential with Org B project, notification, file or report IDs. | No values, counts, file links or identifying metadata leak. Restricted security evidence records the denied attempt. |
| AS-08 | Approved scope grows | 3.2, 3.5 | With 50 accepted points of 100, approve another 25 points. | New snapshot is 40% at 50/125. Prior 50% remains at the previous scope version with its date and reason. |

---

# 13. Release and rollback decision (page 52)

Test the candidate through real entry points. A passing isolated formula or a connected GitHub installation does not establish that the product is ready for a company to use.

| Gate | Required evidence |
|---|---|
| 1 · Contract and logic | Unit tests: weights, containers, cancellation, zero denominator, date boundaries, grace, stale/status precedence and scoped permission decisions. Verify original FR and any approved amended decisions. |
| 2 · Integration and failure | Exercise DB constraints, mode switch rollback, attachment scan errors, durable outbox, replay and out-of-order Git events, email failure, changed dates and export access removal. |
| 3 · Experience and security | Use keyboard/screen reader and supported devices; give users in two orgs different roles. Try forged events, object ID guessing, role escalation, invalid signatures, malicious exports and denied downloads. |
| 4 · Operations | Load with agreed data/traffic, record p95, durable restart, alert ownership, actual restore/RPO and RTO. Rehearse production-like migration, rollback and controlled replay. Verify logs, retention and alert routing. |
| 5 · Product acceptance | Pilot one solo project and one structured team. Confirm usable setup under three minutes, key facts within two interactions, labelled dated progress, action links and a traceable closure. Record defects and retest. |
| 6 · Proceed / hold / rollback | All applicable MUST tests accepted or formally removed by an approved version change; all selected SHOULD and quality gates accounted for. No open high/critical security findings. Name deployment owner, support contact, rollback triggers and monitoring period. |

**Release decision form:** Decision (currently **Pending**) · Release owner / date · Candidate version · Decision evidence, residual items, rollback condition and support owner.

---

# 14. Version and change history (page 53)

Document version 1.1 is the finalized requirements package. Task numbers such as 0.1 are stable work identifiers. A project's scope version is a separate record inside the product.

| Version | Change to the document |
|---|---|
| 1.0 · 29 Oct 2026 | Original stakeholder scope and draft SRS. The source included both delivery modes, 46 functional requirements, 12 quality objectives and eight acceptance scenarios. |
| 1.1 · 2 Nov 2026 | Reconciled lifecycle/archiving, clarified measurements, scope/version changes, working calendars and failure paths. Added module traceability, 32 weighted development tasks, test and decision records. User acceptance and operational targets still require evidence. |

For each subsequent change record version/date, affected M/FR/task/test IDs, old and new behavior, reason, approver and required retest. Carry accepted changes into both companions when publishing a new version. Keep earlier signed records.

The original has three blank change-record forms (Version/date, Affected IDs, Approver/decision reference, Old and new rule/reason/evidence/required retest).

---

# 15. Plain-language glossary (page 54)

Use these meanings when reviewing a screen, filing a defect or discussing a release. Product labels should remain recognizable to people who do not write software.

| Term | Meaning in this project |
|---|---|
| Tenant and scoped permission | A tenant is one company's workspace. A scoped permission grants one action in a specific company, team or project. A permission in one company does not transfer to another. |
| Leaf and baseline | A leaf is the smallest piece of measurable planned work. A baseline is an approved, dated list of those leaves and their weights. It makes an earlier percentage explainable after scope changes. |
| Pull request and CI check | A pull request proposes a code change. Continuous integration (CI) runs automated checks. Either can supply evidence for a reviewer; only configured acceptance rules complete work. |
| API / OpenAPI | An API is the agreed way for the app to ask the server for data or a change. OpenAPI documents that agreement, including input, permission, response and errors. |
| OIDC / MFA | OpenID Connect lets a trusted identity service sign a person in. Multifactor authentication requires additional proof for sensitive access, such as an administrator signing in. |
| Webhook and reconciliation | A webhook tells the platform that something changed in GitHub. Reconciliation compares the platform's records with the source after a gap or outage. |
| Outbox and idempotency | An outbox saves a follow-up event in the same database operation as the original decision. Idempotency lets a retried request return its earlier effect without doing the work twice. |
| p95 and availability | p95 is the time at or below which 95% of measured responses finish. Availability measures how much of the agreed service period the system was usable. Both require a stated test or observation window. |
| Recovery point and time | RPO is how much recent data could be lost; the proposed maximum is one hour. RTO is how long service recovery can take; the proposed target is four hours. PITR means restoring the database to a selected point in time. |
| As-of and scope version | An as-of report answers what was known at a specific time, using that time's recorded scope and measurement method. Today's access rules still govern who may read it. |

---

# 16. Sources and reading keys (page 55)

The two uploaded V1.0 documents describe one product. Their original scope and IDs have been kept so an engineer or stakeholder can trace a decision back to its starting point.

| Supplied source sections | Where they are reflected |
|---|---|
| Feature Scope §§1–5 and 8–11 | Purpose, roles, both modes, plain-language examples, measurements, deadlines, Git evidence and exceptional cases → M01–M11. |
| Feature Scope §§6–7 and 12–16 | V1 scope, screens, later work, business success, rollout and decisions → module map, release boundary and decision register. |
| Full SRS §§1–12 | Vision, roles, modes, health, integration and all FR-001–046 → M01–M12 and companion functional tests T01–T46. |
| Full SRS §§13–23 | Data, APIs, stack, NFRs, security, QA, phases, original scenarios, later scope and pending decisions → companion SRS and editable owner decisions. |

**Source documents:** Original feature scope (5 pages, 29 October 2026). Original software requirements specification (17 pages, 29 October 2026).

**Official technical references checked 2 November 2026:**

1. GitHub: App permissions and eligible events
2. GitHub: Webhook good practice, timing and delivery IDs
3. GitHub: Validate webhook signatures
4. GitHub: Recover failed deliveries
5. OWASP: Application Security Verification Standard 5.0.0
6. OWASP: File upload security
7. OWASP: Spreadsheet formula injection in CSV
8. W3C: Web Content Accessibility Guidelines 2.2
9. Next.js: App Router
10. Spring Security: OAuth2 resource server and JWT authentication

References 1–4 support the GitHub contract; 5–8 inform security and accessibility verification; 9–10 document the recommended web/API stack. Project policy, launch dates, budget, retention durations and achieved performance are owner decisions or measured results.

# API contract (all paths under /v1)

## Conventions
- `Idempotency-Key` on retriable mutations, scoped to caller + org + route. Same key + same body -> earlier result. Same key + different body -> 409.
- JPA `@Version` on conflicting edits. Stale -> 409 `STALE_VERSION`. Stale review -> 409 `STALE_REVIEW`.
- Request DTO records use Jakarta Bean Validation with `@Valid`; springdoc-openapi generates the OpenAPI specification used to generate web client types.
- Errors: `{ code, message, request_id, field_errors }`. Status: 400/422 validation, 401 unauthenticated, 403 missing permission, 404 foreign/unknown, 409 conflict, 429 limited, 503 unavailable.
- Lists: cursor pagination, deterministic order with unique ID tiebreaker. Pagination never bypasses filter or scope.
- Authenticated account decides eligible org scope. Never accept trusted `org_id` in a body.

## Workspace and projects
| Method + path | Permission and behavior |
|---|---|
| POST `/organizations` | Auth user: name, slug, timezone, calendar. Create org + owner membership atomically. 201 + id/version. |
| POST `/organizations/{org}/invites` | `member.invite`: email, scoped role/team, expiry. Returns safe status. Never return stored token in lists. Resend/revoke invalidate old secret. |
| GET `/organizations/{org}/projects` | `project.read`: cursor, search, owner, team, health, status, mode, date range. Only permitted rows + method/time. |
| POST `/organizations/{org}/projects` | `project.create`: name, key, scope, PM/owner, start/target dates, zone, mode, priority, status. Validate members, unique key. 201 + id/version. |
| PATCH `/projects/{id}` | `project.edit` + operation rights. Needs the current JPA version. Deadline change needs previous/new date + reason. Stale -> 409. |
| POST `/projects/{id}/mode-transitions` | `project.mode.change`: target mode, reason, current JPA version, approved baseline ref, accountable developer if needed. One `@Transactional` service operation: transition + history + outbox. |
| POST `/projects/{id}/checkins` | `project.progress.report`: percent, accomplished, next_steps, blockers, projected_finish, optional evidence, optional `revision_of`. Individual mode only. Returns entry + verification state. |
| GET `/projects/{id}/progress-history` | `project.read`: period/as-of, cursor. Ordered snapshots with method, missing-value reason, baseline, transition markers. |

## Work, review, integrations
| Method + path | Behavior |
|---|---|
| POST `/projects/{id}/work-items` | `task.create`: type, parent, title, owner, reviewer, criteria, weight/unit, due. Validate hierarchy. Unapproved proposal cannot change denominator. |
| PATCH `/work-items/{id}` | `task.update` + field permission, current JPA version. Reopen needs reason. Weight/membership changes route to scope approval. |
| POST `/work-items/{id}/reviews` | `task.review` + assigned reviewer: submittedRevision, decision, evidence ref, reason mandatory for changes requested. Validate current revision. |
| POST `/work-items/{id}/submissions` | Assignee submits current revision. |
| POST `/work-items/{id}/reopen` | Approved person, reason. Supersede prior accepted credit. |
| POST `/work-items/{id}/dependencies`, `/blockers` | Authorized manager. Blocker: severity, cause, owner. Explicit resolve/remove with cycle validation. |
| POST `/work-items/{id}/comments`, `/attachments` | Check parent permission, sanitize display, limit mentions. Upload intent, verify bytes/scan before download. Project-level equivalents too. |
| POST `/organizations/{org}/github/install` | `repo.connect`: bind org + initiator + nonce. Verify completed installation before granting repo access. |
| POST `/integrations/github/webhook` | Service route. Raw-body HMAC (`X-Hub-Signature-256`, HMAC-SHA256, constant-time compare), validate installation/event/action/repo, unique delivery receipt. 2xx ONLY after durable acceptance or known safe duplicate. Target response < 10 s. |
| GET `/me/notifications` | Current user/org, cursor, unread/category filters. Every destination reauthorizes. |
| PATCH `/me/notifications/{id}` | Recipient only changes read state. |
| GET `/organizations/{org}/reports/portfolio` | `project.read`; CSV also needs `report.export`. Period/as-of, filters, timezone, output. |
| GET `/organizations/{org}/reports/overdue` | Same rules. Pinned params, reauthorize on download. |

## Remaining actions
- POST `/projects/{id}/scope-versions`; POST `/scope-versions/{id}/approve` - `project.scope.change`: leaf/weight diff, unit, reason, expected base. Approval atomically activates baseline, snapshots progress, notifies.
- POST `/projects/{id}/acceptance-requests`; POST `/acceptance-requests/{id}/decisions` - bind checklist to current mode/baseline/check-in + current JPA version. Validate permission, readiness, waivers, current revision.
- POST `/projects/{id}/close`; POST `/projects/{id}/archive` or `/restore` - closure and archive authorized separately, audited. Restore returns prior lifecycle; history unchanged.
- Also: scoped CRUD for teams/members/roles, invite resend/revoke, repo link/sync/revoke, review inbox, My Work, calendar, settings, notification prefs, audit, privacy requests. No AI/billing/extra connector endpoints.

## Worked fixtures (use in contract tests)
1. **Check-in:** POST `/projects/p_crm/checkins`, `Idempotency-Key: k1`, body `{"percent":45,"accomplished":"Lead import works","next_steps":"Test call routing","blockers":[],"projected_finish":"2026-11-20"}` -> 201 with `checkin_id`, `method="developer_reported"`, `percent=45`, version, `captured_at`. Replay k1 adds no second check-in.
2. **Approve scope:** PM approves scope v2 against expected v1 (+1 leaf weight 25). Commit v2 + 50/125 snapshot + `ScopeChanged` in one transaction. Competing edit expecting v1 -> 409 `STALE_VERSION`.
3. **Stale review:** reviewer approves revision 4 after developer submitted revision 5 -> 409 `STALE_REVIEW`; task stays pending for rev 5; no Done, no % change, no approval alert.
4. **Shared repo event:** signed delivery mentions `CRM-101`; resolve only an unambiguous task in an authorized project. Duplicate receipt returns success and adds no link/credit. No unique eligible task -> event stays unassigned.
5. **Operational failures:** email failure retries subject to current access; export re-run reuses pinned query; GitHub outage shows last sync, manual actions stay writable, then reconcile.

## Domain events
Envelope: stable `event_id`, `org_id`, entity id, actor, aggregate version, time.
Set: ProjectCreated, ProjectModeChanged, CheckInSubmitted, WorkItemCompleted, ScopeChanged, DeadlineChanged, BlockerRaised, ReviewRequested, GitEventProcessed, ProjectHealthChanged, NotificationRequested. Add explicit reopening, acceptance and revocation events.

## GitHub ingestion rules
Minimal read permissions, explicit repo selection. Bind installation callback state to initiating org + admin. Identify developers only by explicit member mapping (never login/email alone). Dedupe `X-GitHub-Delivery`; same key + conflicting content -> quarantine. Bounded retry/backoff -> failed queue -> operator recovery. Keep event time, received time, upstream id, state version; older events never overwrite newer confirmed state. GitHub does NOT auto-redeliver: provide authorized redelivery or periodic reconciliation; mark history gaps. Revocation stops new sync, manual work continues. Parse exact task keys like `CRM-101`. Show separate last code update / task update / deployment / sync. No code event changes accepted-work credit.

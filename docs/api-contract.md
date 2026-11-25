# API contract (all paths under /v1)

## Conventions
- `Idempotency-Key` on retriable mutations, scoped to caller + org + route. Same key + same body -> earlier result. Same key + different body -> 409.
- JPA `@Version` on conflicting edits. Stale -> 409 `STALE_VERSION`. Stale review -> 409 `STALE_REVIEW`.
- Request DTO records use Jakarta Bean Validation with `@Valid`; springdoc-openapi generates the OpenAPI specification used to generate web client types.
- Errors: `{ code, message, request_id, field_errors }`. Status: 400/422 validation, 401 unauthenticated, 403 missing permission, 404 foreign/unknown, 409 conflict, 429 limited, 503 unavailable.
- Lists: cursor pagination, deterministic order with unique ID tiebreaker. Pagination never bypasses filter or scope.
- Authenticated account decides eligible org scope. Never accept trusted `org_id` in a body.

## Identity and authentication
| Method + path | Permission and behavior |
|---|---|
| POST `/auth/signup` | Public: email, password, name, and optionally organization name/slug/timezone/calendar (older clients receive a generated UTC workspace). Create the user, organization, owner membership/grant, audit/outbox records, and org-bound session in one transaction. The public request cannot assign a role; the registrant is always an Organization Owner. |
| POST `/auth/signin` | Public: email and password. Create a session bound to the user's active organization, except platform administrators, which remain unbound. |

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

## Project delivery flow (2026-11-25)
| Method + path | Behavior |
|---|---|
| GET `/organizations/{org}/project-setup/options` | `project.create`. Active members except Owner/Admin with name, role, open tasks and active projects; org time zone and today; upload limits. |
| POST `/organizations/{org}/project-setup` | `project.create`, Idempotency-Key. One transaction: project, documents (staged ids), phases (no points) and tasks (title, phase, whole points 1..100, optional dependency, optional assignee among the developers; total at most 100, 422 POINTS_OVER_LIMIT), team lead / developers / QA, approvers, scope version 1 (POINTS), audit + outbox. Start today or later; end on or after start. Owner/Admin = 422 ROLE_NOT_ASSIGNABLE; foreign member = 404. |
| GET/PUT `/projects/{id}/approvers` | Read: project readable. Replace: `project.edit` + expected_version (project). Stored as PROJECT-scoped PROJECT_APPROVER grants. |
| POST `/work-items/{id}/reviews` | Now: the caller must hold a PROJECT-scoped task.review grant on the task's project (a chosen approver) and is neither the assignee (403 SELF_REVIEW_NOT_ALLOWED) nor the submitter. A designated per-task reviewer narrows it further. The decision records the evidence reviewed (`submission:<id>; commits:<sha,...>`). |
| GET `/me/review-queue` | Team tasks In review and Solo submissions pending, only in projects where the caller approves, never own work. |
| GET `/work-items/{id}/activity` | Append-only audit history of the task. |
| GET `/checkins/{id}` | One Solo submission with its project and approved figure (404 if unreadable). Submissions now accept `evidence_items` [{type, ref, label}]; decisions by a chosen approver (or the team lead, 2.2). |
| GET `/organizations/{org}/progress-overview` | Readable projects: approved percent or "Not reported", method label, Solo pending % separately, state counts, open blockers. |
| POST `/organizations/{org}/files` (multipart) | kind PROJECT_DOCUMENT (staged with `project.create`, or `project.edit` on project_id) or SCREENSHOT (task assignee via work_item_id, or the Solo developer via project_id). 422 FILE_REJECTED on type/size/signature. |
| GET `/projects/{id}/files`, `/work-items/{id}/files`, `/files/{id}/content`; DELETE `/files/{id}` | Readable project only (staged: uploader only); 404 otherwise. Delete = staged uploads only. |
| GET/PUT/DELETE `/projects/{id}/github`; POST `/projects/{id}/github/webhook-secret` | `repo.connect` to change (403 REPO_CONNECT_REQUIRED: "ask an admin"). PUT {repository, token}: verified against GitHub, token stored encrypted, never returned; the webhook secret is returned once. Rotate/disconnect take expected_version. |
| GET `/work-items/{id}/commits`, POST `.../commits/refresh`; GET/POST `/projects/{id}/commits[/refresh]` | Commits and PRs linked by task key (Solo: project key). Fetched automatically after a submission. Evidence only. |
| POST `/integrations/github/webhooks/{connectionId}` | Public, HMAC-SHA256 of the raw body with the connection secret (401 otherwise), repository must match (422), X-GitHub-Delivery stored once (replay = 200 duplicate). push and pull_request link by key. |
| GET `/organizations/{org}/github/app` | Member. {configured, app_slug, can_manage, installations[{id, account, account_type, repository_selection, status, project_count, manage_url, version}]}. |
| POST `/organizations/{org}/github/app/install` | Org-wide `repo.connect` (Owner/Admin). {return_to?: own org page} -> {install_url}; one-time state (10 min, user + org bound, hash stored). 503 GITHUB_APP_NOT_CONFIGURED. |
| POST `/integrations/github/app/callback` | Signed-in installer. {state, installation_id, code, setup_action}. 400 GITHUB_STATE_INVALID / GITHUB_STATE_EXPIRED / GITHUB_AUTHORIZATION_REQUIRED, 409 GITHUB_STATE_USED / GITHUB_INSTALLATION_IN_USE, 403 GITHUB_INSTALLATION_NOT_YOURS. Audited. |
| DELETE `/organizations/{org}/github/app/installations/{id}` | Org-wide `repo.connect`, expected_version. Removes it from Prowise; its project links are disconnected (history stays). |
| GET `/projects/{id}/github/app/repositories?installation_id=`, `/branches?installation_id=&repository=`; POST `/projects/{id}/github/app/validate` | `repo.connect` on the project; foreign project or installation 404. Validate returns {ok, repository, branch, account, checks[{key, label, ok, detail, required}]} (repository_access, branch, commits, pull_requests, webhook, not_in_use). Same three under `/project-drafts/{id}/github/...` for the draft creator. |
| PUT `/projects/{id}/github/app` | `repo.connect` on the project. {installation_id, repository, branch, expected_version (required to change a live link)} -> {connection, imported}. 409 REPOSITORY_IN_USE / REPOSITORY_ALREADY_CONNECTED / STALE_VERSION, 422 GITHUB_BRANCH_NOT_FOUND / GITHUB_NO_ACCESS / GITHUB_REPO_NOT_FOUND. Audited (repository.connected / repository.changed). |
| POST `/projects/{id}/github/sync`; GET `/projects/{id}/github/activity?type=&branch=&author=&q=&page=&size=` | Sync: `repo.connect`, imports recent commits + PRs (deduplicated). Activity: project readers; {connected, repository, branch, last_synced_at, items[{type, sha, pr_number, title, author, branch, base_branch, state, occurred_at, additions, deletions, files_changed, task_keys}], total, page, size, branches, authors}. Evidence only. |
| POST `/integrations/github/app/webhook` | Public, HMAC-SHA256 with GITHUB_APP_WEBHOOK_SECRET (401). push / pull_request routed by installation + repository (unlinked = 200 ignored), delivery stored once; installation (deleted/suspend/unsuspend) and installation_repositories update installations and links. |

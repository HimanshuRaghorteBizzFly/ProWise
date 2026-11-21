# Build progress (update after every task)

**Current task:** 1.1
**Credit rule:** only a Completed task with accepted prerequisites, evidence and a completion date earns its points. Reopened prerequisite suspends dependents. Overall % = sum of earned points (total = 100).

Status key: `[ ]` not started, `[~]` in progress, `[x]` done (all "Pass when" tests green), `[!]` blocked

## Phase 0: Policy and design (8 pts) -> docs/tasks/phase-0.md
- [ ] 0.1 Agree release scope and decision owners (2)
- [ ] 0.2 Approve journeys and scoped roles (2)
- [ ] 0.3 Fix progress and calendar examples as fixtures (2)
- [ ] 0.4 Build and test environments (2)

## Phase 1: Workspace foundation (14 pts) -> docs/tasks/phase-1.md
- [ ] 1.1 Organizations, identity, sessions (3)
- [ ] 1.2 Invitations, teams, ownership (3)
- [x] 1.3 Permissions on every access path (4)
- [ ] 1.4 Transactions, history, outbox (4)

## Phase 2: Projects and Individual Ownership (14 pts) -> docs/tasks/phase-2.md
- [ ] 2.1 Project records (4)
- [ ] 2.2 Individual progress and corrections (4)
- [ ] 2.3 Working calendar and cadence (3)
- [ ] 2.4 Deliver, close, archive, restore (3)

**MVP checkpoint: after 2.4 (about 36 pts). Demo and commit a tag `v0.1-individual`.**

## Phase 3: Structured delivery (21 pts) -> docs/tasks/phase-3.md
- [ ] 3.1 Breakdown and assignment (3)
- [ ] 3.2 Scope approval and versions (3)
- [ ] 3.3 Review and rework (4)
- [ ] 3.4 Dependencies and blockers (3)
- [ ] 3.5 Calculate accepted work and snapshot (4)
- [ ] 3.6 Switch modes and accept structured delivery (4)

## Phase 4: Repositories and evidence (13 pts) -> docs/tasks/phase-4.md
- [ ] 4.1 Connect GitHub repos (3)
- [ ] 4.2 Receive, replay, reconcile events (4)
- [ ] 4.3 Attribute activity without claiming completion (3)
- [ ] 4.4 Comments and files (3)

## Phase 5: Delivery monitoring (19 pts) -> docs/tasks/phase-5.md
- [ ] 5.1 Schedule health (4)
- [ ] 5.2 Reminders, approvals, escalations (4)
- [ ] 5.3 Portfolio, search, My Work (3)
- [ ] 5.4 Timelines and workload (3)
- [ ] 5.5 Reports and CSV (3)
- [ ] 5.6 Privacy operations and support audit (2)

## Phase 6: Validation and rollout (11 pts) -> docs/tasks/phase-6.md
- [ ] 6.1 Full contract and workflow suite (3)
- [ ] 6.2 Access, accessibility, browsers (3)
- [ ] 6.3 Benchmark, restore, rollback (3)
- [ ] 6.4 Pilot both modes and decide rollout (2)

## Totals
Earned: 0 / 100 | Remaining: 100%

## Notes / evidence log
(one line per finished task: date | task | evidence such as test names or commit)
2026-11-16 | 0.4 | Completed: backend `mvnw test` passed (64 tests) against isolated PostgreSQL with Flyway and worker/ShedLock integration; live `/v1/health` returned 200 with generated and echoed `X-Request-Id`; frontend lint/build, Vitest (9 tests), and TypeScript checks passed; environment, sandbox, GitHub/email fixtures and OpenAPI contract checks passed.
2026-11-16 | 1.1 | In progress evidence: Flyway V2 identity schema, organization/owner atomicity and rollback, IANA timezone validation, duplicate slug conflict, session revocation, refresh-family reuse detection, rate limiting, HttpOnly refresh cookies, real frontend auth wiring; backend 69 tests passed; frontend typecheck, lint, Vitest (9 tests), and production build passed. Task remains unchecked pending review.
2026-11-16 | Restructured into frontend/ and backend/ | Repository layout moved with git mv; path references updated.
2026-11-16 | Production layout: frontend/ backend/ database/ | Frontend, backend and database deployment layout configured.
2026-11-17 | Owner UI Step 2: shared components | Added accessible KPI, panel, chart, table and page-state components; frontend lint, typecheck, production build and all 16 frontend tests pass. Pending owner review; no project-task checkbox changed.
2026-11-17 | Owner UI Step 3: dashboard | Added an org-scoped, read-only fixture dashboard with separate progress methods, permission-gated project data, and explicit later placeholders for unavailable member, audit and workload data; 25 frontend tests pass and production build succeeds. Pending owner review; no project-task checkbox changed.
2026-11-17 | Owner/Admin UI batch 1: permissions hook | usePermissions moved to documented dot-keys from GET /v1/me/permissions with a dev-only fixture (NEXT_PUBLIC_USE_MOCKS=true or API unreachable; never on 401/403/404; never in production); ORG/PROJECT scope; owner consumers renamed (org.manage, project.read). Pending owner review; no project-task checkbox changed.
2026-11-17 | Backend follow-up (not started) | GET /v1/me/permissions returns flat keys and includes PROJECT-scoped grants without scope, so the frontend treats every key as ORG and shows "scope not reported by API". Return { key, scope, scopeId } per grant.
2026-11-17 | Owner/Admin UI batch 2: shared org shell | PanelLayout, Sidebar and TopNav restyled to the SuperAdminShell look (h-14 header, 256/68px sidebar, Inter, app tokens, --page-gutter); drawer below lg with focus trap, Esc and return focus; reduced motion respected; skip link; Owner/Admin menus permission-filtered (billing, subscriptions, workspaces removed); Sample data badge in TopNav; dev-only proxy 502/503/504 fallback. 83 frontend tests pass; lint, typecheck and production build pass. Pending owner review; no project-task checkbox changed.
2026-11-17 | Owner/Admin UI batch 3: shared pieces + Dashboard, Access Map, Members, Roles | OwnerLaterBadge, primitives re-export, shared classifyFailure, useOrgResource, Sample data registry; Owner and Admin wrappers (own gates) for dashboard, access, members, roles-permissions; Members/Roles read API with dev fixture, writes Later. 132 frontend tests pass; lint, typecheck and production build pass. Pending owner review; no project-task checkbox changed.
2026-11-17 | Owner/Admin UI batch 4a: Invitations, Teams, Projects portfolio, Health & risks | Owner and Admin wrappers; typed fixtures (token never rendered) with Sample data badge, Later state in production builds; writes Later (1.2, 2.1, 2.4, 5.3, 5.1); date-only deadlines in project zone; Roles writes relabelled "Later · after task 1.4". 161 frontend tests pass; lint, typecheck and production build pass. Pending owner review; no project-task checkbox changed.
2026-11-17 | Owner/Admin UI batch 4b: remaining pages, redirects, screen map | Integrations, Reports, Notifications, Audit (incl. admin/audit-logs), Data & privacy (Owner only), Organization settings read-only with danger zone; six approved redirects; docs/screen-map.md; dashboard shows Later state in production; "From the project record" label. 201 frontend tests pass; lint, typecheck and production build pass. Pending owner review; no project-task checkbox changed.
2026-11-20 | Frontend error fixes | Repaired the Manager dashboard duplicate copy: missing Download/Filter/other imports, undefined router/table/state symbols, and stale acceptance-store references; fixed Viewer no-org dashboard fallback. Frontend lint passes, TypeScript passes, and 228 Vitest tests pass. Production build stalled in this environment and was stopped; no project-task checkbox changed.
2026-11-20 | 1.3 | Evidence (pending owner verification; box NOT ticked by this change): new migration V10__task_1_3_tenant_enforcement (sessions.org_id, org_id + indexes on developer child tables, org_id required on new rows, security_evidence.target_ref and append-only trigger). PermissionService: org-bound token + ACTIVE membership + scoped grant (ORG or PROJECT incl. text project ids); foreign/unknown/unselected org = 404 + evidence; missing key = 403. RoleService least privilege (create/edit/delete/grant/revoke need every key at that scope; SELF_ELEVATION_DENIED; owner template only via transfer TODO(1.2); PROJECT grant must target this org's project). Org switch revokes the old session and issues an org-bound token; refresh keeps the binding while membership is ACTIVE. Developer API secured: org from token only, org-scoped lookups, 404 for foreign/unreadable objects, key + relationship checks. Platform routes require platform authorities. ArchUnit: @PreAuthorize on every handler with PUBLIC_ENDPOINTS and AUTHENTICATED_ONLY_ENDPOINTS lists. GET /v1/me/permissions returns scoped grants. Tests: backend 131 passed (TenantAccessIntegrationTest T04/T05/T06/AS-07: project-scoped grant, foreign task/file/notification IDs, evidence + append-only, org switch invalidates old token and counts, disabled membership, self-elevation, DB rejects foreign custom role grant, platform routes; PermissionMatrixSeedIntegrationTest; AuthorizationArchitectureTest; DeveloperServiceTest), run against an isolated prowise_test schema. Frontend: org-console Roles & permissions (list, create, detail/edit, assign) on the real API with /v1/me/permissions, access states, workspace switch clears caches; lint (no errors), typecheck, 246 Vitest tests and production build pass. Open: export downloads TODO(5.5), file downloads TODO(4.4), audit/outbox/idempotency for role changes TODO(1.4).
2026-11-21 | 2.1 | Evidence (pending owner verification; box NOT ticked by this change): Flyway migration V13__task_2_1_projects (projects version, archived, previous_lifecycle, accountable_developer_id, calendar_ref, active_baseline_id, scope_description, ck_project_lifecycle with AWAITING_ACCEPTANCE, uq_projects_org_key, project_members, project_date_history, project_ownership_history). ProjectService & ProjectController: multi-tenant REST APIs (POST/GET /v1/organizations/{orgId}/projects, GET/PATCH /v1/projects/{id}, POST /v1/projects/{id}/archive, POST /v1/projects/{id}/restore, GET/POST/DELETE /v1/projects/{id}/members). Atomic ChangeRecorder (audit_log + outbox_event). Optimistic locking (@Version / expectedVersion -> 409 STALE_VERSION). Date change history with required reason. Foreign project resolution 404 with security evidence logged. T09, T11, T16 verified in ProjectManagementIntegrationTest (11 tests pass). Individual mode requires ZERO tasks with 0% initial progress (no fake progress from git/tasks). Frontend: apiClient project endpoints, useProjectsApi hook, ProjectCard with zero-task indicator, ProjectFormModal, ProjectMembersModal, ProjectsPortfolioView real wiring, OrgPages and create-project page connected. Frontend TypeScript, ESLint, and 252 Vitest tests pass (23 test files).
2026-11-21 | 2.2 | Evidence (pending owner verification; box NOT ticked by this change): Flyway migration V14__task_2_2_progress_verification (require_verification, last_progress_method, last_reported_at, revision_of, revision_seq, method, evidence JSONB, review_comment, reviewed_at, idempotency_key, captured_at, ck_checkin_status with PENDING/PENDING_VERIFICATION/ACCEPTED/REJECTED/CHANGES_REQUESTED, uq_checkins_idempotency, project_repository_links, github_activity project_id). ProgressService & ProgressController REST APIs (POST /v1/projects/{projectId}/checkins with Idempotency-Key header, GET /v1/projects/{projectId}/checkins, GET /v1/projects/{projectId}/checkins/summary, POST /v1/checkins/{checkinId}/verify, GET /v1/organizations/{orgId}/reviews/pending, GET /v1/projects/{projectId}/github-activity, PUT /v1/projects/{projectId}/settings/verification). Atomic ChangeRecorder (audit_log + outbox_event). T17 (valid 0..100 range, dated entry with checkin_id, DEVELOPER_REPORTED, captured_at, zero tasks, idempotency replay), T18 (downward correction requires reason, throws 400 without reason, appends revision_of and revision_seq without overwriting history), T28 ("Developer reported" label preserved upon verification), AS-01 (100% progress does not auto-close delivery, project remains ACTIVE; repo events have distinct timestamps) verified in ProgressVerificationIntegrationTest (4/4 tests pass). Frontend: apiClient progress methods, useProgressApi hook, CheckInSubmissionModal with slider, downward reason requirement, GitHub commits/PRs picker, and idempotency key; VerificationReviewModal with progress comparison, code evidence review, self-approval prevention, Approve/Request Changes/Reject actions; CheckInAuditTrail with T28 "Developer reported" label, revision history, and status badges; real wiring of Developer Workspace and Team Lead Check-Ins page. Frontend TypeScript, ESLint, and 256 Vitest tests pass across 24 test files (including progress-verification.test.tsx).
2026-11-21 | 2.3 | Evidence (pending owner verification; box NOT ticked by this change): Flyway migration V15__task_2_3_calendar_and_cadence (org_calendar, project_cadence, due_occurrences, project_cadence_history, reminder_candidates). CalendarCadenceService & CalendarController REST APIs: GET/PUT /v1/organizations/{orgId}/calendar, POST/DELETE /v1/organizations/{orgId}/calendar/holidays, GET/PUT /v1/projects/{projectId}/cadence, POST /v1/projects/{projectId}/deadlines/reschedule, GET /v1/projects/{projectId}/occurrences, GET /v1/projects/{projectId}/schedule-summary, GET /v1/organizations/{orgId}/reminders/candidates. Atomic ChangeRecorder (audit_log + outbox_event). Pure domain WorkingCalendar (addWorkingDays, cutoffDateTime, DST offset conversions). Business rules: Friday deadline + 1 working-day grace + Monday holiday -> Tuesday grace; DST cutoff instant handling; ON_HOLD lifecycle suspends schedule, occurrences, and reminders (PAUSED status); rescheduling requires mandatory reason and records versioned history, superseding old occurrences; unique window constraint prevents duplicate active occurrences. Verified in CalendarCadenceIntegrationTest (5/5 tests pass). Frontend TypeScript and 262 Vitest tests pass.
2026-11-21 | 2.4 | Evidence (pending owner verification; box NOT ticked by this change): Flyway migration V16__task_2_4_delivery_lifecycle_archive (acceptance_requests, acceptance_decisions, project_blockers, project_blocker_waivers, project_closures, project_lifecycle_history). DeliveryLifecycleService & DeliveryLifecycleController REST APIs: POST/GET /v1/projects/{projectId}/acceptance-requests, POST /v1/acceptance-requests/{requestId}/decisions, POST /v1/projects/{projectId}/close, POST /v1/projects/{projectId}/reopen, POST /v1/projects/{projectId}/lifecycle, GET /v1/projects/{projectId}/delivery-status, POST/GET /v1/projects/{projectId}/blockers, POST /v1/projects/{projectId}/blockers/{blockerId}/waiver, POST /v1/projects/{projectId}/blockers/{blockerId}/resolve, GET /v1/projects/{projectId}/lifecycle-history, GET /v1/projects/{projectId}/closures. Atomic ChangeRecorder (audit_log + outbox_event). Business rules: Lifecycle PLANNED -> ACTIVE -> AWAITING_ACCEPTANCE -> DELIVERED -> CLOSED; 100% progress does not auto-deliver or close; developer self-approval forbidden (403, D04); critical open blockers prevent delivery acceptance (422 UNWAIVED_CRITICAL_BLOCKERS) until named waiver is approved; closure restricted to DELIVERED projects with handover note and reason; optimistic locking (@Version / expected_project_version -> 409 STALE_VERSION); archive stops edits and requests (409 PROJECT_ARCHIVED); restore returns project to previous_lifecycle. Verified in DeliveryLifecycleIntegrationTest (3/3 tests pass). Frontend: apiClient delivery methods, useDeliveryApi hook, DeliveryAcceptanceModal with checklist and GitHub evidence, DeliveryReviewModal with blocker check and inline waiver granting, ProjectClosureModal, BlockerManagementModal, real wiring of Developer Workspace with Delivery & Lifecycle tab. Frontend TypeScript, ESLint, and 262 Vitest tests pass across 25 test files (including delivery-lifecycle.test.tsx).

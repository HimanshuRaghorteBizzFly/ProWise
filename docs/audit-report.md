# ProWise V1 codebase audit

**Source note:** This audit used the complete repository blueprint at `docs/source/blueprint.md`.

**Audit mode:** read-only  
**Audited scope:** V1 tasks 0.1-6.4; D12 deferred items and non-V1 commercial features are not treated as required implementation.  
**Evidence boundary:** repository files were inspected while excluding `node_modules`, build output, and `docs/source/`. No file was edited, deleted, moved, or formatted during the audit.

## A. Summary

The repository is a Next.js/React/Tailwind frontend prototype. It has no Spring Boot API, PostgreSQL schema, Flyway migrations, worker profile, server-side authorization, or executable backend tests. The mock adapters are therefore **KEEP as migration scaffolding**, but they must be replaced by real `/v1` API calls rather than deleted as junk.

The counts below count **classification rows/groups** in this report; a grouped row can contain several physical files. Every physical route/component/hook/utility/mock file is listed in the inventory in section B.

| Category | Count | Meaning |
|---|---:|---|
| KEEP | 20 | Useful V1 UI, domain fixture, or replacement-scaffolding evidence mapped to a task |
| CHANGE | 18 | Maps to V1 but violates a documented contract or security/domain rule |
| DELETE | 8 | Clearly out of scope, commercial, duplicate, or generated/template-only material |
| DEFER | 2 | Partly represented but belongs to a later/deferred scope decision |
| UNSURE | 7 | Requires product/cleanup decision; no safe deletion inference |

### What is present

- **Web:** 181 `page.tsx` route files, 50 shared components, 6 hooks, 8 `src/lib` utilities/data files, 28 feature barrel files, 3 providers, 6 stores, 4 config files, and 9 type files.
- **API:** absent. There is no `backend`, `pom.xml`, Maven wrapper, Java source, Spring configuration, controller, service, entity, repository, DTO, security configuration, scheduled job, or worker profile.
- **Database:** absent. There are no Flyway SQL migrations, PostgreSQL DDL files, tables, indexes, or constraints.
- **Tests:** no `*.test.*` or `*.spec.*` file. `frontend/scripts/verify-all-scenarios.mjs` is a console assertion script, not a test-runner test file.
- **Mocks/adapters:** `src/lib/mock-data.ts`, `src/lib/mock-api.ts`, `src/proxy.ts`, Zustand stores, and seeded platform/operator stores provide the current behavior and are part of the replacement plan.
- **Environment:** no `.env*`, `application*.yml/properties`, Docker Compose, CI workflow, or runtime environment variable declaration was found. No `process.env` or `NEXT_PUBLIC_*` use was found.

## B. Inventory and classification

### B1. Web pages/routes

All 181 route files are listed below. `page.tsx` is omitted from the route label where the route is obvious. Route groups in parentheses are Next.js route groups and do not appear in the URL.

| Path group | Routes present | Category | Task or rule | Evidence | Risk if removed |
|---|---|---|---|---|---|
| `src/app` | `/`, `/unauthorized`, `error`, `loading`, `not-found` | KEEP | 0.4, 1.3, 6.2 | App shell/error and entry routes exist; permission-denied and empty/error UI are directly relevant. | high |
| `(auth)` | `/callback`, `/create-organization`, `/forgot-password`, `/login`, `/reset-password`, `/select-org`, `/select-workspace`, `/signup`, `/verify-email` | CHANGE | 1.1 | Auth/workspace journeys are represented, but authentication is seeded client state and not a server session. | high |
| `(platform)/platform-operator` | `/`, `/access-requests`, `/activity-logs`, `/alerts`, `/announcement-drafts`, `/api-errors`, `/backups`, `/dashboard`, `/email-delivery`, `/email-drafts`, `/failed-events`, `/github-monitoring`, `/incidents`, `/integration-health`, `/invoice-delivery`, `/maintenance`, `/monitoring`, `/organization-status`, `/org-status`, `/payment-failures`, `/settings`, `/subscription-status`, `/support-tickets`, `/sync-jobs`, `/tickets`, `/webhook-logs`, `/webhooks` | DEFER | 4.2, 5.6, 6.3; D12 for escalation/digests and deployment detail | Operator/support UI is partly useful for later outbox, support-audit, and recovery work, but all behavior is seeded frontend state. | medium |
| `(platform)/super-admin` | `/`, `/access-approvals`, `/account`, `/announcements`, `/api-monitoring`, `/audit`, `/configuration`, `/configuration/maintenance`, `/dashboard`, `/emails`, `/email-settings`, `/email-templates`, `/github-integrations`, `/incidents`, `/integrations`, `/integration-settings`, `/invoices`, `/operators`, `/organizations`, `/payments`, `/plans`, `/reports`, `/roles`, `/roles-permissions`, `/security`, `/settings`, `/subscriptions`, `/support`, `/webhooks` | CHANGE | 1.3, 5.6 for restricted audit/support/integration surfaces | Platform role exists, but routes expose role-driven client UI with no server enforcement; billing, plans, payments and subscriptions contradict the V1 no-billing scope. | high |
| `(platform)/super-admin` commercial pages | `/plans`, `/subscriptions`, `/payments`, `/invoices`, `/email-settings`, `/email-templates`, `/emails` | DELETE | V1 scope; D12 T16; no billing/extra commercial connectors | The project instructions explicitly exclude billing; T16 templates is deferred. Sidebar and seeded stores expose these pages. | medium |
| `(workspace)/org/[orgId]/admin` | `/`, `/dashboard`, `/activity`, `/integrations`, `/invitations`, `/members`, `/projects`, `/reports`, `/repositories`, `/roles-permissions`, `/settings`, `/teams` | CHANGE | 1.2, 1.3, 4.1, 5.5 | Correct role surface exists, but `orgId` is URL/client state and no server tenant query exists. | high |
| `(workspace)/org/[orgId]/owner` | `/`, `/audit-logs`, `/billing`, `/dashboard`, `/integrations`, `/invitations`, `/members`, `/organization`, `/projects`, `/reports`, `/roles-permissions`, `/settings`, `/subscriptions`, `/teams`, `/workspaces` | CHANGE | 1.1-1.4, 2.1, 5.6 | Owner workflows are represented; billing/subscriptions are out of scope and authorization is only client-side. | high |
| `(workspace)/org/[orgId]/owner` commercial pages | `/billing`, `/subscriptions` | DELETE | V1 no billing | These are explicitly outside V1 and have no corresponding progress task. | low |
| `(workspace)/org/[orgId]/manager` | `/`, `/create-project`, `/dashboard`, `/deadlines`, `/delivery`, `/delivery-approvals`, `/dependencies`, `/progress`, `/project-planning`, `/projects`, `/reports`, `/reviews`, `/scope`, `/settings`, `/team-assignments`, `/work-items`, `/workload` | CHANGE | 2.1-2.4, 3.1-3.6, 5.1-5.5 | UI maps to project, scope, review, health, workload, and acceptance tasks; state mutations are local store updates without version/idempotency/transaction boundaries. | high |
| `(workspace)/org/[orgId]/lead` | `/`, `/activity`, `/assignments`, `/blockers`, `/dashboard`, `/dependencies`, `/my-team`, `/progress`, `/projects`, `/reports`, `/reviews`, `/sprint-planning`, `/team`, `/work-items`, `/workload` | CHANGE | 3.1, 3.3, 3.4, 5.4 | Work assignment, blockers, dependencies, reviews, and workload screens exist, but no server relationship checks or cycle-safe persistence exists. | high |
| `(workspace)/org/[orgId]/developer` | `/`, `/blockers`, `/checkins`, `/check-ins`, `/comments`, `/dashboard`, `/deadlines`, `/evidence`, `/my-work`, `/notifications`, `/progress`, `/projects`, `/repositories`, `/settings`, `/tasks` | CHANGE | 2.2-2.4, 4.3-4.4, 5.2-5.3 | Individual and structured screens exist; duplicate `/checkins` and `/check-ins` route concepts are present, and data comes from seeded stores. | high |
| `(workspace)/org/[orgId]/developer/projects/[projectId]` | `/`, `/individual`, `/individual/check-ins`, `/individual/deadlines`, `/individual/delivery-status`, `/individual/evidence`, `/individual/new-check-in`, `/individual/progress-history`, `/structured`, `/structured/blockers`, `/structured/dependencies`, `/structured/evidence`, `/structured/my-tasks`, `/structured/progress`, `/structured/review-feedback`, `/structured/submit-review`, `/structured/tasks/[taskId]` | CHANGE | 2.2-2.4, 3.1-3.6, 4.3-4.4 | The two modes and their key flows are represented. They do not call the documented REST contract and do not enforce accountable-owner/assignee checks. | high |
| `(workspace)/org/[orgId]/reviewer` | `/`, `/approvals`, `/assigned-reviews`, `/checklists`, `/dashboard`, `/evidence`, `/history`, `/queue`, `/rejected-work`, `/reports`, `/review-history`, `/review-queue`, `/settings`, `/test-checklists`, `/work-items` | CHANGE | 3.3, 3.5, 3.6, 5.3 | Review UI and stale-review wording exist, but review acceptance is a local store operation with no authenticated reviewer or transaction. | high |
| `(workspace)/org/[orgId]/viewer` | `/`, `/activity`, `/dashboard`, `/delivery-status`, `/milestones`, `/notifications`, `/progress`, `/projects`, `/reports`, `/settings` | CHANGE | 5.3, 5.5 | Read-only views exist, but `VIEWER` is granted `report:export` in client permissions, contrary to the docs' separate export grant. | high |
| Duplicate/re-export routes | `developer/checkins` vs `developer/check-ins`; multiple role `dashboard` and role root pages re-export or duplicate screens | UNSURE | 5.3 navigation clarity | Some are intentional aliases, but no route manifest or reference evidence establishes which is canonical. | medium |

### B2. Components

| Path(s) | What it is | Category | Task or rule | Evidence | Risk if removed |
|---|---|---|---|---|---|
| `src/components/charts/ActivityChart.tsx`, `ProgressChart.tsx`, `TaskStatusChart.tsx`, `WorkloadChart.tsx` | Activity, progress, task and workload visualizations | KEEP | 2.2, 3.5, 5.1, 5.3, 5.4 | Used by delivery/portfolio surfaces and map to required metrics. | medium |
| `src/components/charts/RevenueChart.tsx` | Revenue chart | DELETE | V1 no billing | Its domain is billing/commercial, explicitly out of scope. | low |
| `src/components/developer/CheckInForm.tsx`, `IndividualProjectView.tsx`, `ProgressHistory.tsx` | Individual mode UI | CHANGE | 2.2, 2.4 | Core flow exists, but writes to client state and does not call `/projects/{id}/checkins` with idempotency/error contract. | high |
| `src/components/developer/StructuredProjectView.tsx`, `TaskBoard.tsx` | Structured work/review UI | CHANGE | 3.1-3.5 | Core structured surfaces exist, but task state and progress are mutable in a local store and do not enforce approved baseline/review criteria server-side. | high |
| `src/components/feedback/EmptyState.tsx`, `ErrorState.tsx`, `PermissionDenied.tsx` | Empty/error/access-denied states | KEEP | 1.3, 5.3, 6.2 | Required UX states are explicitly called for by task cards. | low |
| `src/components/layouts/AppShell.tsx`, `DashboardHeader.tsx`, `panel-layout.tsx`, and `*Sidebar.tsx` (Admin, Developer, Lead, Manager, Operator, Owner, Reviewer, SuperAdmin, Viewer) | Role shells/navigation | CHANGE | 0.2, 1.3, 5.3 | Role-specific screens are present, but role switch/navigation is client-controlled and several links target absent routes. | high |
| `src/components/navigation/Breadcrumbs.tsx`, `GlobalSearch.tsx`, `global-search-modal.tsx`, `NotificationMenu.tsx`, `RoleSwitcher.tsx`, `WorkspaceSwitcher.tsx`, `sidebar.tsx`, `top-nav.tsx` | Navigation, search, org switch, notification UI | CHANGE | 1.3, 5.2, 5.3 | Search/org/notification surfaces do not reauthorize against a server-scoped query; role switcher changes role without membership proof. | high |
| `src/components/navigation/role-test-banner.tsx` | Frontend quick-scenario banner | UNSURE | 6.1 | It is used by app shells, but it is a prototype test aid rather than an executable contract suite; decision needed before production. | low |
| `src/components/ui/*` (`avatar`, `badge`, `button`, `card`, `ConfirmDialog`, `DataTable`, `dialog`, `health-badge`, `input`, `LoadingSkeleton`, `Modal`, `Pagination`, `progress`, `Select`, `table`, `Tabs`) | Shared UI primitives | KEEP | 0.2, 5.3, 6.2 | Shared by many routes and needed for accessibility/empty/loading states. | medium |

### B3. Hooks, utilities, mock data, providers, stores, config and types

| Path(s) | What it is | Category | Task or rule | Evidence | Risk if removed |
|---|---|---|---|---|---|
| `src/hooks/useAuth.ts`, `useOrganization.ts`, `usePermissions.ts`, `useProjects.ts` | Client auth/org/permission/project hooks | CHANGE | 1.1-1.3 | They are widely used, but role/org selection is client state and falls back to `"org-1"`; retain as API integration seams until replaced. | high |
| `src/hooks/useDebounce.ts`, `useTheme.ts` | UI helpers | KEEP | 5.3, 6.2 | Generic UI behavior; no rule conflict found. | low |
| `src/lib/mock-data.ts` | Seeded organizations, users, projects, work items, baselines, check-ins, GitHub events, notifications and platform data | KEEP | 0.4, 2.1-5.6 scaffolding | It is imported by auth, workspace, notification and project stores; docs explicitly say mock adapters are replacement planning material. | high |
| `src/app/(platform)/platform-operator/_data/seed.ts`, `src/app/(platform)/super-admin/_data/seed.ts` | Platform/operator mock seed data | CHANGE | 1.3, 5.6 scaffolding | These are consumed by the platform stores, but include commercial/SMTP/Stripe-style concepts outside V1 and must not become backend contracts. | medium |
| `src/lib/mock-api.ts`, `src/proxy.ts` | Mock API-shaped adapters | CHANGE | 0.4, all API tasks | Both are explicit mock/proxy layers; retain temporarily, but they return success without transport, auth, tenant filtering, idempotency or durable errors. | high |
| `src/lib/api-client.ts` | Generic API client | CHANGE | 0.4, API contract | `get`/`delete` return successful null data and `post`/`put` echo input without a request. | high |
| `src/lib/progress.ts` | Structured and individual progress helpers | CHANGE | 0.3, 2.2, 3.5 | Implements some fixtures, but falls back to baseline `leaf.isDone` and only checks `state === "DONE"`; it does not require criteria/review, active approved denominator semantics, or pure Java server ownership. | high |
| `src/lib/health.ts` | Health precedence helper | CHANGE | 0.3, 5.1; D12 T46 | It implements date/critical-blocker checks, but includes a health override despite D12 and omits working-day pace/staleness/critical-blocker age; must move to server-side pure Java. | high |
| `src/lib/csv.ts` | CSV generation and formula-injection sanitization | KEEP | 5.5 | The sanitizer covers `=`, `+`, `-`, `@`, tab and carriage-return prefixes. Access/audit/pinned-query enforcement still belongs to the API. | medium |
| `src/lib/validators.ts` | Zod client validation | KEEP | 0.4, 2.1, 2.2, 3.1 | Useful UX validation; not a substitute for Jakarta validation/server checks. | low |
| `src/lib/utils.ts` | Shared class-name/helper utilities | KEEP | UI foundation | Used shared utility; no scope conflict found. | low |
| `src/providers/AuthProvider.tsx`, `QueryProvider.tsx`, `ThemeProvider.tsx` | React providers | CHANGE | 1.1, 5.3, 6.2 | Theme/query scaffolding is useful; auth provider exposes seeded identity and no token/session revocation. | high |
| `src/store/auth-store.ts`, `workspace-store.ts` | Seeded identity and org switching | CHANGE | 1.1-1.3 | Initial state is authenticated and role/org can be switched locally without membership or server authorization. | high |
| `src/store/project-store.ts` | Client-side project/work/review/acceptance state machine | CHANGE | 1.4, 2.1-3.6 | It is the main prototype behavior, but mutations have no transaction, audit+outbox, idempotency, version conflict, permission, tenant or 404 semantics. | high |
| `src/store/notification-store.ts`, `maintenance-store.ts` | Client notification/platform maintenance state | DEFER | 5.2, 5.6; D12 T45/T36 | Relevant concepts exist, but durable scheduled pollers, ShedLock, access re-check and retention are later backend work. | medium |
| `src/store/theme-store.ts` | Theme preference state | KEEP | 6.2 | UI-only and within scope. | low |
| `src/config/permissions.ts` | Client role-to-action map | CHANGE | 0.2, 1.3 | Roles grant broad actions directly, including viewer export; docs require identity + active membership + scoped permission + relationship + state checks. | high |
| `src/config/routes.ts`, `navigation.ts`, `theme.ts` | Route/navigation/theme constants | CHANGE | 0.2, 5.3, 6.2 | Useful route map, but it contains billing/platform surfaces and does not ensure every generated link has a page. | medium |
| `src/features/**/index.ts` (28 files) | Feature barrel placeholders | UNSURE | V1 module organization | All 28 files exist but are not imported as feature modules; they contain only placeholder barrel text. Keep until the intended module boundary is decided. | medium |
| `src/types/*` (9 files) | Client domain/API/permission types | CHANGE | 0.4, all API/domain tasks | Helpful typed skeleton, but API error shape and pagination differ from `api-contract.md`; types are not generated from OpenAPI and include out-of-scope Stripe/SendGrid data. | high |

### B4. API and database

| Path | What it is | Category | Task or rule | Evidence | Risk if removed |
|---|---|---|---|---|---|
| `backend/**` | Expected Spring Boot backend | UNSURE | 0.4 onward | Directory does not exist. This is a missing implementation, not a deletable file; decision needed whether backend work starts now or remains a frontend spike. | high |
| `pom.xml`, `mvnw`, Java controller/service/entity/repository/DTO/config/scheduled-job files | Expected Maven/API artifacts | UNSURE | 0.4, 1.1-6.4 | No matching files exist anywhere outside excluded build/dependency directories. | high |
| `database/migrations/**` | Expected Flyway migrations | UNSURE | 0.4, 1.4 onward | No migration directory or `.sql` migration exists. No tenant tables, `org_id` indexes, version columns, audit or outbox tables can be verified. | high |

### B5. Dependencies, scripts, env/config

| Path | What it is | Category | Task or rule | Evidence | Risk if removed |
|---|---|---|---|---|---|
| `package.json`, `package-lock.json` | Frontend dependency manifest/lock | KEEP | 0.4, 6.2 | Next 14, React 18, TypeScript, Tailwind, Zod, React Query, Zustand, forms and UI dependencies are coherent with the frontend stack. | high |
| Runtime dependencies | `@hookform/resolvers`, `@tanstack/react-query`, `clsx`, `date-fns`, `framer-motion`, `lucide-react`, `next`, `react`, `react-dom`, `react-hook-form`, `recharts`, `sonner`, `tailwind-merge`, `zod`, `zustand` | KEEP | 0.4, 5.3, 6.2 | All are plausible frontend dependencies; backend dependencies are absent rather than unused. | medium |
| Dev dependencies | `@types/node`, `@types/react`, `@types/react-dom`, `autoprefixer`, `postcss`, `tailwindcss`, `typescript` | KEEP | 0.4, 6.2 | Required for the current frontend build/type system. | medium |
| `frontend/scripts/create-features.js`, `create-layouts.js`, `generate-*.js` | One-time page/layout generators | DELETE | no V1 runtime task | They generate source files but are not package scripts or imported by the app; generated output is already present. Evidence: no package script/import reference. | low |
| `frontend/scripts/missing-paths*.json`, `parsed-*.json`, `remaining-missing.json`, `requested-tree.txt`, `parsed-tree-lines.txt` | Generator/audit intermediate artifacts | DELETE | no V1 runtime task | They are generated path/tree snapshots and are not imported by application code. | low |
| `frontend/scripts/verify-all-scenarios.mjs` | Console assertion prototype for 15 scenarios | CHANGE | 6.1 | It is runnable-looking but not wired into `package.json`, lacks most negative/race/replay/DST/tenant tests, and includes only frontend helpers. | medium |
| `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts` | Frontend build/config | KEEP | 0.4, 6.2 | Appropriate frontend configuration; no backend/CI configuration exists. | high |
| `.env*`, `application*.yml/properties`, Docker Compose, CI workflow | Runtime and CI config | UNSURE | 0.4, 6.3 | No files found. Need a decision on environment ownership and CI/bootstrap requirements before API work. | high |
| `public/**` `.gitkeep` directories | Empty static asset placeholders | UNSURE | 6.2 | Only `.gitkeep` files were found; whether these directories are intentional asset contracts is not evidenced. | low |

### B6. Tests

| Path | What it is | Category | Task or rule | Evidence | Risk if removed |
|---|---|---|---|---|---|
| `frontend/scripts/verify-all-scenarios.mjs` | 15-scenario console script | CHANGE | 6.1 | It asserts a few individual/structured/CSV/health cases but is not a JUnit/Playwright/Vitest test and is not an npm script. | high |
| `src/components/navigation/role-test-banner.tsx` | UI test/scenario launcher | UNSURE | 6.1 | It is production-rendered in `AppShell`; it is not an automated test and may be prototype-only. | medium |
| `**/*.test.*`, `**/*.spec.*`, API test source | Test files | UNSURE | 0.3, 1.1-6.4 | Search found zero test files. This is a missing required test suite, not evidence that any existing test can be deleted. | high |

## C. Gap list

Status is assessed against the task's “Pass when” criteria, not merely whether a screen or mock function exists. No task is **Done** because `docs/progress.md` has every task unchecked and the required backend/test evidence is absent.

| Build sequence | Status | What is present | Missing / blocking evidence |
|---|---|---|---|
| 0.4 | Partial | Frontend package/config and mock API-shaped types exist. | No Spring/Maven setup, PostgreSQL/Flyway, worker profile, CI, env config, sample request/request ID, or credentials/logging setup. |
| 0.3 | Partial | TypeScript progress/health helpers and a few fixture assertions exist. | Required pure Java classes/tests, executable DST/calendar fixtures, full 50/100 -> 50/125 -> 16%, empty/open/cancelled/parent cases, and mode-transition fixture. |
| 1.1 | Partial | Login/signup/org-selection pages and seeded auth store exist. | OIDC/JWT/session revoke, real identity, IANA validation, transactional org+owner membership, and revoked-session denial. |
| 1.3 | Partial | Client roles, permission map, role panels, and permission-denied UI exist. | Server-side identity/membership/project/action/state checks on every path; tenant-scoped repositories; foreign-ID 404s; org-switch cache reauthorization; self-elevation denial. |
| 1.4 | Missing | Store mutations append some local audit-like entries. | JPA `@Version`, idempotency keys, one transaction for business+audit+outbox, PostgreSQL outbox/ShedLock, replay/race/crash tests, safe logs. |
| 1.2 | Partial | Members, teams, invitations and ownership pages/data are represented. | Hashed single-use invite tokens, expiry/rotation/revocation, concurrent accept uniqueness, org-bound team IDs, atomic handover, immediate revocation. |
| 2.1 | Partial | Project creation/list/detail screens and client validation exist. | Real project records, unique org key, foreign-owner rejection, permitted cursor list, versioned edits, tenant-scoped persistence. |
| 2.2 | Partial | Check-in form, append-like local history, downward-reason validation and “Developer reported” data exist. | Real endpoint, accountable-owner permission, append-only server revision, accepted/pending verification semantics, idempotency, 100% not closing delivery, contract tests. |
| 2.3 | Missing | Cadence/date fields and deadline screens exist. | Org work calendar/holidays, local cutoff/DST boundary computation, versioned occurrences, on-hold pause, date supersession and duplicate-reminder prevention. |
| 2.4 | Partial | Archive/restore flags and acceptance UI/store operations exist. | Canonical lifecycle gates, checklist/waiver authorization, stale baseline rejection, closure as separate action, archived edit blocking, reminder reconciliation, transactional audit/outbox. |
| 3.1 | Partial | Work-item types, parent IDs, assignment/reviewer fields, board UI exist. | Server hierarchy/depth/loop/cross-project validation, stable keys, active-leaf requirements, assignment history, scope proposal behavior. |
| 3.2 | Partial | Seeded baselines and scope-addition demo exist. | Immutable approved versions, one active baseline under concurrency, unit/weight validation, remove/cancel/split/reweight approval and history. |
| 3.3 | Partial | Review UI, revision fields, changes-requested reason and stale-revision helper exist. | Server reviewer relationship/permission, criteria/check validation, `STALE_REVIEW` 409, transactionally coupled credit/outbox, authorized reopening. |
| 3.4 | Partial | Blocker/dependency UI and blocker state exist. | Finish-to-Start persistence, cycle/duplicate/self-link and concurrent graph validation, successor flags, explicit predecessor removal treatment. |
| 3.5 | Partial | Client calculation and snapshot-like store updates implement basic 50/100, 40%, 16%. | Pure Java authoritative calculation, criteria/review eligibility, active-baseline denominator, parent exclusion/cancel semantics, exact snapshots and race tests. |
| 3.6 | Partial | Mode fields and a mode switch mutation exist. | Preview/remaining-scope baseline, atomic transition/history/outbox, freeze old series, failure rollback, notification once-after-commit, structured acceptance. |
| 4.1 | Partial | GitHub repository pages, repository seed types and mock events exist. | GitHub App callback nonce/org binding, selected-repo authorization, revocation behavior, repository audit, server integration. |
| 4.2 | Missing | Webhook/operator screens and mock webhook logs exist. | Raw-body HMAC, durable receipt-before-ack, unique delivery dedupe, outbox retry/reconcile, worker profile, out-of-order/revoked/forged/replay tests. |
| 4.3 | Partial | Git event types/activity screens and no-credit UI intent exist. | Explicit member mapping, authorized unique task-key resolution, separate timestamps/statuses, no server credit changes, reconciliation gaps. |
| 4.4 | Partial | Comments/evidence/file screens and attachment-like data exist. | Upload intent, byte/type/size verification, quarantine/scan/fail-closed status, short-lived authorized download, mention isolation and retention. |
| 5.1 | Partial | Client health helper has delayed/critical-blocker/unknown precedence basics. | Workday pace and age calculations, all applicable raw reasons/supporting items, stale independence, no override (D12), scheduled authoritative evaluation. |
| 5.2 | Partial | Notification store/menu and reminder-looking screens exist. | Durable occurrence keys, preference/quiet-hour rules, access re-check at creation/dispatch/open, retries, dedupe and job state. |
| 5.3 | Partial | Role dashboards, search UI, My Work/review/check-in views exist. | One permission-aware query definition for screens/counts/search, cursor pagination, metric definition/update time, access-loss/empty behavior. |
| 5.4 | Partial | Workload/dependency/timeline-like pages and fields exist. | Approved date/dependency projection, planned-vs-available hours after calendar/absence, unknown estimate, no silent successor movement. |
| 5.5 | Partial | CSV sanitizer/export helper and report pages exist. | Server pinned/as-of report queries, permission recheck on download, audit scope/row count/actor, protected cells in API export, separate measurement methods. |
| 5.6 | Partial | Audit/support/operator pages and local audit entries exist. | Restricted server audit, time-limited support access, org/account export/deletion, retention, restore/deletion replay, no private/secrets in logs. |
| 6.1 | Missing | A partial frontend scenario script exists. | Full T01-T46/AS-01..08 contract/workflow suite, negative/race/replay/DST/tenant tests, deferred dispositions, API contract generation. |
| 6.2 | Missing | Tailwind UI and theme/accessibility primitives exist. | Threat model/ASVS evidence, tenant/upload/export security verification, keyboard/screen-reader/zoom/mobile/browser matrix, critical/high findings closed. |
| 6.3 | Missing | Operator backup/maintenance mock screens exist. | Production-like benchmark, p95/RPO/RTO measurements, PITR restore/deletion replay, migration/app rollback rehearsal. |
| 6.4 | Missing | Landing/pilot-like screens and both mode demos exist. | Recorded solo/team pilot, setup/risk/delivery outcomes, support/runbook owner, rollout gate and proceed/hold/rollback decision. |

## D. Top 15 rule violations

Ordered by security/tenancy/transaction impact.

1. **No server/API enforcement at all — high.** The expected `backend` tree, controllers, services, repositories and security configuration do not exist. This blocks rules 1-7 and every REST access path.
2. **Client role names directly grant permissions — high.** [`src/config/permissions.ts`](../src/config/permissions.ts#L3) maps a role directly to actions; [`src/hooks/usePermissions.ts`](../src/hooks/usePermissions.ts#L9) checks only that map. This violates identity + active membership + scoped permission + relationship + state enforcement.
3. **Viewer is granted export — high.** [`src/config/permissions.ts`](../src/config/permissions.ts#L71) grants `report:export` to `VIEWER`; [`src/config/permissions.ts`](../src/config/permissions.ts#L79) makes it effective. The docs explicitly say viewing does not imply export.
4. **Role switching is unrestricted client state — high.** [`src/components/navigation/RoleSwitcher.tsx`](../src/components/navigation/RoleSwitcher.tsx#L29) calls `switchRole` for any role, and [`src/store/auth-store.ts`](../src/store/auth-store.ts#L57) accepts it without membership or grant verification.
5. **Org switching can select seeded organizations without authorization — high.** [`src/store/auth-store.ts`](../src/store/auth-store.ts#L62) falls back to the first org and [`src/hooks/useOrganization.ts`](../src/hooks/useOrganization.ts#L7) updates client state without authenticated active-membership validation.
6. **Hard-coded tenant fallback — high.** [`src/hooks/useAuth.ts`](../src/hooks/useAuth.ts#L17), [`src/providers/AuthProvider.tsx`](../src/providers/AuthProvider.tsx#L28), and [`src/components/layouts/AppShell.tsx`](../src/components/layouts/AppShell.tsx#L27) default to `"org-1"` instead of deriving an active membership server-side.
7. **Mock API returns success-shaped data without a request — high.** [`src/lib/api-client.ts`](../src/lib/api-client.ts#L9) and [`src/lib/api-client.ts`](../src/lib/api-client.ts#L18) do not call an endpoint; `get`/`delete` return null success data at lines 14 and 35. This can hide failed writes and bypass all error/tenant semantics.
8. **Proxy ignores expected version and idempotency — high.** [`src/proxy.ts`](../src/proxy.ts#L22) accepts `expectedVersion` but [`src/proxy.ts`](../src/proxy.ts#L31) never sends a request and [`src/proxy.ts`](../src/proxy.ts#L39) always returns status 200. No `Idempotency-Key` behavior exists.
9. **Business, audit and notification effects are not one transaction — high.** [`src/store/project-store.ts`](../src/store/project-store.ts#L204) mutates projects and local audit state, while [`src/store/project-store.ts`](../src/store/project-store.ts#L313) mutates check-ins, snapshots, projects and notifications in an in-memory setter. There is no durable outbox or transaction boundary.
10. **No optimistic concurrency/version conflict enforcement — high.** [`src/store/project-store.ts`](../src/store/project-store.ts#L240) updates projects without checking a supplied version; [`src/store/project-store.ts`](../src/store/project-store.ts#L390) increments work revisions without a stale-write check. The documented `@Version`/409 contract is absent.
11. **Individual check-in trusts caller-supplied author and accepts immediately — high.** [`src/store/project-store.ts`](../src/store/project-store.ts#L271) accepts `authorId` from the client-side action and [`src/store/project-store.ts`](../src/store/project-store.ts#L299) hard-codes `verificationStatus: "ACCEPTED"`; no accountable-membership check or optional pending verification exists.
12. **Structured progress awards `DONE` without criteria/review validation and has a baseline fallback — high.** [`src/lib/progress.ts`](../src/lib/progress.ts#L40) uses only `item.state === "DONE"` or [`src/lib/progress.ts`](../src/lib/progress.ts#L40) `leaf.isDone`, and [`src/lib/progress.ts`](../src/lib/progress.ts#L42) adds the weight. Required review/checks, reopened/cancelled semantics and server-owned calculation are not enforced.
13. **Delivery acceptance lacks readiness, checklist, waiver and stale-version gates — high.** [`src/store/project-store.ts`](../src/store/project-store.ts#L822) changes lifecycle to `DELIVERED` solely from the decision, without checking checklist state, critical blockers, current baseline/check-in, permission or a transaction.
14. **Archived projects are still mutable through ordinary store actions — high.** [`src/store/project-store.ts`](../src/store/project-store.ts#L250) only sets an `archived` flag, while [`src/store/project-store.ts`](../src/store/project-store.ts#L240) and [`src/store/project-store.ts`](../src/store/project-store.ts#L345) do not reject updates/check-ins for archived projects.
15. **Health override is implemented despite D12 deferral and health rules are incomplete — high.** [`src/lib/health.ts`](../src/lib/health.ts#L91) applies `temporaryHealthOverride`, although T46 is deferred; the same helper does not calculate working-day pace gap or critical-blocker age from the documented calendar rules.

Additional high-risk absence: no `org_id`-filtered query/repository or indexed tenant-owned table can be verified because the API and database do not exist.

## E. Needs my decision

1. **Backend start decision:** Should the next implementation task create `backend`/Maven/Spring Boot/PostgreSQL now, or is the frontend-only spike intentionally retained for another milestone? This is the largest gap and affects every task after 0.4.
2. **Generated route cleanup:** Are the duplicate aliases (`developer/checkins` and `developer/check-ins`, role root/dashboard re-exports) intentional compatibility routes, or should one canonical route be retained?
3. **Feature barrels:** The 28 `src/features/**/index.ts` files are not imported as feature modules. Should they become the target module boundaries or be removed as scaffolding?
4. **Prototype test UI:** Should `role-test-banner.tsx` and the seeded role switcher remain in development builds only, or be removed/replaced by real authentication before V1?
5. **Platform/operator scope:** Which operator pages are intended for V1 support audit/outbox recovery, and which are later operational/deployment detail (D12 T36/T45)?
6. **Commercial pages:** Confirm deletion of billing, plans, subscriptions, payments, invoices, SMTP/template pages and related seed/types. They contradict the explicit V1 no-billing/no-extra-connector scope, but removal changes the current prototype navigation.
7. **Static asset placeholders:** Confirm whether empty `public/icons`, `illustrations`, `images`, and `logos` directories are intentional contracts or disposable starter placeholders.
8. **Environment/CI ownership:** Confirm the required secret manager, OIDC provider spike owner, PostgreSQL bootstrap method, and CI workflow location. No env or CI file currently provides evidence.
9. **Health override disagreement:** The client implements temporary health override, while D12 says T46 is deferred. Confirm that the override must be removed from V1 rather than merely hidden.
10. **Route-vs-task disagreement:** The UI and types include Stripe/SendGrid, revenue, billing, subscriptions and commercial operator concepts while the V1 source of truth allows GitHub only. Confirm whether all such concepts are prototype leftovers.

## Decisions (2026-11-16)

1. Yes. The backend skeleton already exists from 0.4, so follow the roadmap.
2. Keep check-ins (kebab-case) and delete the checkins alias. Make each role’s root page redirect to `/dashboard` instead of duplicating it.
3. Delete the feature barrels. They are placeholders with no imports. Recreate a module folder only when a task needs it.
4. Keep both only in development builds, behind a flag such as NEXT_PUBLIC_DEV_TOOLS. Remove the role switcher in task 1.3, because the server must decide roles. Remove the banner before 6.1.
5. Keep for V1: access requests, audit/activity logs, failed events, webhook logs, sync jobs, integration health, GitHub monitoring. Defer (hide from the menu, build nothing now): alerts, incidents, maintenance, backups, monitoring, API errors, email delivery, tickets.
6. billing, plans, subscriptions, payments, invoices, email templates, revenue chart. Your pre-cleanup tag keeps them recoverable.
7. Keep the static asset placeholders. They are harmless.
8. Task 0.4 now provides docker-compose.yml, ci.yml and .env.example. You own the OIDC spike (later, per D10) and the production secret manager (before 6.4).
9. Remove the health override completely. T46 is deferred, so delete the code rather than hiding it.
10. All prototype leftovers. Remove them from types and seed data. Email is a generic EmailSender interface (Mailpit in dev).

**Audit stopped here. No deletion or implementation work was started.**

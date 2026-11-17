# Build progress (update after every task)

**Current task:** 1.3
**Credit rule:** only a Completed task with accepted prerequisites, evidence and a completion date earns its points. Reopened prerequisite suspends dependents. Overall % = sum of earned points (total = 100).

Status key: `[ ]` not started, `[~]` in progress, `[x]` done (all "Pass when" tests green), `[!]` blocked

## Phase 0: Policy and design (8 pts) -> docs/tasks/phase-0.md
- [ ] 0.1 Agree release scope and decision owners (2)
- [ ] 0.2 Approve journeys and scoped roles (2)
- [ ] 0.3 Fix progress and calendar examples as fixtures (2)
- [x] 0.4 Build and test environments (2)

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
Earned: 2 / 100 | Remaining: 98%

## Notes / evidence log
(one line per finished task: date | task | evidence such as test names or commit)
2026-11-16 | 0.4 | Completed: backend `mvnw test` passed (64 tests) against isolated PostgreSQL with Flyway and worker/ShedLock integration; live `/v1/health` returned 200 with generated and echoed `X-Request-Id`; frontend lint/build, Vitest (9 tests), and TypeScript checks passed; environment, sandbox, GitHub/email fixtures and OpenAPI contract checks passed.
2026-11-16 | 1.1 | In progress evidence: Flyway V2 identity schema, organization/owner atomicity and rollback, IANA timezone validation, duplicate slug conflict, session revocation, refresh-family reuse detection, rate limiting, HttpOnly refresh cookies, real frontend auth wiring; backend 69 tests passed; frontend typecheck, lint, Vitest (9 tests), and production build passed. Task remains unchecked pending review.
2026-11-17 | 1.3 | Completed: backend permission tests passed (`./mvnw test -Dtest='com.prowise.authz.PermissionAccessIntegrationTest,com.prowise.authz.TenantFilterIntegrationTest'`) with required local env vars (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SIGNING_KEY`); verified T04/T05/T06/AS-07 access checks, active-membership gate, and tenant filter enforcement.
2026-11-16 | Restructured into frontend/ and backend/ | Repository layout moved with git mv; path references updated.
2026-11-16 | Production layout: frontend/ backend/ database/ | Frontend, backend and database deployment layout configured.

# Prowise: project delivery management SaaS (multi-tenant)

Two modes: **Individual** (one accountable developer, self-reported %, no compulsory tasks) and **Structured** (weighted, approved, reviewed work). GitHub activity is evidence only and never sets completion.

## Layout
- `frontend/` Next.js (App Router), React, TypeScript, Tailwind
- `backend/` Java 21, Spring Boot 3, Spring Data JPA, Flyway, springdoc-openapi (runs as API, or as worker with profile `worker`)
- `database/` Flyway migrations, initialization, seed notes and database scripts
- PostgreSQL 16 via `docker-compose.yml`. No Redis, MinIO or Mailpit.
- `docs/` rules and tasks. `docs/source/blueprint.md` is the archive: NEVER load it whole; search it for one section only.

## Read first, every session
1. `docs/progress.md` (current task) 2. `docs/tasks/phase-N.md` (only the card you are building)
3. `docs/playbook/phase-N.md` (the prompt for the task) 4. Reference docs only if needed:
`docs/domain-rules.md`, `docs/permissions.md`, `docs/api-contract.md`, `docs/decisions.md`, `docs/audit-report.md`.

## Non-negotiable rules
1. Every tenant table has `org_id` (indexed). Every query filters by it (Hibernate filter + tests).
2. NEVER trust `org_id` from a request body. Derive it from the authenticated active membership / path + membership check.
3. Permission = identity + active membership + scoped permission + object relationship + allowed state. Server-side on every path (REST, search, jobs, downloads, exports).
4. Business change + audit row + outbox event in ONE `@Transactional` method.
5. Mutations accept `Idempotency-Key` and `expectedVersion` (JPA `@Version`). Stale write = 409 `STALE_VERSION`.
6. Foreign or unknown IDs = 404 with no metadata.
7. Error shape: `{ code, message, request_id, field_errors }` everywhere.
8. Instants in UTC; date-only deadlines keep local date + IANA zone; never add 24h across DST.
9. Progress is NEVER set from Git activity, elapsed time or task counts.
10. Progress, health and calendar logic = pure Java in `com.prowise.domain` (no Spring imports) with unit tests.
11. No secrets, tokens or private code in logs.
12. Roles are templates only; a role name grants nothing by itself.
13. Consumers dedupe by `event_id`.

## Workflow for every task (always follow)
1. Restate the task card as a checklist, list files you will touch, ask about anything ambiguous. **Wait for my OK.**
2. Write failing tests first (negative, concurrency and replay cases included).
3. Implement in order: Flyway migration, backend, OpenAPI, frontend wiring. Reuse existing code. No parallel duplicates.
4. Run and show real output: backend `cd backend && ./mvnw test`; frontend `cd frontend && npm run lint && npm run build && npm test`.
5. Self-review: missing org_id, missing transaction/audit/outbox, missing expectedVersion, skipped permission check, secrets in logs.
6. Report: files changed, test results, what is NOT covered. Update `docs/progress.md` evidence line but DO NOT tick the box; I verify first.
7. Never weaken a test to make it pass. Never edit an applied Flyway migration (add a new one). Do not add dependencies without saying why.

## Conventions
- Java base package `com.prowise`. Modules: identity, org, authz, project, work, progress, scope, review, integration, notification, reporting, audit, common.
- Migrations: `database/migrations/V<n>__task_<x_y>_<description>.sql`; UUID keys; `org_id`, `version`, `created_at`, `updated_at` on tenant tables.
- Frontend calls the API only through the typed client in `frontend/src/lib/api` (types generated from backend OpenAPI). Mock adapters are removed per screen once its real API exists.
- Tests tagged with blueprint IDs, e.g. `@Tag("T17")`, `@Tag("AS-02")`.

## Commands
- `docker compose up -d`
- `cd backend && ./mvnw test` | `./mvnw spring-boot:run` | `./mvnw spring-boot:run -Dspring-boot.run.profiles=worker`
- `cd frontend && npm install && npm run dev | lint | build | test`
- `cd frontend && node scripts/verify-all-scenarios.mjs`
- `docker compose -f docker-compose.prod.yml up --build`
- API: http://localhost:8080/v1/health  ·  Web: http://localhost:3000

## Scope
V1 only (tasks 0.1 to 6.4). Deferred (D12): T08 MFA, T16 templates, T26 board/timeline views, T36 deployment details, T45 escalation/digests, T46 health override. No AI, billing or extra connectors.

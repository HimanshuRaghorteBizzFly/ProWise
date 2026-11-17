# Project Delivery Management SaaS (multi-tenant)

A secure web workspace for software delivery. Two modes: **Individual** (one accountable developer, no compulsory tasks, self-reported %) and **Structured** (weighted, approved, reviewed work). GitHub evidence is shown separately and never sets completion.

## Read first
1. `docs/progress.md` -> find the current task.
2. `docs/tasks/phase-N.md` -> only the card for the current task.
3. Attach `docs/domain-rules.md`, `docs/permissions.md`, `docs/api-contract.md` only when needed.
Do NOT read `docs/source/`. Never load the whole docs folder.

## Stack
- Plain monorepo: `apps/web` (Next.js App Router, React, TypeScript, Tailwind CSS), `apps/api` (Maven, Spring Boot 3, Java 21, Spring Web), with the worker profile in the same Spring Boot app.
- PostgreSQL 16; Spring Data JPA (Hibernate) + Flyway migrations. Flyway SQL in `apps/api/src/main/resources/db/migration` is the data-model source of truth.
- JUnit 5, Mockito, Testcontainers (PostgreSQL) for the API; web-only unit/browser tests for `apps/web`.
- Spring Security OAuth2 resource server (JWT); BCrypt or Argon2 password encoder for local development users.

## Non-negotiable rules
1. Every tenant-owned table has `org_id`, indexed. Every query filters by it.
2. NEVER trust `org_id` from a request body. Derive it from the authenticated active membership.
3. Permission = authenticated identity + active membership + scoped permission + allowed relationship to the object + action allowed in its current state. Check on the server for every access path (REST, search, scheduled pollers, downloads, exports).
4. Business change + audit row + outbox row are written in ONE `@Transactional` service method.
5. Mutations accept `Idempotency-Key` (scoped to caller + org + route) and use a JPA `@Version` column. Stale write -> 409 `STALE_VERSION`.
6. Foreign or unknown object IDs return 404 and reveal nothing.
7. Error shape: `{ code, message, request_id, field_errors }`. Codes: 400/422 validation, 401, 403, 404, 409, 429, 503.
8. Store instants in UTC. Date-only deadlines keep local date + IANA timezone. Never add 24h across DST.
9. Progress is NEVER set from Git activity, elapsed time, or counts of opened tasks.
10. Core calculations (progress, health, calendar) are pure Java classes in `com.<org>.delivery.domain` with JUnit 5 tests and no Spring dependencies.
11. No secrets, tokens, or private code in logs. Secrets live in env/vault, never in code.
12. Roles are templates only; role names alone grant nothing.
13. Consumers must be idempotent: dedupe by `event_id`. Scheduled pollers use PostgreSQL outbox state and ShedLock.

## Workflow for every task
1. Restate the requirements as a checklist. Ask about anything ambiguous.
2. Write failing tests first (include negative, race and replay cases).
3. Implement until tests pass. Small commits.
4. Reuse Spring `@Transactional` services, Spring Security method security, tenant-scoped repositories and existing helpers. Do not invent parallel ones.
5. End by listing what is NOT covered and any place a tenant/permission check may be missing.
6. Update `docs/progress.md`. If you learned a durable rule, propose a one-line addition here.

## Scope decisions
- All D01-D12 proposed defaults accepted.
- SHOULD items skipped: T08, T16, T26, T36, T45, T46.
- No AI, billing, or extra provider connectors in V1. GitHub only.

## Commands
- `docker compose up -d` -> PostgreSQL 16 only
- `./mvnw test`, `./mvnw spring-boot:run`, `./mvnw -Pworker ...`
- `cd apps/web && pnpm dev/build/test`
- CI: Java 21 + Maven build/test with PostgreSQL service, plus a separate web lint/typecheck/build job

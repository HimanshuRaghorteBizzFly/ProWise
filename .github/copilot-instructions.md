# Project Delivery Management SaaS

## Stack
- Web: Next.js App Router, React, TypeScript, Tailwind CSS in `frontend`.
- API: Java 21, Spring Boot 3, Spring Web/Security/Data JPA, Flyway, springdoc-openapi in `backend`.
- Database: PostgreSQL 16.
- Worker: PostgreSQL outbox plus Spring `@Scheduled` pollers with ShedLock under the `worker` profile.
- Tests: JUnit 5, Mockito, Testcontainers; Vitest and Playwright for web.

## Layout
- `frontend/`: Next.js application, public assets, scripts and frontend configuration.
- `backend/`: Spring Boot application, Maven wrapper and backend configuration.
- `database/`: migrations, initialization notes, seed notes and database scripts.
- `database/migrations/`: Flyway migrations copied into the backend classpath at `db/migration`.

## Non-negotiable rules
1. Every tenant-owned table has indexed `org_id`; every query filters by it.
2. Never trust `org_id` from a request body; derive it from authenticated active membership.
3. Permission = authenticated identity + active membership + scoped permission + allowed relationship to the object + allowed action in its current state.
4. Business change + audit row + outbox row are written in one `@Transactional` service method.
5. Retriable mutations require `Idempotency-Key`; conflicting edits require expectedVersion/JPA `@Version`; stale writes return 409 `STALE_VERSION`.
6. Foreign or unknown IDs return 404 without revealing existence.
7. Errors are `{ code, message, request_id, field_errors }`; use the documented 400/422, 401, 403, 404, 409, 429 and 503 statuses.
8. Store instants in UTC; date-only commitments retain local date and IANA zone.
9. Progress is never set from Git activity, elapsed time or opened-task counts.
10. Core progress, health and calendar functions are pure Java with unit tests and no Spring dependencies.
11. No secrets, tokens or private code in logs; secrets live outside source and logs.
12. Roles are templates only; role names alone grant nothing.
13. Consumers dedupe by `event_id`; scheduled work uses PostgreSQL outbox state and ShedLock.

## Workflow
1. Restate requirements and ask about ambiguity.
2. Write failing negative, race and replay tests first.
3. Implement in small, reviewable changes and preserve tenant/permission checks.
4. Use transactional services, method security, tenant-scoped repositories and existing helpers.
5. Run the smallest relevant test/build command.
6. Update `docs/progress.md` after each task and report uncovered cases or missing checks.

## Commands
- `docker compose up -d`
- `cd backend && ./mvnw test`
- `cd backend && ./mvnw spring-boot:run`
- `cd backend && ./mvnw -Pworker ...`
- `cd frontend && npm run dev`
- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm test`
- `cd frontend && node scripts/verify-all-scenarios.mjs`
- `docker compose -f docker-compose.prod.yml up --build`

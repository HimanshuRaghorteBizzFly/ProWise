# Phase 0: Foundations (8 pts)

Goal: one release boundary, agreed roles, tested core calculations, a repo that builds and tests anywhere.

---

## 0.1 Agree release scope and decision owners (2 pts)

**Prompt**
```
Do task 0.1 (docs only, no code). Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-0.md card 0.1, docs/decisions.md, and ONLY the FR, NFR, AS and decision tables
of docs/source/blueprint.md (sections 10, 11, 12, 8).

1. Create docs/traceability.md by PARSING the blueprint tables (do not retype from memory):
   FR-001..046 | test T## | MUST or SHOULD | module M## | build task | status.
   Then NFR-01..12 -> build tasks, and AS-01..08 -> build tasks.
2. Update docs/decisions.md D10 with the stack: Next.js + Spring Boot 3 (Java 21) + PostgreSQL; JPA + Flyway;
   local-account auth with JWT + rotating refresh (OIDC swap later); PostgreSQL outbox + @Scheduled + ShedLock,
   no Redis; MinIO (dev) / S3-compatible storage; Mailpit (dev) email; GitHub App behind an interface.
   Add "Decision owner and support owner: <my name>" and a dated change-log line.
3. Check: every MUST requirement has exactly one build task and one test; the six SHOULD items (T08, T16, T26,
   T36, T45, T46) are marked Deferred (D12). Print any gap instead of guessing.
```

**Expected outcome**
- `docs/traceability.md` with 46 FR rows (40 MUST, 6 SHOULD deferred), 12 NFR rows, 8 AS rows.
- `decisions.md` records the real stack and an owner.

**Verify yourself**
- Row counts are 46 / 12 / 8. Open three random rows and compare with the blueprint.
- No requirement shows "no task" or "no test".

---

## 0.2 Approve journeys and scoped roles (2 pts)

**Prompt**
```
Do task 0.2 (docs only, no code). Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-0.md card 0.2, docs/permissions.md, blueprint sections 3 and 4 (roles, screens),
docs/audit-report.md, and list the routes of the existing frontend.

Create:
1. docs/journeys.md: step-by-step journeys for organization setup, solo project, structured project, approval,
   reopening, and a member leaving. Each step names the screen, the actor and the permission key used.
2. docs/permission-matrix.md: role (Owner, Admin, PM, Team Lead, Developer, QA/Reviewer, Viewer, Platform Operator)
   x permission key (from docs/permissions.md). Mark allowed / not allowed / needs project scope. Add a "Cannot" column
   from the Boundary text. A viewer's read must NOT imply report.export.
3. docs/screen-map.md: every screen the blueprint requires (Overview, All Projects, Individual project tabs,
   Structured project tabs, My Work and Notifications, Timeline/Teams/People, Repositories and Reports,
   Settings and Activity) vs the existing frontend routes: KEEP / CHANGE / ADD / REMOVE, with the task that builds it.
   Include the empty and restricted-state messages from blueprint section 4.
Do not change any frontend code.
```

**Expected outcome**
- Three docs that become the contract for every screen and permission.
- A clear list of which existing pages stay, change, are added or removed.

**Verify yourself**
- A PM can only act on permitted projects in the matrix. Viewer has no export.
- Every page in your current UI appears in `screen-map.md`.

---

## 0.3 Fix the progress and calendar examples as executable fixtures (2 pts)

**Prompt**
```
Do task 0.3. Follow the workflow in CLAUDE.md. Pure Java only, no Spring imports in this package.
Read: docs/tasks/phase-0.md card 0.3, docs/domain-rules.md (progress, calendar, health sections).

Create in backend/src/main/java/com/prowise/domain/:
- progress/StructuredProgress: input = leaves (id, weight BigDecimal, accepted, cancelled, reopened) + active baseline;
  output = NOT_MEASURABLE or (numerator, denominator, exact BigDecimal value, display string).
  Rules: parent earns no credit; reopened/cancelled leaf earns 0 but cancelled stays in the denominator until
  authorized removal; reject mixed units, zero or negative weights; round ONLY for display; show 100% only when
  non-empty numerator == denominator (99.96 must display 99.9, not 100); zero denominator = NOT_MEASURABLE;
  non-empty with zero accepted = 0%.
- progress/IndividualProgress: current value = latest accepted check-in by revision sequence; none = NOT_REPORTED;
  optional verification keeps a pending value separate from the last accepted value; label always "developer_reported".
- progress/ModeTransition: Individual 60% -> Structured keeps 60% on its date; new series from accepted leaves;
  result carries a "break" marker and "of remaining scope".
- calendar/WorkingCalendar(ZoneId, workdays, holidays): isOverdue(localDate, instant) (overdue starts at first instant of
  the next local date), addWorkingDays, graceCutoff(cadence, dueDate, graceDays), roughPace(start, end, asOf)
  (clamped 0..100, days off excluded, "unavailable" when no comparable baseline). Derive boundaries from local dates,
  never "+24h".

Tests first (JUnit 5, tag each with the fixture number):
 1. leaves 20,30,50, first two accepted -> 50/100 = 50%   2. +25 point leaf approved -> 50/125 = 40%
 3. reopen the 30 leaf -> 20/125 = 16%   4. empty -> NOT_MEASURABLE   5. open work, none accepted -> 0%
 6. cancelled leaf stays in denominator   7. parent with accepted children adds no credit
 8. Individual 60% -> Structured with remaining-scope baseline
 9. DST: America/New_York target 2026-03-08, overdue begins at first instant of 2026-03-09 local; Asia/Kolkata too
10. Friday check-in + 1 working day grace with Monday holiday -> grace day is Tuesday
11. rough pace 70 vs comparable completion 55 -> gap 15
Add an ArchUnit test: nothing in com.prowise.domain imports org.springframework.
```

**Expected outcome**
- Tested, framework-free progress and calendar logic that the API, reports and health will all reuse.
- `cd backend && ./mvnw test -Dtest='com.prowise.domain.**'` is green with the 11 fixtures.

**Verify yourself**
- Change one expected value (for example 40% to 41%): the matching test must fail. Revert it.
- The ArchUnit rule fails if you add a Spring import to the package.

---

## 0.4 Establish build and test environments (2 pts)

**Prompt**
```
Finish task 0.4. Scaffolding only; do not build product features. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-0.md card 0.4 and the current state of frontend/ and backend/.

Make these true and show real command output for each:
1. Java 21 with the Maven wrapper: backend/mvnw, backend/mvnw.cmd, backend/.mvn committed. `cd backend && ./mvnw test` passes.
2. Flyway applies V1__bootstrap.sql on an empty PostgreSQL started by `docker compose up -d`.
3. GET /v1/health returns 200, header X-Request-Id and request_id in the body. A supplied X-Request-Id is echoed back.
   Every error body matches { code, message, request_id, field_errors } (via @RestControllerAdvice).
4. Logging redacts tokens, passwords, cookies and Authorization headers (Logback masking + a test).
5. Worker profile starts, connects to the DB, runs the OutboxPoller skeleton under ShedLock and shuts down cleanly.
6. Env: .env.example (dummy values only), env validation at startup with a clear message, separate dev/test/staging
   files, real .env files git-ignored.
7. Sandbox identities: a seed that creates Org A and Org B and 5 fake users each
   (owner@org-a.test ...). It refuses to run when the profile is production.
8. Synthetic fixtures under backend/src/test: signed GitHub pull_request and push payloads, a signer (HMAC-SHA256,
   X-Hub-Signature-256) with a TEST secret, a tampered payload, a duplicate-delivery sample, and an in-memory fake
   EmailSender. No network calls in tests.
9. Typed contract skeleton: error shape, cursor pagination, Idempotency-Key and expectedVersion names; springdoc
   exposes /v3/api-docs; a script generates frontend/src/lib/api types from it.
10. CI (.github/workflows/ci.yml): backend job (Java 21, Postgres service, migrate, test) and frontend job
    (install, lint, typecheck, build, test).
11. Frontend lint and build pass. Do not hide lint errors; fix them or, if the page is marked DELETE in
    docs/audit-report.md, list it for the cleanup task.
Leave the checkbox unticked; list anything not verified.
```

**Expected outcome**
- A fresh clone builds and tests on any machine; CI is green.
- Health endpoint with trace ID, migrations applied, fake GitHub and email fixtures ready.

**Verify yourself**
- Clone to a new folder, copy `.env.example`, run the commands in the README: everything works.
- `curl -i localhost:8080/v1/health` shows `X-Request-Id`; `git grep -iE "secret|password|token"` shows only dummy values.
- GitHub Actions run is green.

**Then:** add framework, ORM and support-owner lines to `decisions.md`, tick 0.1 to 0.4, tag `m0-foundations`.

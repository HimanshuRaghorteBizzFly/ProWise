# Prowise build playbook: start here

How to build the whole product (frontend, backend, database) from `Project_Delivery_Blueprint_V1.1`, one task at a time, keeping the UI you already have.

## 1. Where you are today
- Frontend-only prototype exists (mock data). Docs pack and `docs/audit-report.md` exist.
- Backend skeleton from task 0.4 exists but is NOT verified (Java 21 and green build missing).
- Repo is being split into `frontend/` and `backend/`.

**Do these first, in order:**
1. Finish the restructure into `frontend/` and `backend/`. Commit.
2. Install JDK 21. Finish and verify task 0.4 (`phase-0.md`).
3. Read `docs/audit-report.md`. Fix any DELETE row whose evidence is weak. Decide every UNSURE row yourself.
4. Run the cleanup (delete dead code, out-of-scope pages) on a branch, with tests green before and after.
5. Copy `CLAUDE.md` from this pack to the repo root. Then start 0.3.

## 2. Decisions to record now (D10 in `docs/decisions.md`)
| Area | Choice |
|---|---|
| Auth V1 | Spring Security, local accounts (BCrypt), short-lived JWT access token + rotating refresh token (stored hashed, reuse detection). OIDC provider can replace it later behind the same interface. |
| Async work | PostgreSQL outbox + `@Scheduled` pollers + ShedLock (JDBC). `worker` Spring profile. No Redis. |
| Object storage | MinIO in dev, S3-compatible in production. Fake scanner in dev, real scanner before launch. |
| Email | Mailpit in dev, SMTP/provider later. Always behind an `EmailSender` interface with a fake for tests. |
| GitHub | `GitHubClient` interface with a fake (dev/tests) and a real GitHub App implementation (task 4.1). |
| API contract | springdoc-openapi spec drives generated TypeScript types for the frontend. |
| Data fetching (web) | Use what the existing code does. If nothing yet, TanStack Query + the typed client. |

## 3. Roadmap
Sessions are rough planning estimates for a solo developer (one session = 2 to 4 hours), not promises.

| Milestone | Tasks | Points | Sessions | You can demo |
|---|---|---|---|---|
| **M0 Foundations** | 0.1 to 0.4 | 8 | 4 to 6 | Clean repo, green CI, health endpoint with request ID, tested progress and calendar logic |
| **M1 Workspace** | 1.1 to 1.4 | 14 | 10 to 14 | Sign up, create workspace, invite people, strict tenant isolation, audited and idempotent writes |
| **M2 Individual MVP** (tag `v0.1-individual`) | 2.1 to 2.4 | 14 | 8 to 12 | A solo project end to end: create, check in, deadlines, accept, close, archive |
| **M3 Structured** (tag `v0.2-structured`) | 3.1 to 3.6 | 21 | 14 to 20 | Breakdown, scope versions, reviews, dependencies, weighted progress, mode switch |
| **M4 GitHub** (tag `v0.3-github`) | 4.1 to 4.4 | 13 | 8 to 12 | Repos linked, signed webhooks, activity feed, comments and clean files |
| **M5 Monitoring** (tag `v0.4-monitoring`) | 5.1 to 5.6 | 19 | 14 to 20 | Health, reminders, portfolio, workload, reports and CSV, audit, privacy |
| **M6 Release** (tag `v1.0-rc`) | 6.1 to 6.4 | 11 | 6 to 10 | Full test evidence, security and accessibility, benchmarks, restore drill, pilot |

Each phase file in this folder has, for every task: **Prompt** (paste it), **Expected outcome** (what exists afterwards), **Verify yourself** (what you must check before ticking the box).

## 4. One-time setup
1. Put `CLAUDE.md` at the repo root (it holds the workflow every prompt relies on). Keep `.github/copilot-instructions.md` in sync if you still use Copilot.
2. Put this folder in `docs/playbook/`.
3. Branches: `main` (always green), one branch per task `task/1.1-orgs-auth`. Merge only after you verify. Tag milestones as in the table.
4. Commit per task, message `task 1.1: organizations, identity, sessions`.

## 5. The loop for every task
1. **Fresh session.** Start a new chat/session in the repo. Old context makes the AI forget rules.
2. **Paste the task prompt** from the phase file. It tells the AI what to read.
3. **Read the plan** it proposes. Fix mistakes now (cheap), then say "OK".
4. **Let it write tests first**, then code. Skim the tests; they are your contract.
5. **Run it yourself:** tests, then use the feature in the browser.
6. **Review prompt** (section 6) in a fresh session if the task touches permissions, transactions or money-like rules.
7. **Tick the box** in `docs/progress.md`, commit, merge.

## 6. Reusable prompts

**Review (fresh session, after a task)**
```
Review the diff of branch task/<X.Y> against main as a skeptical senior engineer. Do not edit code.
Check against CLAUDE.md rules 1 to 13 and the Pass-when lines of task <X.Y> in docs/tasks/phase-<N>.md.
Look hardest for: queries without org_id, org_id read from a request body, endpoints without a permission check,
writes without audit+outbox in the same transaction, missing expectedVersion/Idempotency-Key, 404 vs 403 mistakes,
race conditions, secrets in logs, tests that assert nothing. Output a table: severity | file:line | problem | fix.
```

**Fix a failing test or error**
```
This fails: <paste full output>. Explain the root cause in two lines, then fix it with the smallest change.
Do not weaken or delete tests. Re-run and show the output.
```

**Wire a screen to the real API (frontend)**
```
Screen: <route>. Replace its mock data with the real endpoint(s): <list from docs/api-contract.md>.
Use the typed client in frontend/src/lib/api only. Handle loading, empty, error (error shape with request_id),
401 (refresh then sign-in), 403 and 404 states, and 409 STALE_VERSION (offer reload). Send Idempotency-Key on
mutations. Keep the existing look. Remove the mock adapter for this screen. Add one component/integration test.
```

**Resume after a break or when context is long**
```
Summarize in 10 lines: current task, what is done, what is failing, next 3 steps, decisions made.
Write it to docs/progress.md evidence log. Then I will start a fresh session.
```

**Sync docs after a decision changed**
```
I changed decision <ID>: <what>. Update docs/decisions.md (with date, reason, affected FR/task IDs, test impact)
and only the docs that mention it. Do not change any other rule, test ID or point value.
```

## 7. Cross-cutting conventions
**Database.** One Flyway migration per task (`V12__task_2_1_projects.sql`). Never edit an applied one. Every tenant table: `org_id`, `version`, `created_at`, `updated_at`, index on `(org_id, ...)`. Composite foreign keys or checks so child rows cannot point to another tenant. History tables are append-only (no UPDATE/DELETE grants or trigger).

**Backend.** Controllers thin; services `@Transactional`; one `ChangeRecorder` (built in 1.4) writes audit + outbox. Every controller method has `@PreAuthorize` (an architecture test fails the build otherwise). DTOs are records with Bean Validation. Errors only through `@RestControllerAdvice`.

**Frontend.** App Router pages under `frontend/src/app`. API only through `src/lib/api`. Permission-aware UI hides actions the user lacks, but the server is the real check. Use specific empty-state messages from the blueprint (for example "No check-in yet", "No approved work to measure").

**Testing.** Unit (pure domain), integration (Testcontainers PostgreSQL), API contract (MockMvc/RestAssured), web component tests, a few Playwright flows (AS-01 to AS-08 are built up over the phases).

**Definition of done for a task:** Pass-when lines all have a test; tests green; lint and build green; you used it in the browser; self-review table empty or accepted; `progress.md` evidence line added; box ticked by you.

## 8. If something goes wrong
- A task feels too big: ask the AI to split it into 3 sub-steps and do them as separate commits. The task card stays the contract.
- The AI invents requirements: reply "Only what the task card and docs say. List extras under 'Needs my decision'."
- Tests are flaky on concurrency: that is usually a real bug. Do not add sleeps; fix locking/versioning.
- Context is lost between tasks: that is normal. The files are the memory: `progress.md`, evidence log, `audit-report.md`.

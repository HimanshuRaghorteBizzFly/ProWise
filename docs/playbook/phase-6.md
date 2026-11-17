# Phase 6: Validation and rollout (11 pts)

Goal: both modes pass pilot acceptance, security and accessibility checks; load, restore and rollback have evidence. Do this phase last. Targets below are proposals from the blueprint, not measured claims.

---

## 6.1 Run the full contract and workflow suite (3 pts)

**Prompt**
```
Do task 6.1. Follow the workflow in CLAUDE.md. Mostly tests and reporting; fix only real defects found.
Read: docs/tasks/phase-6.md card 6.1, docs/traceability.md.

1. Make sure EVERY test T01..T46 (except deferred T08, T16, T26, T36, T45, T46) and AS-01..AS-08 exists as a tagged test
   (@Tag("T17"), @Tag("AS-03")). List any that are missing and write them.
2. Add Playwright end-to-end tests in frontend/e2e for AS-01..AS-08 using the fake GitHub and Mailpit/fake email.
3. Add a script (backend: scripts/test-evidence) that runs everything and generates docs/test-evidence.md: ID | name | result | date | build.
   Deferred items show "Deferred (D12)".
4. Add cross-module negative fixtures: stale revisions, tenant boundary guessing, DST, notification dedupe, replayed webhooks, export access removal.
5. Log each failure against its task/requirement, fix, rerun the fixed revision. Do not weaken tests.
Report the final table and any scope amendment I must approve.
```

**Expected outcome**
- One reproducible evidence file that shows every mandatory requirement passing.

**Verify yourself**
- `docs/test-evidence.md` has no "Not Run" or "Failed" for MUST items.
- Skim three e2e tests: they drive the real UI, not mocks.

---

## 6.2 Verify access, accessibility and browsers (3 pts)

**Prompt**
```
Do task 6.2. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-6.md card 6.2, blueprint NFR-06, NFR-07, NFR-09 rows (search it).

1. Threat model in docs/security/threat-model.md (assets, trust boundaries, abuse cases: tenant guessing, role escalation, forged webhooks, malicious
   uploads, CSV injection, session theft). Map the chosen OWASP ASVS 5.0.0 controls to tests or config.
2. Automated: dependency scanning (OWASP dependency-check or equivalent, npm audit), security headers, TLS config notes, secret scanning in CI.
3. Accessibility target WCAG 2.2 AA on critical flows: add axe checks to Playwright for sign-in, create project, check-in, review, acceptance, reports;
   keyboard-only walkthrough, visible focus, screen-reader labels/status, contrast, non-colour cues, zoom 200%.
4. Browser/viewport matrix: Chrome, Edge, Firefox, Safari (WebKit) at desktop and 360 px width; core flows run per browser.
5. Output docs/security/findings.md: severity | route | role | description | status. Fix every critical/high finding; list the rest with owners.
```

**Expected outcome**
- Security and accessibility evidence attached to the release candidate; no open critical/high findings.

**Verify yourself**
- Navigate sign-in to check-in with the keyboard only.
- Try the 360 px width on the portfolio and project pages.

---

## 6.3 Benchmark, restore and rehearse rollback (3 pts)

**Prompt**
```
Do task 6.3. Follow the workflow in CLAUDE.md. Do not claim results that were not measured.
Read: docs/tasks/phase-6.md card 6.3, blueprint NFR-01..05, NFR-08, NFR-10..12 rows (search it).

1. Seed generator (profile `bench`): 100 organizations, 10,000 projects, 250,000 work items, realistic distribution. Agree concurrent reads/writes
   with me before running.
2. Load test (k6 or Gatling) for list/read endpoints; report p95 against the proposed target (below 500 ms, excluding external calls) and the slowest
   endpoints with query plans; add indexes through new Flyway migrations where needed.
3. Observability: trace one API action through outbox -> worker -> inbox/email; alerts for error rate, backlog age, failed sync, latency;
   name an owner for each in docs/runbook.md.
4. Restore drill: backup + point-in-time recovery on a copy; measure data loss (RPO target 1 hour) and time to restore (RTO target 4 hours);
   replay the deletion ledger. A daily backup alone cannot prove the 1 hour RPO; say so in the report.
5. Rollback rehearsal: apply the latest migrations to production-like data, deploy, roll the app back, document the DB rollback strategy
   (forward-fix migration vs restore).
Output docs/benchmarks.md with measured numbers, misses, and an owner for each miss.
```

**Expected outcome**
- Real measurements for latency, capacity, restore and rollback, with owners for every miss.

**Verify yourself**
- Re-run the load test yourself once and compare p95.
- Do the restore drill on a copy from the written runbook, without help.

---

## 6.4 Pilot both modes and decide rollout (2 pts)

**Prompt**
```
Do task 6.4. Follow the workflow in CLAUDE.md. Mostly operations and documents; code only for deployment readiness.
Read: docs/tasks/phase-6.md card 6.4, blueprint section 13 (release and rollback decision) (search it).

1. Deployment readiness: production Dockerfiles for frontend and backend (API and worker profile), a staging compose/deploy description,
   health checks, environment variable list, secret handling notes, migration step in the release process, GitHub App registration steps.
2. Pilot pack in docs/pilot/: scenario script for ONE solo project and ONE structured team, a feedback form, a timing sheet (solo setup under
   3 minutes; key facts within two interactions), a defect log.
3. docs/release-decision.md: the six gates (contract and logic, integration and failure, experience and security, operations, product acceptance,
   proceed/hold/rollback) with evidence links, residual items, deployment owner, support contact, rollback triggers, monitoring period.
   Decision field stays Pending until I fill it.
4. Final runbook docs/runbook.md: support, incident response, restore, rollback, who to call.
```

**Expected outcome**
- A staged release you can deploy, a pilot you can run, and a written decision record.

**Verify yourself**
- Run the pilot yourself with a teammate: a solo project accepted, a structured project accepted.
- Fill in the release decision form honestly: proceed, hold or rollback.

**MILESTONE:** tick 6.1 to 6.4, tag `v1.0-rc`. Overall: 100 / 100 points.

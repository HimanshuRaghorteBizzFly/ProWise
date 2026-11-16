# Phase 1: Workspace foundation (14 pts)

Goal: verified users can sign in and use only their own organizations. Every access path is permission-checked. Every write is versioned, audited and replay-safe.

Build order: **1.1, 1.3, 1.4, 1.2** (1.2 only needs 1.1; do it last so invites already use permissions and audit).

---

## 1.1 Organizations, identity and sessions (3 pts)

**Prompt**
```
Do task 1.1. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-1.md card 1.1, docs/api-contract.md (organizations), docs/decisions.md D10.
Tests to satisfy: T01, and the session-revocation rule. (MFA T08 is deferred.)

DATABASE (Flyway V<n>__task_1_1_identity.sql)
users(id, email unique lower-case, password_hash, status, version, timestamps),
organizations(id, name, slug unique, timezone IANA, work_calendar jsonb, state, version),
memberships(id, org_id, user_id, role_template, status ACTIVE|DISABLED, unique(org_id,user_id)),
sessions(id, user_id, refresh_token_hash, family_id, expires_at, revoked_at, created_at),
password_reset_tokens(hashed token, expires_at, used_at).

BACKEND (package com.prowise.identity and .org)
- POST /v1/auth/signup, /signin, /refresh, /signout, /password-reset/request, /password-reset/confirm.
  BCrypt hashes. Short-lived JWT access token; rotating refresh token stored hashed with reuse detection
  (a reused old refresh token revokes the whole family). Sign-out and revoke take effect on the next request.
  Rate-limit sign-in and reset (simple bucket in PostgreSQL or in-memory for now).
- GET /v1/me (user + active memberships).
- POST /v1/organizations: name, slug, timezone, calendar. Validate IANA zone with ZoneId. Create the organization
  AND the OWNER membership in ONE transaction. Duplicate slug = 409. Invalid timezone = 422.
- The email sender is the EmailSender interface (fake in tests, Mailpit in dev).

TESTS FIRST
org + owner membership created atomically; membership failure rolls back the organization; invalid timezone 422;
duplicate slug 409; revoked session gets 401 on the next request; refresh reuse revokes family; two organizations'
settings stay isolated (T01); no password or token appears in logs.

FRONTEND
Reuse existing auth/landing pages. Build or wire: sign-up, sign-in, forgot/reset password, create-workspace form
(name, slug, timezone picker, workdays/holidays), organization picker, sign-out. Auth state in memory with the
refresh token in an HttpOnly cookie; automatic refresh on 401; protected routes. Remove mock auth.
```

**Expected outcome**
- You can sign up, create a workspace, sign out and sign back in. Switching organizations shows isolated settings.
- Revoking a session blocks the very next request.

**Verify yourself**
- Sign up two users with two organizations; confirm neither can see the other's name or settings.
- Reuse an old refresh token (copy it before refresh): the whole session family dies.
- Break the membership insert on purpose (throw in the service): the organization row must not exist.

---

## 1.3 Permissions on every access path (4 pts)

**Prompt**
```
Do task 1.3. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-1.md card 1.3, docs/permissions.md (ALL), docs/permission-matrix.md.
Tests: T04, T05, T06, AS-07, self-elevation denied.

DATABASE
roles(id, org_id nullable for templates, name, template bool), role_permissions(role_id, permission_key),
grants(id, org_id, membership_id, role_id, scope ORG|PROJECT, scope_id, expires_at nullable, version).
Seed the 8 role templates from docs/permission-matrix.md.

BACKEND (package com.prowise.authz)
- PermissionService.can(userId, orgId, permissionKey, resource?) = authenticated + ACTIVE membership + scoped grant +
  resource belongs to this org/project + action allowed in the resource's current state.
- @PreAuthorize("@perm.can(...)") on every controller method. ArchUnit test: any controller method without it (and not
  on an explicit public whitelist) fails the build.
- Tenant filter: Hibernate @Filter (orgId) enabled per request from the membership; a base repository that refuses to
  run without it. Test that a query without the filter fails.
- 404 for foreign or unknown IDs with no metadata; 403 only for a visible object where permission is missing.
- Org switch: tokens/caches/search are bound to the selected organization; switching reauthorizes everything.
- Self-elevation attempt (user assigns themselves a higher role) = 403. Viewer read does not imply report.export.
- Write down the access-path inventory (REST, search, jobs, downloads, exports) in docs/access-paths.md and mark
  which are protected now and which are future tasks.

TESTS FIRST
Role on project A authorizes A and nothing on private project B; Org A credential with Org B project/file/notification/report
IDs returns 404 with no counts, links or metadata, and records a restricted security audit entry (AS-07); after org switch
old counts/links cannot reveal the other org; revocation applies to the next request including cached sessions.

FRONTEND
Add GET /v1/me/permissions and use it only to HIDE actions the user lacks (server stays the real check). Roles & access
settings page (list templates, assign role to member, scope ORG or PROJECT). Friendly 403 and 404 pages that reveal nothing.
```

**Expected outcome**
- One central authorization layer; a build that fails if a controller is unprotected.
- Cross-tenant guessing returns nothing, by test.

**Verify yourself**
- In the browser, log in as two users from two organizations; paste one's project URL into the other: you get a plain 404.
- Remove `@PreAuthorize` from one endpoint: the build fails.

---

## 1.4 Commit changes, history and events together (4 pts)

**Prompt**
```
Do task 1.4. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-1.md card 1.4, docs/api-contract.md (conventions, domain events).
Tests: T07 (audit part), race edits, crash-after-commit, replayed key.

DATABASE
audit_log(id, org_id, actor_id, action, target_type, target_id, reason, previous jsonb, new jsonb, occurred_at) append-only
(revoke UPDATE/DELETE or trigger that raises). outbox_event(event_id uuid unique, org_id, aggregate_type, aggregate_id,
aggregate_version, type, payload jsonb, status PENDING|DONE|FAILED, attempts, next_attempt_at). idempotency_key(org_id, caller_id,
route, key, request_hash, response_status, response_body, created_at, unique(...)). processed_event(consumer, event_id unique).

BACKEND (package com.prowise.common)
- BaseEntity with @Version. ChangeRecorder.record(change, auditEntry, event) used inside ONE @Transactional service method,
  so business change + audit + outbox commit together or not at all.
- IdempotencyFilter: same key + same body returns the earlier result; same key + different body = 409.
- expectedVersion on conflicting edits: stale = 409 STALE_VERSION via the error shape.
- Outbox poller (worker profile): SELECT ... FOR UPDATE SKIP LOCKED, ShedLock, bounded retry with backoff, FAILED queue with
  operator-visible status, consumers dedupe via processed_event so a retry causes one effect.
- Retrofit 1.1 and 1.3: organization creation, role changes and member disable now write audit + outbox through ChangeRecorder
  (T07: role change and member disable each produce a safe actor/time/target record; no secrets inside).
- Safe logging: request_id on every log line; no secrets.

TESTS FIRST
Two concurrent conflicting edits: one wins, the other 409; crash simulated after commit and before publish: after restart exactly
one event delivered and state intact; replayed Idempotency-Key creates no second record; audit rows cannot be updated or deleted.

FRONTEND
API client adds Idempotency-Key to every mutation and X-Request-Id; on 409 STALE_VERSION show a "someone changed this, reload"
dialog; show request_id in error toasts ("Reference: ...") for support.
```

**Expected outcome**
- A reusable safe-write pattern every later task copies.
- Audit and outbox exist and cannot be silently skipped.

**Verify yourself**
- Run the concurrency test 20 times; it must not flake.
- Try `UPDATE audit_log ...` in psql as the app user: it must fail.

---

## 1.2 Invitations, teams and ownership (3 pts)

**Prompt**
```
Do task 1.2. Follow the workflow in CLAUDE.md. Use ChangeRecorder (audit + outbox) and PermissionService.
Read: docs/tasks/phase-1.md card 1.2, docs/permissions.md (invites, revocation and handover).
Tests: T02, T03, two-simultaneous-accepts race, ownership transfer, emergency disable.

DATABASE
invites(id, org_id, email, role_id/scope, team_id nullable, token_hash, expires_at, accepted_at, revoked_at, superseded_at, version),
teams(id, org_id, name, lead_membership_id), team_members(team_id, membership_id).

BACKEND
- POST /v1/organizations/{org}/invites (member.invite): single-use token stored hashed, expiry, target org + email.
  Resend rotates the token (old one dies). Revoke is immediate. List never returns tokens.
- POST /v1/invites/accept: valid once; revoked/expired/superseded grants nothing; replay creates no second membership.
  Two simultaneous accepts produce exactly one membership (unique constraint + retry-safe).
- Teams CRUD with lead; reject member or lead IDs from another organization (T03).
- Member disable (immediate, includes sessions) and normal departure with handover placeholder (owned work transfer is
  completed in 2.1/3.1; here store the flag and ownership history). Exactly one owner; the last owner cannot self-demote;
  ownership transfer only to an eligible active member after confirmation.

FRONTEND
Members page (list, invite dialog, resend/revoke, disable), accept-invite page, Teams page (create, lead, members),
transfer-ownership confirmation. Reuse existing people/team pages if present.
```

**Expected outcome**
- You can invite a colleague (email visible in Mailpit), they accept once, and join the right team and role.
- Departure and ownership changes are controlled and audited.

**Verify yourself**
- Click the invite link twice: second use fails. Resend: the old link stops working.
- Try to demote the last owner: refused.

**Then:** tick 1.1 to 1.4, tag `m1-workspace`.

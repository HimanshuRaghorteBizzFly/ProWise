# Phase 1: Workspace foundation (14 pts)
Exit check: verified users can switch only between their own orgs. Scope checks, write conflicts and audit/outbox pass negative and replay tests.

## 1.1 Create organizations, identity and sessions (3 pts)
Requires: 0.2, 0.4. Enables: 1.2, 1.3. Trace: FR-001, FR-008, NFR-06, NFR-12.
**Build:** Sign-in/recovery, workspace creation, owner assignment, IANA timezone, work calendar, session revoke. Apply agreed MFA/device policy (MFA itself is a deferred SHOULD, T08).
**Pass when:**
- T01: create workspace with owner, IANA timezone, work calendar. Switch tenant and confirm settings stay isolated.
- Privileged action requires agreed assurance. A revoked session cannot issue a new authorized request.
- Invalid timezone rejected. Org + owner membership created in one transaction.

## 1.2 Manage invitations, teams and ownership (3 pts)
Requires: 1.1. Enables: 1.3, 5.4. Trace: FR-002, FR-003, D09.
**Build:** Expiring single-use invite, resend/revoke, membership and team lead changes. Planned handover and immediate access revocation on departure.
**Pass when:**
- T02: accept a valid invite once. Revoked, expired or superseded link grants no access. Replay creates no second membership.
- T03: create a team and lead. Reject member or lead IDs from a different org.
- Race two invite accepts: exactly one membership.
- Transfer owner normally. Test emergency disable with no replacement ready.

## 1.3 Enforce permissions on every access path (4 pts)
Requires: 1.1, 1.2. Enables: 1.4, 2.1, 3.3, 4.1, 4.4, 5.3, 5.5, 5.6. Trace: FR-004..006, NFR-06.
**Build:** Tenant, membership, project scope, action and object checks in services and queries. Custom permission templates, least privilege, isolated tenant switching.
**Pass when:**
- T04: role on project A authorizes its actions on A and none on private project B.
- T05: guess a foreign task, file and export ID. All reads and writes fail without disclosing existence.
- T06: multi-org member switches workspace. Cached search, inbox counts, repo details, links reauthorize under selected membership.
- AS-07: Org A credential with Org B project/notification/file/report IDs leaks no values, counts, links or metadata; denied attempt recorded.
- Self-elevation attempt denied.

## 1.4 Commit changes, history and events together (4 pts)
Requires: 0.4, 1.3. Enables: 2.1, 2.3, 3.2, 3.4, 4.1, 4.2, 4.4, 5.2, 5.6. Trace: FR-007, FR-044, NFR-04, NFR-08, NFR-11.
**Build:** Flyway migrations, JPA `@Version` columns, idempotency keys, audit records and a transactional PostgreSQL outbox. Scheduled poller delivery with ShedLock, dedupe and safe logging.
**Pass when:**
- Race two conflicting edits: one wins, other gets 409.
- Crash after commit and before publish: business state and exactly one audit/event effect survive restart.
- Replayed Idempotency-Key creates no second record.
- T07 (audit part): change a role, disable a member -> safe actor/time/target record exists for each.

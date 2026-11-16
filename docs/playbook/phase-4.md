# Phase 4: Repositories and evidence (13 pts)

Goal: authorized GitHub activity and clean attachments are visible only within scope. Duplicate or missed events are recoverable and can never finish work.

Build order: **4.1, 4.2, 4.3, 4.4.** (4.4 only needs 1.3, 1.4 and 3.1, so you can do it earlier if you want a break from GitHub.)

Everything uses the `GitHubClient` interface with a **fake** for dev and tests. Registering a real GitHub App is a manual step you do once before 6.4 (steps are in 4.1).

---

## 4.1 Connect selected GitHub repositories (3 pts)

**Prompt**
```
Do task 4.1. Follow the workflow in CLAUDE.md. Never call the real GitHub in tests.
Read: docs/tasks/phase-4.md card 4.1, docs/api-contract.md (GitHub ingestion rules, install endpoint).
Tests: T07 (repo removal audit), T31, foreign installation id blocked, revocation stops new sync while manual work continues.

DATABASE
github_installations(id, org_id, provider_account, installation_id unique, permissions jsonb, revoked_at, sync_cursor, last_sync_at, version),
install_states(nonce, org_id, initiator_id, expires_at, used_at), repos(id, org_id, installation_id, provider_repo_id immutable, full_name, selected bool),
project_repos(project_id, repo_id) many-to-many within the same org.

BACKEND (package com.prowise.integration.github)
- GitHubClient interface: getInstallation, listRepos, getCommitsSince, redeliver... with FakeGitHubClient (fixtures from 0.4) and
  RealGitHubClient (GitHub App JWT, installation tokens). Config switches by profile.
- POST /v1/organizations/{org}/github/install (repo.connect): bind org + initiating admin + nonce; on callback verify the installation really exists
  and which repos it grants BEFORE linking. A foreign installation id or an unselected repo cannot be linked.
- Org admin selects repos; link repos to projects (many-to-many). Disconnect writes audit + outbox (T07).
- On observed revocation: set revoked_at, stop new sync, show status; manual project work keeps working.
- Secrets (app private key, webhook secret) from env/vault only.

FRONTEND
Repositories settings: connect GitHub, select repos, link/unlink to projects, sync status (last success, failure reason), revoke state.
Project Repositories tab.
```

**Expected outcome**
- Authorized repos can be connected and linked, in dev through the fake.

**Verify yourself**
- Callback with a wrong nonce or another org's installation id: refused.
- Unselected repo cannot be linked.

**Manual step later (before 6.4):** in GitHub, create a GitHub App with minimal read permissions (Metadata, Contents/Pull requests/Checks/Actions read as needed), subscribe to push, pull_request, pull_request_review, check_run, workflow_run (and deployment if used), set a webhook secret, store the key and secret in your environment manager. Never commit them.

---

## 4.2 Receive, replay and reconcile GitHub events (4 pts)

**Prompt**
```
Do task 4.2. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-4.md card 4.2, docs/api-contract.md (webhook row + ingestion rules), the GitHub fixtures from task 0.4.
Tests: T32, AS-06, forged, repeated, out-of-order, missed, revoked; worker crash retries independently of GitHub redelivery.

DATABASE
webhook_receipts(id, provider, delivery_id, installation_id, event, action, payload_ref, received_at, state RECEIVED|PROCESSED|FAILED|QUARANTINED,
attempts, last_error, unique(provider, delivery_id)), git_events(...) comes in 4.3; sync_state per installation.

BACKEND
- POST /v1/integrations/github/webhook: read the RAW request bytes, verify X-Hub-Signature-256 (HMAC-SHA256, constant-time compare with
  MessageDigest.isEqual), validate event/action, installation, repo entitlement and size. Persist receipt + outbox row, then return 2xx
  (target under 10 s). If storage fails return an error, never acknowledge undurable data.
- Dedupe X-GitHub-Delivery: same id and same content = success with no second effect; same id with conflicting content = QUARANTINED.
- Worker processes receipts with bounded retry/backoff, then a failed queue visible to operators. Older events never overwrite newer confirmed state
  (keep event time, received time, upstream id, state version).
- GitHub does NOT redeliver automatically: add periodic reconciliation (compare with accessible upstream records/cursor), an authorized redelivery
  action, and "history gap" markers. Show last successful sync and failure reason.

FRONTEND
Integration health panel: last delivery, last successful sync, failed deliveries list with retry/redeliver action (permission-gated), gap markers.
```

**Expected outcome**
- Webhooks are verified, durable, replay-safe and recoverable.

**Verify yourself**
- Send the same signed fixture twice (curl or the test): one effect. Tamper one byte: 401/400 and no record effect.
- Stop the worker mid-processing and restart: still exactly one effect.

---

## 4.3 Attribute activity without claiming completion (3 pts)

**Prompt**
```
Do task 4.3. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-4.md card 4.3, docs/api-contract.md (shared repo event fixture).
Tests: T33, T34, T35, AS-01 (repo events with their own timestamps), ambiguous shared-repo event stays unlinked.

DATABASE
git_events(id, org_id, repo_id, kind PUSH|PR|REVIEW|CHECK|WORKFLOW|DEPLOYMENT, upstream_id, upstream_version, actor_provider_login, member_id nullable,
work_item_id nullable, project_id nullable, occurred_at, received_at, summary, url), github_identities(org_id, membership_id, provider_login unique per org),
unassigned_events queue (view).

BACKEND
- Normalize push, pull request, review, check/workflow, optional deployment events. Never store source code or secrets.
- Identity: ONLY explicit member mapping (never match on login or email alone). Admin UI endpoint to map identities.
- Task key parsing, e.g. CRM-101: link only when exactly one eligible task in an authorized, linked project matches.
  Ambiguous shared-repo events stay unassigned until an authorized user confirms the link.
- Activity feed endpoint (permission-filtered) and separate values: last code update, last task update, last deployment, last sync.
- Rule 9: merged PR or green CI NEVER changes task state or progress (T35 test: item stays In Review).

FRONTEND
Activity tab (feed with source and time, filters), identity mapping settings, "Unassigned activity" list with confirm-link action,
the four separate "last ..." values on the overview. Loss of sync is visible.
```

**Expected outcome**
- Engineering activity appears next to work, clearly separate from delivery progress.

**Verify yourself**
- Merge a PR (fixture) on an item still in review: state and percentage do not change.
- A key that matches two projects' tasks stays unlinked.

---

## 4.4 Keep discussion and files with the work (3 pts)

**Prompt**
```
Do task 4.4. Follow the workflow in CLAUDE.md.
Read: docs/tasks/phase-4.md card 4.4, docs/domain-rules.md (Files, comments).
Tests: T23, clean/rejected/pending/foreign files, access revoked, mention never grants membership, scan error leaves the file unavailable.

INFRA
Add MinIO to docker-compose (dev). FileStorage interface (S3-compatible client). Scanner interface: FakeScanner (dev/tests) and a pluggable real
scanner later. Approved file types and size limit in config (record in decisions.md; no retention duration is supplied, mark TBD).

DATABASE
comments(id, org_id, project_id, work_item_id nullable, author_id, body, mentions jsonb, created_at, edited_at), attachments(id, org_id,
entity_type, entity_id, object_key, byte_size, detected_type, scan_state PENDING|CLEAN|REJECTED|ERROR, uploaded_by, created_at, expires_at).

BACKEND
- POST comments and attachments with PARENT permission checks. Encode/sanitize user content for display; limit mentions to project-allowed
  recipients. A mention never grants access to the parent or a file.
- Upload flow: request upload intent (permitted entity, type/size check) -> short-lived signed upload -> verify real bytes/type -> quarantine ->
  scan -> CLEAN/REJECTED. Scan error fails closed.
- Only CLEAN files get a short-lived private download URL after an access check at issue time. After access revocation no new link is issued.
- Reauthorize every comment read.

FRONTEND
Comment thread with @mentions (only permitted colleagues suggested), evidence/attachment uploader with scan-status chips, download via the API.
Pending and rejected files are not downloadable and show why.
```

**Expected outcome**
- Reviewers have discussion and evidence attached to the work, visible only to permitted people.

**Verify yourself**
- Upload an EICAR-style rejected sample with the fake scanner configured to reject: it is unavailable.
- Remove a user's access, then use an old download link: denied.

**MILESTONE:** tick 4.1 to 4.4, tag `v0.3-github`.

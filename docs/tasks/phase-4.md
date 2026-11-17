# Phase 4: Repositories and evidence (13 pts)
Exit check: authorized GitHub activity and clean attachments visible only in scope. Duplicate or missed events recoverable and can never finish work.
Rules for GitHub ingestion are in `docs/api-contract.md` (last section).

## 4.1 Connect selected GitHub repositories (3 pts)
Requires: 1.3, 1.4, 2.1. Enables: 4.2. Trace: FR-007, FR-031, D08.
**Build:** GitHub App installation, tenant-bound callback, repo selection. Multiple repos per project, shared repos, permission changes, explicit disconnection.
**Pass when:**
- T07 (repo part): removing a repository writes a safe actor/time/target audit record.
- T31: bind installation to workspace + selected repos; an unselected repo cannot leak events or be linked.
- Block foreign installation IDs. Stop new sync immediately after observed revocation. Manual project work still works.

## 4.2 Receive, replay and reconcile GitHub events (4 pts)
Requires: 1.4, 4.1. Enables: 4.3. Trace: FR-032, NFR-04.
**Build:** Validate signature on raw bytes, persist unique delivery receipt BEFORE acknowledging, process through the Spring worker profile. Bounded retries in PostgreSQL outbox state, last successful sync and authorized recovery.
**Pass when:**
- T32: tampered signature fails; repeated valid deliveries cause one effect; a failed or missed event is retried or reconciled.
- AS-06: replay an authentic PR delivery and interrupt the scheduled poller after persisting -> event and downstream effect applied once; sync state updated after successful processing.
- Test forged, repeated, out-of-order, missed, revoked cases. Worker crash retries independently of GitHub redelivery.

## 4.3 Attribute activity without claiming completion (3 pts)
Requires: 3.1, 3.3, 4.2. Enables: 5.3, 6.1. Trace: FR-033..036, M08.
**Build:** Normalize commits, PRs, reviews, checks/workflows, permitted deployments. Explicit GitHub identity mapping; auto-link only a unique authorized task key.
**Pass when:**
- T33: show permitted push/PR/review/check activity with source and timestamps. Loss of sync is visible.
- T34: associate `CRM-101` only within an eligible linked project. Ambiguous shared-repo event stays unlinked until authorized confirmation.
- T35: merge a PR and pass CI for an item still in review -> work state and delivery % do not advance.
- Separate last code / task / deployment / sync values.

## 4.4 Keep discussion and files with the work (3 pts)
Requires: 1.3, 1.4, 3.1. Enables: 5.6, 6.1. Trace: FR-023, NFR-06, NFR-10.
**Build:** Project/task comments, scoped mentions, evidence links, private object storage, scan status, authorized signed downloads. Approved file and retention policy.
**Pass when:**
- T23: add comment, mention permitted colleague, attach clean file. Pending, rejected, foreign files unavailable.
- Upload clean and rejected samples, revoke access, try a foreign file. A mention never grants membership. Scan error leaves file unavailable.

# Phase 6: Validation and rollout (11 pts)
Exit check: both modes pass pilot acceptance, security and accessibility checks; load, restore and rollback have evidence.
Do this phase LAST. Targets below are proposals, not measured claims.

## 6.1 Run the full contract and workflow suite (3 pts)
Requires: 3.6, 4.3, 4.4, 5.2, 5.3, 5.4, 5.5, 5.6. Enables: 6.2, 6.3, 6.4. Trace: FR-001..046, AS-01..08.
**Build:** Run T01-T46 with recorded dispositions for SHOULD items (T08, T16, T26, T36, T45, T46 = deferred per D12), AS-01..08, cross-module negative fixtures. Link each failure to its task/requirement; rerun the fixed revision.
**Pass when:** All mandatory tests pass or have a formally approved scope amendment. Verify API contracts, arithmetic, stale revisions, tenant boundaries, DST, notification dedupe.

## 6.2 Verify access, accessibility and browsers (3 pts)
Requires: 5.3, 5.5, 5.6, 6.1. Enables: 6.4. Trace: NFR-06, NFR-07, NFR-09.
**Build:** Threat model + selected OWASP ASVS 5.0.0 controls; keyboard/screen-reader flows, focus, zoom, date labels; supported browsers (Chrome, Edge, Firefox, Safari) at desktop and 360 px.
**Pass when:** All critical/high security findings fixed. Tenant isolation, upload/export controls, accessible review transitions and mobile-width navigation verified. Target WCAG 2.2 AA on critical flows.

## 6.3 Benchmark, restore and rehearse rollback (3 pts)
Requires: 5.6, 6.1. Enables: 6.4. Trace: NFR-01..05, NFR-08, NFR-10..12.
**Build:** Load production-like data, measure read latency, validate alert routes, timed backup/PITR restore with deletion replay. Rehearse migration + app rollback.
**Pass when:** p95, RPO, RTO compared to agreed targets; misses recorded with owner resolution.
Proposed targets: availability 99.5%/month; read p95 < 500 ms; seed 100 orgs / 10,000 projects / 250,000 work items; RPO <= 1 h; RTO <= 4 h. Daily backup alone cannot prove the 1-hour RPO.

## 6.4 Pilot both modes and decide rollout (2 pts)
Requires: 6.1, 6.2, 6.3. Enables: release handover. Trace: D11, D12, AS-01..08.
**Build:** Pilot representative workflows (one solo project + one structured team). Record outcomes and residual issues, staged rollout, health check, hand over support + rollback ownership.
**Pass when:** Solo setup < 3 minutes. Risk discovery within two interactions. Successful delivery review in both modes. All must-haves accepted. Supported runbook named.
Release gate: all applicable MUST tests accepted; no open high/critical security findings; name deployment owner, support contact, rollback triggers, monitoring period. Record proceed / hold / rollback.

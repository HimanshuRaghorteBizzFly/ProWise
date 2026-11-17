# Decision register (Task 0.1)

Solo build: all proposed defaults are ACCEPTED. Change only through a new entry at the bottom.

| ID | Topic | Decision (accepted default) |
|---|---|---|
| D01 | Lifecycle | `On Hold` replaces Paused. `Delivered` = acceptance decision. `Closed` = later administrative action. `Archived` = separate read-only flag with restore. Canonical lifecycle category behind any display label. |
| D02 | Individual check-in authority | Accountable developer reports. Latest submitted entry is current. Optional manager verification may hold a new figure pending. Corrections append a linked entry (`revision_of`). |
| D03 | Weight units | One unit per approved baseline: effort, explicit points, or equal weight 1. Split/cancel/add/resize only via a recorded scope change. |
| D04 | Review and closure authority | Review configured by work type. Submitter and reviewer are separate people where review is required. Record who may waive blockers, accept, close. |
| D05 | Cadence and calendar | Weekly default, 1 working day grace. Daily or fortnightly per project. Reminder offsets 3 and 1 working days. |
| D06 | Health rules | Rule order as in `domain-rules.md`. Pace gap threshold 15 points. Critical blocker older than 2 working days = At Risk. |
| D07 | Mode conversion | Individual offered when one developer owns delivery. Preserve both series. Remaining work starts a new denominator. Reverse needs a new manual entry. |
| D08 | GitHub | GitHub first. Org admin selects repos. Explicit contributor identity. Auto-link only a unique task key. |
| D09 | People, dates, reports | Weekly planned hours vs available hours. Missing hours stay unknown. No points-to-hours conversion. |
| D10 | Identity, hosting, retention | Managed OIDC provider chosen after a spike. Backend: Spring Boot (Java 21); ORM: Spring Data JPA + Flyway; no Redis/BullMQ (PostgreSQL outbox + scheduled pollers). Retention durations TBD before commercial use. |
| D11 | Product and pilot | Working name kept. Pricing deferred. Pilot = one solo project + one structured team. |
| D12 | SHOULD items | DEFER: T08 MFA/devices, T16 templates, T26 board/timeline views, T36 deployment details, T45 escalation/digests, T46 health override. |

## Change log
2026-11-05 | D10 | Stack changed to Next.js + Spring Boot + PostgreSQL; managed OIDC provider remains deferred pending a spike and retention durations remain TBD before commercial use, as approved | All implementation tasks | Update API, migration, worker-profile and test tooling references

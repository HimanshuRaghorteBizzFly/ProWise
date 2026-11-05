# Phase 0: Policy and design (8 pts)
Exit check: agreed journeys, scope, roles, progress examples and a versioned contract. Open decisions have owners.

## 0.1 Agree release scope and decision owners (2 pts)
Requires: none. Enables: 0.2, 0.3, 0.4.
**Build:** Map the requirements to modules M01-M12, FR-001..046, NFR-01..12, AS-01..08. Assign D01-D12 and record which recommended (SHOULD) items enter V1.
**Pass when:** Implementation-blocking policy choices are resolved or have a bounded interim option + owner. Every mandatory requirement has a test and a delivery ticket.
**Solo shortcut:** `docs/decisions.md` already holds the accepted defaults. Create one GitHub Issue per task in docs/progress.md.

## 0.2 Approve journeys and scoped roles (2 pts)
Requires: 0.1. Enables: 0.3, 1.1, 2.1.
**Build:** Walk through org setup, both modes, approval, reopening, departure. Draw permitted routes for Owner, Admin, PM, Lead, Developer, Reviewer, Viewer, temporary support.
**Pass when:** A PM can act only on permitted projects. A viewer's read does not imply export. Solo and team journeys are signed off.
**Output:** a permission and screen map with error and empty states (use `docs/permissions.md` + a screen list).

## 0.3 Fix the progress and calendar examples (2 pts)
Requires: 0.1, 0.2. Enables: 2.2, 2.3, 3.1.
**Build:** Define state/status vocabulary, eligible leaves, scope versions, approval settings, waiver role, calendar, check-in grace and health rules. Save worked examples as EXECUTABLE FIXTURES.
**Pass when:** Validated: empty denominator, 50/100 -> 50/125, reopened work, a DST boundary, and a 60% method transition.
**Do:** implement pure Java progress + calendar classes in `com.<org>.delivery.domain` test-first with JUnit 5 (see fixtures in `docs/domain-rules.md`).
Trace: D01-D07, AS-02..05, AS-08.

## 0.4 Establish build and test environments (2 pts)
Requires: 0.1. Enables: 1.1, 1.4.
**Build:** Versioned env config, typed contract skeleton, migrations, CI, sandbox identities, synthetic GitHub/email fixtures. Confirm framework, ORM, support owners.
**Pass when:** Fresh setup applies Flyway migrations, builds the web/API, starts the worker profile, and runs a sample request that returns a request ID. Credentials stored outside code and logs.
Trace: D08, D10, NFR-08, NFR-11.

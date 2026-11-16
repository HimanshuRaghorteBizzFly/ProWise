# Roles and permissions

**Rule:** permission = authenticated identity + active membership + scoped permission + allowed relationship to this object + action allowed in current state. Check server-side on every path. Role names are templates; they grant nothing by themselves.

## Roles
| Role | Does | Boundary |
|---|---|---|
| Organization Owner | Creates workspace, names admins, org policy, approves integrations | Transfer ownership only to eligible active member after confirmation; always keep exactly one owner. Last owner cannot self-demote. |
| Organization Admin | Invite/disable members, teams, permitted roles, workspace integrations | Cannot transfer ownership or grant powers beyond own authority |
| Project Manager | Create projects in scope, appoint accountable owner, plan dates, approve scope/mode changes | Needs the specific project permission to waive, accept or close |
| Team Lead | Manage assigned team work, dependencies, reviews, allocation | Cannot browse other teams/orgs just because they are a lead |
| Developer | Edit assigned work, flag blockers, link evidence, submit check-ins if accountable on Individual project | Cannot approve own work; cannot change approved scope by editing a task |
| QA / Reviewer | Inspect assigned submissions, approve exact revision or request changes with reason | Role on project A grants nothing on project B |
| Viewer / Stakeholder | Read permitted summaries, timelines, reports | No edits. Export needs separate `report.export` |
| Platform Operator | Monitor queues, backups, incidents | Tenant access needs time limit, reason, restricted scope, audit record |

## Permission keys
- Org/people: `org.manage`, `member.invite`, `member.disable`, `role.manage`, `team.manage` (owner transfer separately restricted)
- Project/scope: `project.create`, `project.read`, `project.edit`, `project.archive`, `project.mode.change`, `project.scope.change`, `project.deadline.edit`
- Work/progress: `project.progress.report` (accountable developer, Individual mode only), `project.progress.override` (separate correction/decision entry), `task.create`, `task.assign`, `task.update`, `task.review`
- Private resources: `repo.connect`, `repo.read`, `report.export`, `audit.read`, plus separate closure and waiver rights

Grants have scope ORG or PROJECT (+ scopeId). A grant on project A authorizes nothing on private project B.

## Enforcement rules
- Check membership and project binding; NEVER trust `org_id` in the body.
- Re-check privilege at job execution, link issuance and download time (not just at request time).
- Org switch: cached search, inbox counts, repo details, tokens and links must reauthorize under the selected membership.
- Search, exports, files, notifications and jobs use the same permission-aware query definitions as the screens.
- Unknown/foreign IDs -> 404 with no metadata. Missing permission on a visible object -> 403.
- Revoked access: old links, copied URLs and cached sessions must not reopen the project. No details of an inaccessible project in the error.

## Revocation and handover
- Normal departure: transfer owned projects/work to eligible replacements atomically where possible. Keep ownership history. Unresolved assignment flagged `Owner unavailable` for the PM; block new owner-only actions until replaced.
- Emergency disable / role revocation: immediate, including cached sessions and background work.
- Invites: single-use protected token (store hashed), expiry, target org + email. Resend rotates (old token dies). Revoke is immediate. Two simultaneous accepts -> one membership.

## Operator support access
Time-limited elevation needs purpose, actor, tenant, expiry. Keep private code, tokens, file contents and unrelated tenant data out of routine logs. Revoke at expiry.

## Race tests to keep
1. Remove a reviewer between opening and submitting a review -> write denied.
2. Remove `report.export` between requesting and downloading CSV -> download denied.
3. Org A credential with Org B project/notification/file/report IDs -> no values, counts, links or identifying metadata; denied attempt recorded in restricted security evidence.

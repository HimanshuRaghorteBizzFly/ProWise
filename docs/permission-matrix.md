# Permission matrix

Role names are templates only. Every decision is additionally checked against the
authenticated identity, active membership, scope, object relationship, and current
resource state.

| Role | org.manage | member.invite | member.disable | role.manage | team.manage | project.create | project.read | project.edit | project.archive | project.mode.change | project.scope.change | project.deadline.edit | project.progress.report | project.progress.verify | project.progress.override | task.create | task.assign | task.update | task.review | repo.connect | repo.read | report.export | audit.read |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Organization Owner | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Organization Admin | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | ALLOW | ALLOW | ALLOW |
| Project Manager | DENY | DENY | DENY | DENY | DENY | ALLOW | ALLOW | ALLOW | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | ALLOW | ALLOW | DENY |
| Team Lead | DENY | DENY | DENY | DENY | CONDITIONAL (assigned team/projects) | DENY | CONDITIONAL (assigned projects) | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (lead of the project's team, never own entries) | DENY | CONDITIONAL (assigned team/projects) | CONDITIONAL (assigned team/projects) | CONDITIONAL (assigned team/projects) | DENY | DENY | CONDITIONAL (assigned team/projects) | DENY | DENY |
| Developer | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned work) | CONDITIONAL (assigned work) | DENY | DENY | DENY | DENY | CONDITIONAL (accountable Individual project) | DENY | DENY | DENY | DENY | CONDITIONAL (assigned work) | DENY | DENY | CONDITIONAL (assigned work) | DENY | DENY |
| QA / Reviewer | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned submissions) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned submissions) | DENY | DENY | DENY | DENY |
| Viewer / Stakeholder | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (permitted summaries) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| Platform Operator | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| Project Approver (project-scoped) | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (only the project it was granted on) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (only the project it was granted on, never own work) | DENY | DENY | DENY | DENY |

`project.progress.verify` (task 2.2, owner decision) lets the lead of a project's team approve or reject
Individual check-ins; it never applies to their own entries and grants nothing on other teams' projects.
`project.progress.override` is denied to every role. Waive, accept, and close
permissions are deferred because their keys are not defined in the source
permissions document. Platform support access is handled by the time-limited
support grant in task 5.6, not by tenant permissions in this matrix.

**Project Approver (owner decision 2026-11-25).** Approvers are chosen per project when it is created (or later
with `project.edit`): Team Lead, Project Manager, QA or any other member, but never an Organization Owner or
Organization Admin. The choice is stored as a PROJECT-scoped grant of the narrow `PROJECT_APPROVER` template
(`project.read` + `task.review`) on that project only; the database refuses an ORG-scope grant of it, and it is
never listed or assignable in role management. Approving a Team task or a Solo submission requires that project
grant: an organization-wide `task.review` (for example the QA / Reviewer template) does not make anyone an approver
of a project they were not chosen for. Nobody approves their own work (assignee or submitter), and the approver must
be an active member of the organization. The existing role templates were not widened.

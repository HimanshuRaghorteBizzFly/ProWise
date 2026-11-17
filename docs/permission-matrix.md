# Permission matrix

Role names are templates only. Every decision is additionally checked against the
authenticated identity, active membership, scope, object relationship, and current
resource state.

| Role | org.manage | member.invite | member.disable | role.manage | team.manage | project.create | project.read | project.edit | project.archive | project.mode.change | project.scope.change | project.deadline.edit | project.progress.report | project.progress.override | task.create | task.assign | task.update | task.review | repo.connect | repo.read | report.export | audit.read |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Organization Owner | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Organization Admin | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | ALLOW | ALLOW | ALLOW |
| Project Manager | DENY | DENY | DENY | DENY | DENY | ALLOW | ALLOW | ALLOW | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | ALLOW | ALLOW | DENY |
| Team Lead | DENY | DENY | DENY | DENY | CONDITIONAL (assigned team/projects) | DENY | CONDITIONAL (assigned projects) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned team/projects) | CONDITIONAL (assigned team/projects) | CONDITIONAL (assigned team/projects) | DENY | DENY | CONDITIONAL (assigned team/projects) | DENY | DENY |
| Developer | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned work) | CONDITIONAL (assigned work) | DENY | DENY | DENY | DENY | CONDITIONAL (accountable Individual project) | DENY | DENY | DENY | CONDITIONAL (assigned work) | DENY | DENY | CONDITIONAL (assigned work) | DENY | DENY |
| QA / Reviewer | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned submissions) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (assigned submissions) | DENY | DENY | DENY | DENY |
| Viewer / Stakeholder | DENY | DENY | DENY | DENY | DENY | DENY | CONDITIONAL (permitted summaries) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| Platform Operator | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |

`project.progress.override` is denied to every role. Waive, accept, and close
permissions are deferred because their keys are not defined in the source
permissions document. Platform support access is handled by the time-limited
support grant in task 5.6, not by tenant permissions in this matrix.

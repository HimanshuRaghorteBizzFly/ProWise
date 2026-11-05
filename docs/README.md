# How to use these docs with Copilot

> **Stack override:** original blueprint (`docs/source`) proposes NestJS/Prisma/BullMQ; this project uses Spring Boot/JPA/Flyway. Where they differ, docs/ wins.

Always loaded: `.github/copilot-instructions.md` (keep it short).
Everything else is attached on demand with `#file`.

| File | Attach when |
|---|---|
| `docs/progress.md` | Start of every task, and to update at the end |
| `docs/tasks/phase-N.md` | Working on a task in that phase (only that file) |
| `docs/domain-rules.md` | Progress math, lifecycle, calendar, health, review, dependencies |
| `docs/permissions.md` | Roles, guards, access, revocation |
| `docs/api-contract.md` | Writing or testing an endpoint, webhook, events |
| `docs/decisions.md` | A question about scope or a default |
| `docs/source/blueprint.pdf` | Never attach. Archive only. |

## Starter prompt for any task
```
Implement task <X.Y>. Follow .github/copilot-instructions.md.
Attach: #file:docs/progress.md #file:docs/tasks/phase-<N>.md #file:docs/permissions.md
1. Restate the task's requirements as a checklist; ask about anything ambiguous.
2. Write failing tests for each "Pass when" line (negative, race, replay cases too).
3. Implement until green.
4. List what is NOT covered and where a tenant/permission check might be missing.
5. Update docs/progress.md.
```

## Habits
- One task per chat; start a new chat for the next task.
- Name the files to touch in the prompt.
- Run the tests yourself; do not trust "done".
- Hand-review permission and transaction code.

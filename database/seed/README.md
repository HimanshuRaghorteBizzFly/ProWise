# Development Seed

Development-only seed data lives in this folder (`database/seed/`). It is **never** placed in `database/migrations/` and **never** runs automatically in production.

## Direct-Login Demo Users (`dev_seed_logins.sql`)

Seeds the `example` organization (`6cea41af-fffd-4160-9e01-59e7d88e144d`) and 6 active accounts with `must_change_password = false`, `user_roles`, `memberships`, and `ORG`-scoped `grants` so every user logs in directly to their role dashboard.

| Role | User Name | Email | Password | Direct Dashboard Destination |
|---|---|---|---|---|
| **Organization Owner** | Dipak Chavan | `dc741094@gmail.com` | `Owner@Pwise2026` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/owner/dashboard` |
| **Organization Admin** | Organization Admin | `orgadmin@pwise.demo` | `Admin@Pwise2026` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/admin/dashboard` |
| **Project Manager** | Project Manager | `manager@pwise.demo` | `Manager@Pwise2026` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/manager/dashboard` |
| **Team Lead** | Team Lead | `teamlead@pwise.demo` | `TeamLead@Pwise2026` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/lead/dashboard` |
| **Developer** | Developer | `developer@pwise.demo` | `Developer@Pwise2026` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/developer/dashboard` |
| **QA Reviewer** | QA Reviewer | `qa@pwise.demo` | `QA@Pwise2026` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/reviewer/dashboard` |

## Command to Run

Make sure the backend has already applied Flyway migrations (`V1`–`V37+`), then run the seed SQL against your local development database. The script is idempotent and safe to re-run.

### Windows PowerShell (from repo root `C:\BizzFly_Project\Prowise`)

```powershell
psql "postgresql://prowise:prowise-dev-password@localhost:5432/prowise" -v ON_ERROR_STOP=1 -f database\seed\dev_seed_logins.sql
```

### Bash / Linux / macOS (from repo root)

```bash
psql "postgresql://prowise:prowise-dev-password@localhost:5432/prowise" -v ON_ERROR_STOP=1 -f database/seed/dev_seed_logins.sql
```
